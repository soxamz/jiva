'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  addDoctorNoteForConsent,
  authenticateMockUser,
  isConsentAccessError,
  createBreakGlassAccess,
  createDocumentForCurrentPatient,
  createMockUser,
  getRecentOcrExtractionsForCurrentPatient,
  grantConsentForCurrentPatient,
  redeemConsentForCurrentUser,
  revokeConsentForCurrentPatient,
  saveAiIntakeForCurrentPatient,
  submitIntakeForCurrentPatient,
  updateMedicalProfileForCurrentPatient,
} from '@/lib/dal';
import { uploadAndProcessDocument } from '@/lib/document-api';
import { labReportsFromExtractions, synthesizeClinicalSummary } from '@/lib/ml3-api';
import { normalizeIdentifier } from '@/lib/identity';
import { clearSession, createSession } from '@/lib/session';
import { isLocale, setLocale } from '@/lib/i18n';

export type FormState =
  | {
      message?: string;
      errors?: Record<string, string[]>;
      errorCode?: 'access_unavailable' | 'assigned_to_another_clinician';
    }
  | undefined;

const signInSchema = z.object({
  identifier: z.string().regex(/^(\d{10}|\d{12})$/, 'Enter a 10-digit phone or 12-digit Aadhaar.'),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit demo OTP.'),
});

const signUpSchema = z.object({
  name: z.string().trim().min(2, 'Enter the user name.'),
  phone: z.string().regex(/^\d{10}$/, 'Enter a 10-digit phone number.'),
  aadhaar: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\D/g, '') ?? '')
    .refine((value) => value.length === 0 || value.length === 12, 'Aadhaar must be 12 digits.'),
  role: z.enum(['patient', 'doctor', 'responder']),
  otp: z.literal('123456', {
    error: 'Use demo OTP 123456.',
  }),
});

const documentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Enter a document title.')
    .max(120, 'Use 120 characters or fewer.'),
  docType: z.enum(['lab', 'rx', 'note', 'discharge', 'other']),
  notes: z.string().trim().max(1_000, 'Use 1,000 characters or fewer.').optional(),
});

const intakeSchema = z.object({
  chiefComplaint: z.string().trim().min(3),
  symptomDuration: z.string().trim().min(1),
  location: z.string().trim().optional(),
  character: z.string().trim().optional(),
  severity: z.coerce.number().int().min(1).max(10),
  aggravatingFactors: z.string().trim().optional(),
  relievingFactors: z.string().trim().optional(),
  associatedSymptoms: z.string().trim().optional(),
});

const aiIntakeSchema = z.object({
  apiSessionId: z.string().uuid(),
  patientHistory: z
    .object({
      chief_complaint: z.string().nullable(),
      hpi: z.record(z.string(), z.unknown()),
    })
    .passthrough(),
  physicianSummary: z.object({
    en: z.string().trim().min(1).max(12_000),
    hi: z.string().trim().min(1).max(12_000),
    is_draft: z.boolean(),
    disclaimer: z.string().trim().min(1).max(1_000),
    highlights: z.array(z.string().max(500)).max(20),
    red_flags: z.array(z.string().max(500)).max(20),
  }),
  bypassQueue: z.boolean(),
  clinicalSummary: z.record(z.string(), z.unknown()).nullable().optional(),
});

const consentSchema = z.object({
  doctorId: z.string().trim().max(80, 'Use 80 characters or fewer.').optional(),
  durationMinutes: z.coerce
    .number({ error: 'Choose a valid duration.' })
    .int('Choose a whole number of minutes.')
    .min(1, 'Access must last at least 1 minute.')
    .max(1440, 'Access cannot exceed 24 hours.')
    .default(120),
});

const codeSchema = z.object({
  code: z.string().trim().min(4).max(24),
});

const noteSchema = z.object({
  code: z.string().trim().min(4).max(24),
  title: z.string().trim().min(2, 'Enter a note title.').max(120, 'Use 120 characters or fewer.'),
  note: z
    .string()
    .trim()
    .min(5, 'Enter at least 5 characters.')
    .max(5_000, 'Use 5,000 characters or fewer.'),
});

const breakGlassSchema = z.object({
  identifier: z.string().regex(/^(\d{10}|\d{12})$/, 'Enter a 10-digit phone or 12-digit Aadhaar.'),
  reason: z
    .string()
    .trim()
    .min(5, 'Explain why emergency access is needed.')
    .max(500, 'Use 500 characters or fewer.'),
});

const consentIdSchema = z.string().uuid('Invalid access record.');

const listItemSchema = z.string().trim().min(1).max(100);

const profileSchema = z.object({
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']),
  allergies: z.array(listItemSchema).max(12),
  criticalConditions: z.array(listItemSchema).max(12),
  currentMedications: z.array(listItemSchema).max(12),
  emergencyContacts: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(80),
        relation: z.string().trim().min(2).max(60),
        phone: z
          .string()
          .trim()
          .regex(/^[0-9+() -]{7,20}$/, 'Enter a valid contact number.'),
      })
    )
    .max(5),
});

