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
  grantConsentForCurrentPatient,
  redeemConsentForCurrentUser,
  revokeConsentForCurrentPatient,
  submitIntakeForCurrentPatient,
  updateMedicalProfileForCurrentPatient,
} from '@/lib/dal';
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
  title: z.string().trim().min(2),
  docType: z.enum(['lab', 'rx', 'note', 'discharge', 'other']),
  notes: z.string().trim().optional(),
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

const consentSchema = z.object({
  doctorId: z.string().trim().optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).default(120),
});

const codeSchema = z.object({
  code: z.string().trim().min(4).max(24),
});

const noteSchema = z.object({
  code: z.string().trim().min(4).max(24),
  title: z.string().trim().min(2),
  note: z.string().trim().min(5),
});

const breakGlassSchema = z.object({
  identifier: z.string().regex(/^(\d{10}|\d{12})$/, 'Enter a 10-digit phone or 12-digit Aadhaar.'),
  reason: z.string().trim().min(5),
});

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

export async function uploadDocumentAction(formData: FormData) {
  const parsed = documentSchema.parse({
    title: formData.get('title'),
    docType: formData.get('docType') || 'other',
    notes: formData.get('notes'),
  });
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Choose a PDF, JPG, or PNG file.');
  }

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Unsupported file type. Use PDF, JPG, or PNG.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File exceeds 10MB limit.');
  }

  await createDocumentForCurrentPatient({
    ...parsed,
    fileName: file.name,
    fileType: file.type,
    fileSizeBytes: file.size,
  });

  revalidatePath('/documents');
  revalidatePath('/timeline');
  redirect('/documents');
}

export async function updateMedicalProfileAction(formData: FormData) {
  const profile = profileSchema.parse({
    bloodType: formData.get('bloodType'),
    allergies: splitCommaSeparatedValues(formData.get('allergies')),
    criticalConditions: splitCommaSeparatedValues(formData.get('criticalConditions')),
    currentMedications: splitCommaSeparatedValues(formData.get('currentMedications')),
    emergencyContacts: parseEmergencyContacts(formData.get('emergencyContacts')),
  });

  await updateMedicalProfileForCurrentPatient(profile);

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

export async function grantConsentAction(formData: FormData) {
  await grantConsentForCurrentPatient(
    consentSchema.parse({
      doctorId: formData.get('doctorId'),
      durationMinutes: formData.get('durationMinutes') || 120,
    })
  );

  revalidatePath('/share');
  redirect('/share');
}

export async function revokeConsentAction(formData: FormData) {
  const consentId = String(formData.get('consentId') ?? '');
  await revokeConsentForCurrentPatient(consentId);
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

export async function addDoctorNoteAction(formData: FormData) {
  const parsed = noteSchema.parse({
    code: formData.get('code'),
    title: formData.get('title'),
    note: formData.get('note'),
  });

  await addDoctorNoteForConsent(parsed.code, {
    title: parsed.title,
    note: parsed.note,
  });

  revalidatePath(`/doctor/access/${parsed.code}`);
  redirect(`/doctor/access/${parsed.code}`);
}

export async function breakGlassAction(formData: FormData) {
  const parsed = breakGlassSchema.parse({
    identifier: normalizeIdentifier(formData.get('identifier')),
    reason: formData.get('reason'),
  });
  const result = await createBreakGlassAccess(parsed);

  await createSession({
    userId: result.responder.id,
    role: result.responder.role,
  });

  redirect(`/doctor/access/${result.code}`);
}