function formErrors(error: z.ZodError): FormState {
  return {
    errors: error.flatten().fieldErrors,
  };
}

function splitCommaSeparatedValues(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEmergencyContacts(value: FormDataEntryValue | null) {
  const entries = String(value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('|').map((part) => part.trim()));

  if (entries.some((entry) => entry.length !== 3)) {
    throw new Error('Enter each emergency contact as: Name | relation | phone number.');
  }

  return entries.map(([name, relation, phone]) => ({ name, relation, phone }));
}

export async function signInAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    identifier: normalizeIdentifier(formData.get('identifier')),
    otp: String(formData.get('otp') ?? ''),
  });

  if (!parsed.success) {
    return formErrors(parsed.error);
  }

  let nextPath = '/dashboard';

  try {
    const user = await authenticateMockUser(parsed.data.identifier, parsed.data.otp);
    await createSession({ userId: user.id, role: user.role });
    nextPath = user.role === 'patient' ? '/dashboard' : '/doctor';
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'Sign-in failed.',
    };
  }

  redirect(nextPath);
}

export async function signUpAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    phone: normalizeIdentifier(formData.get('phone')),
    aadhaar: normalizeIdentifier(formData.get('aadhaar')),
    role: formData.get('role') || 'patient',
    otp: String(formData.get('otp') ?? ''),
  });

  if (!parsed.success) {
    return formErrors(parsed.error);
  }

  let nextPath = '/dashboard';

  try {
    const user = await createMockUser(parsed.data);
    await createSession({ userId: user.id, role: user.role });
    nextPath = user.role === 'patient' ? '/dashboard' : '/doctor';
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'Sign-up failed.',
    };
  }

  redirect(nextPath);
}

export async function signOutAction() {
  await clearSession();
  redirect('/sign-in');
}

export async function setLocaleAction(value: string) {
  if (!isLocale(value)) {
    throw new Error('Unsupported language.');
  }

  await setLocale(value);
}

export async function uploadDocumentAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = documentSchema.safeParse({
    title: formData.get('title'),
    docType: formData.get('docType') || 'other',
    notes: formData.get('notes'),
  });

  if (!parsed.success) {
    return formErrors(parsed.error);
  }

  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    return { errors: { file: ['Choose a PDF, JPG, or PNG file.'] } };
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

  if (!allowedTypes.includes(file.type)) {
    return { errors: { file: ['Unsupported file type. Use PDF, JPG, or PNG.'] } };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { errors: { file: ['File exceeds the 10MB limit.'] } };
  }

  try {
    const aiResult = await uploadAndProcessDocument(file);
    const confidence = aiResult.confidence ?? {};
    const finalConfidence =
      typeof confidence.final === 'number'
        ? Math.round(Math.min(100, Math.max(0, confidence.final * (confidence.final <= 1 ? 100 : 1))))
        : 80;

    await createDocumentForCurrentPatient({
      ...parsed.data,
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      apiDocumentId: aiResult.document_id,
      status: 'processed',
      extraction: {
        extractedJson: aiResult as Record<string, unknown>,
        abnormalValues: [],
        aiConfidenceScore: finalConfidence,
      },
    });
  } catch (error) {
    return { message: error instanceof Error ? error.message : 'Unable to save the document.' };
  }

  revalidatePath('/documents');
  revalidatePath('/timeline');
  redirect('/documents');
}

export async function updateMedicalProfileAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  let emergencyContacts: Array<{ name: string; relation: string; phone: string }>;

  try {
    emergencyContacts = parseEmergencyContacts(formData.get('emergencyContacts'));
  } catch (error) {
    return {
      errors: {
        emergencyContacts: [
          error instanceof Error ? error.message : 'Enter valid emergency contacts.',
        ],
      },
    };
  }

  const parsed = profileSchema.safeParse({
    bloodType: formData.get('bloodType'),
    allergies: splitCommaSeparatedValues(formData.get('allergies')),
    criticalConditions: splitCommaSeparatedValues(formData.get('criticalConditions')),
    currentMedications: splitCommaSeparatedValues(formData.get('currentMedications')),
    emergencyContacts,
  });

  if (!parsed.success) {
    return formErrors(parsed.error);
  }

  try {
    await updateMedicalProfileForCurrentPatient(parsed.data);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'Unable to save health information.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath('/emergency-card');
  revalidatePath('/health-information');
  revalidatePath('/access-log');
  redirect('/health-information');
}

export async function submitIntakeAction(formData: FormData) {
  await submitIntakeForCurrentPatient(
    intakeSchema.parse({
      chiefComplaint: formData.get('chiefComplaint'),
      symptomDuration: formData.get('symptomDuration'),
      location: formData.get('location'),
      character: formData.get('character'),
      severity: formData.get('severity'),
      aggravatingFactors: formData.get('aggravatingFactors'),
      relievingFactors: formData.get('relievingFactors'),
      associatedSymptoms: formData.get('associatedSymptoms'),
    })
  );

  revalidatePath('/intake');
  revalidatePath('/timeline');
  redirect('/intake');
}

export async function saveAiIntakeAction(input: unknown) {
  const parsed = aiIntakeSchema.parse(input);
  const history = parsed.patientHistory as Record<string, unknown>;

  let clinicalSummary: Record<string, unknown> | null = parsed.clinicalSummary ?? null;

  if (!clinicalSummary) {
    try {
      const extractions = await getRecentOcrExtractionsForCurrentPatient(5);
      const medications = Array.isArray(history.medications)
        ? history.medications
        : history.prior_medications
          ? [history.prior_medications]
          : [];

      clinicalSummary = (await synthesizeClinicalSummary({
        intake_session_id: parsed.apiSessionId,
        chief_complaint:
          typeof history.chief_complaint === 'string' ? history.chief_complaint : null,
        hpi: (history.hpi as Record<string, unknown> | null) ?? null,
        allergies: Array.isArray(history.allergies) ? history.allergies : [],
        medications,
        comorbidities: Array.isArray(history.comorbidities) ? history.comorbidities : [],
        review_of_systems:
          (history.review_of_systems as Record<string, unknown> | null) ?? null,
        ayush: (history.ayush as Record<string, unknown> | null) ?? null,
        source_transcript_refs: Array.isArray(history.source_transcript_refs)
          ? (history.source_transcript_refs as string[])
          : [],
        red_flags: parsed.physicianSummary.red_flags,
        lab_reports: labReportsFromExtractions(extractions),
        ocr_documents: extractions,
      })) as Record<string, unknown>;
    } catch {
      // CloseCrew patient draft still saves if ML3 is unavailable.
      clinicalSummary = null;
    }
  }

  const intake = await saveAiIntakeForCurrentPatient({
    ...parsed,
    clinicalSummary,
  });

  revalidatePath('/dashboard');
  revalidatePath('/intake');
  revalidatePath('/timeline');
  revalidatePath('/access-log');

  return { id: intake.id, hasClinicalSummary: Boolean(clinicalSummary) };
}

export async function grantConsentAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = consentSchema.safeParse({
    doctorId: formData.get('doctorId'),
    durationMinutes: formData.get('durationMinutes') || 120,
  });

  if (!parsed.success) {
    return formErrors(parsed.error);
  }

  try {
    await grantConsentForCurrentPatient(parsed.data);
  } catch (error) {
    return { message: error instanceof Error ? error.message : 'Unable to create access.' };
  }

  revalidatePath('/share');
  redirect('/share');
}

export async function revokeConsentAction(formData: FormData) {
  const parsed = consentIdSchema.safeParse(formData.get('consentId'));
  if (!parsed.success) {
    throw new Error('Invalid access record.');
  }

  await revokeConsentForCurrentPatient(parsed.data);
  revalidatePath('/share');
  redirect('/share');
}

export async function redeemConsentAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = codeSchema.safeParse({
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return formErrors(parsed.error);
  }

  let normalizedCode: string;

  try {
    normalizedCode = await redeemConsentForCurrentUser(parsed.data.code);
  } catch (error) {
    if (isConsentAccessError(error)) {
      return { errorCode: error.code };
    }

    return { errorCode: 'access_unavailable' };
  }

  redirect(`/doctor/access/${normalizedCode}`);
}

export async function addDoctorNoteAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = noteSchema.safeParse({
    code: formData.get('code'),
    title: formData.get('title'),
    note: formData.get('note'),
  });

  if (!parsed.success) {
    return formErrors(parsed.error);
  }

  try {
    await addDoctorNoteForConsent(parsed.data.code, {
      title: parsed.data.title,
      note: parsed.data.note,
    });
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'Unable to save the clinical note.',
    };
  }

  revalidatePath(`/doctor/access/${parsed.data.code}`);
  redirect(`/doctor/access/${parsed.data.code}`);
}

export async function breakGlassAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = breakGlassSchema.safeParse({
    identifier: normalizeIdentifier(formData.get('identifier')),
    reason: formData.get('reason'),
  });

  if (!parsed.success) {
    return formErrors(parsed.error);
  }

  let result: Awaited<ReturnType<typeof createBreakGlassAccess>>;

  try {
    result = await createBreakGlassAccess(parsed.data);
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : 'Unable to start emergency access.',
    };
  }

  await createSession({
    userId: result.responder.id,
    role: result.responder.role,
  });

  redirect(`/emergency/access/${result.code}`);
}
