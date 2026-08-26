import 'server-only';

import { cache } from 'react';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import {
  auditLogs,
  consents,
  documents,
  intakeSessions,
  medicalProfiles,
  structuredData,
  users,
} from '@/db/schema';
import { createConsentCode, hashIdentifier, maskPhone } from '@/lib/identity';
import { readSession, type UserRole } from '@/lib/session';

type SafeUser = {
  id: string;
  name: string;
  role: UserRole;
  phoneMasked: string;
  doctorId: string | null;
  status: 'active' | 'deceased';
};

type DocumentInput = {
  title: string;
  docType: typeof documents.$inferInsert.docType;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  notes?: string;
};

type IntakeInput = {
  chiefComplaint: string;
  symptomDuration: string;
  location?: string;
  character?: string;
  severity: number;
  aggravatingFactors?: string;
  relievingFactors?: string;
  associatedSymptoms?: string;
};

export type MedicalProfileInput = {
  bloodType: string;
  allergies: string[];
  criticalConditions: string[];
  currentMedications: string[];
  emergencyContacts: Array<{
    name: string;
    relation: string;
    phone: string;
  }>;
};

export type ConsentAccessErrorCode = 'access_unavailable' | 'assigned_to_another_clinician';

export class ConsentAccessError extends Error {
  constructor(public readonly code: ConsentAccessErrorCode) {
    super(code);
    this.name = 'ConsentAccessError';
  }
}

export function isConsentAccessError(error: unknown): error is ConsentAccessError {
  return error instanceof ConsentAccessError;
}

function toSafeUser(user: typeof users.$inferSelect): SafeUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    phoneMasked: maskPhone(user.phone),
    doctorId: user.doctorId,
    status: user.status,
  };
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function computeRedFlag(input: IntakeInput) {
  const text = [
    input.chiefComplaint,
    input.character,
    input.associatedSymptoms,
    input.aggravatingFactors,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const triggers = [
    'chest pain',
    'breathless',
    'shortness of breath',
    'unconscious',
    'seizure',
    'stroke',
    'facial droop',
    'severe bleeding',
    'blue lips',
  ];

  const reason = triggers.find((trigger) => text.includes(trigger));

  return {
    redFlag: Boolean(reason) || input.severity >= 9,
    redFlagReason: reason
      ? `Matched red-flag symptom: ${reason}`
      : input.severity >= 9
        ? 'Severity score is 9 or higher'
        : null,
  };
}

function createIntakeSummary(input: IntakeInput, redFlagReason: string | null) {
  return [
    `Chief complaint: ${input.chiefComplaint}.`,
    `Duration: ${input.symptomDuration}.`,
    `Severity: ${input.severity}/10.`,
    input.location ? `Location: ${input.location}.` : null,
    input.character ? `Character: ${input.character}.` : null,
    input.associatedSymptoms ? `Associated symptoms: ${input.associatedSymptoms}.` : null,
    redFlagReason ? `Red flag: ${redFlagReason}.` : 'No red-flag trigger detected in demo rules.',
  ]
    .filter(Boolean)
    .join(' ');
}

function createMockExtraction(input: DocumentInput) {
  if (input.docType === 'lab') {
    return {
      extractedJson: {
        kind: 'lab',
        source: input.fileName,
        values: [
          { label: 'Hemoglobin', value: '11.2 g/dL', range: '12-16' },
          { label: 'Fasting glucose', value: '152 mg/dL', range: '70-99' },
        ],
      },
      abnormalValues: [
        { label: 'Fasting glucose', value: '152 mg/dL', severity: 'medium' as const },
      ],
      aiConfidenceScore: 84,
    };
  }

  if (input.docType === 'rx') {
    return {
      extractedJson: {
        kind: 'prescription',
        source: input.fileName,
        medications: ['Metformin 500mg', 'Pantoprazole 40mg'],
      },
      abnormalValues: [],
      aiConfidenceScore: 81,
    };
  }

  return {
    extractedJson: {
      kind: input.docType,
      source: input.fileName,
      summary: input.notes || 'Demo extraction queued for manual review.',
    },
    abnormalValues: [],
    aiConfidenceScore: 76,
  };
}

export async function logAudit(
  actorId: string | null,
  action: string,
  targetResourceType: string,
  targetResourceId: string | null,
  metadata: Record<string, unknown> = {}
) {
  await db.insert(auditLogs).values({
    actorId,
    action,
    targetResourceType,
    targetResourceId,
    metadata,
    blockchainTxHash: `mock-chain-${Date.now().toString(36)}`,
  });
}

export const getCurrentUser = cache(async () => {
  const session = await readSession();

  if (!session) {
    return null;
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

  if (!user || user.status !== 'active') {
    return null;
  }

  return user;
});

export async function requireUser(roles?: UserRole[]) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/sign-in');
  }

  if (roles && !roles.includes(user.role)) {
    redirect(user.role === 'patient' ? '/dashboard' : '/doctor');
  }

  return user;
}

export async function getAppShellUser() {
  const user = await requireUser();
  return toSafeUser(user);
}

export async function authenticateMockUser(identifier: string, otp: string) {
  if (otp !== '123456') {
    throw new Error('Use demo OTP 123456.');
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.phone, identifier), eq(users.aadhaarHash, hashIdentifier(identifier))))
    .limit(1);

  if (!user || user.status !== 'active') {
    throw new Error('No active demo account found for that identifier.');
  }

  await logAudit(user.id, 'LOGIN', 'user', user.id);

  return user;
}

export async function createMockUser(input: {
  name: string;
  phone: string;
  aadhaar?: string;
  role: UserRole;
}) {
  const [existing] = await db.select().from(users).where(eq(users.phone, input.phone)).limit(1);

  if (existing) {
    throw new Error('A demo account already exists for this phone number.');
  }

  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      phone: input.phone,
      role: input.role,
      aadhaarHash: input.aadhaar ? hashIdentifier(input.aadhaar) : null,
      doctorId: input.role === 'doctor' ? `HPR-DEMO-${input.phone.slice(-4)}` : null,
    })
    .returning();

  if (user.role === 'patient') {
    await db.insert(medicalProfiles).values({
      userId: user.id,
      bloodType: 'O+',
      allergies: [],
      criticalConditions: [],
      currentMedications: [],
      emergencyContacts: [],
    });
  }

  await logAudit(user.id, 'SIGN_UP', 'user', user.id);

  return user;
}

async function expireOldConsents(patientId?: string) {
  const now = new Date();
  const baseFilter = and(eq(consents.status, 'active'), lt(consents.expiresAt, now));

  await db
    .update(consents)
    .set({ status: 'expired' })
    .where(patientId ? and(baseFilter, eq(consents.patientId, patientId)) : baseFilter);
}

export async function getPatientWorkspace() {
  const user = await requireUser(['patient']);
  await expireOldConsents(user.id);

  const [profile] = await db
    .select()
    .from(medicalProfiles)
    .where(eq(medicalProfiles.userId, user.id))
    .limit(1);

  const docs = await db
    .select({
      document: documents,
      structured: structuredData,
    })
    .from(documents)
    .leftJoin(structuredData, eq(structuredData.docId, documents.id))
    .where(eq(documents.userId, user.id))
    .orderBy(desc(documents.uploadedAt));

  const activeConsents = await db
    .select()
    .from(consents)
    .where(and(eq(consents.patientId, user.id), eq(consents.status, 'active')))
    .orderBy(desc(consents.grantedAt));

  const intakes = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.patientId, user.id))
    .orderBy(desc(intakeSessions.createdAt));

  const audits = await db
    .select()
    .from(auditLogs)
    .where(or(eq(auditLogs.actorId, user.id), eq(auditLogs.targetResourceId, user.id)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(30);

  const timeline = [
    ...docs.map(({ document, structured }) => ({
      id: document.id,
      type: document.docType,
      title: document.title,
      date: document.uploadedAt,
      body: document.notes ?? `${document.fileName} processed with mock AI extraction.`,
      status: document.status,
      confidence: structured?.aiConfidenceScore ?? null,
      redFlag: false,
    })),
    ...intakes.map((intake) => ({
      id: intake.id,
      type: 'intake',
      title: intake.chiefComplaint,
      date: intake.createdAt,
      body: intake.summary,
      status: intake.redFlag ? 'urgent' : intake.status,
      confidence: null,
      redFlag: intake.redFlag,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    user: toSafeUser(user),
    profile,
    documents: docs,
    activeConsents,
    intakeSessions: intakes,
    auditLogs: audits,
    timeline,
  };
}

export async function createDocumentForCurrentPatient(input: DocumentInput) {
  const user = await requireUser(['patient']);
  const [document] = await db
    .insert(documents)
    .values({
      userId: user.id,
      uploadedById: user.id,
      title: input.title,
      docType: input.docType,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSizeBytes: input.fileSizeBytes,
      notes: input.notes,
      mockFileUri: `neon://mock/${input.fileName}`,
      status: 'processed',
    })
    .returning();

  await db.insert(structuredData).values({
    docId: document.id,
    ...createMockExtraction(input),
  });

  await logAudit(user.id, 'UPLOAD', 'document', document.id, {
    title: document.title,
    patientId: user.id,
  });

  return document;
}

export async function updateMedicalProfileForCurrentPatient(input: MedicalProfileInput) {
  const user = await requireUser(['patient']);
  const [existingProfile] = await db
    .select({ id: medicalProfiles.id })
    .from(medicalProfiles)
    .where(eq(medicalProfiles.userId, user.id))
    .limit(1);

  const profileValues = {
    bloodType: input.bloodType,
    allergies: input.allergies,
    criticalConditions: input.criticalConditions,
    currentMedications: input.currentMedications,
    emergencyContacts: input.emergencyContacts,
    updatedAt: new Date(),
  };

  const [profile] = existingProfile
    ? await db
        .update(medicalProfiles)
        .set(profileValues)
        .where(eq(medicalProfiles.id, existingProfile.id))
        .returning()
    : await db
        .insert(medicalProfiles)
        .values({ userId: user.id, ...profileValues })
        .returning();

  await logAudit(user.id, 'PROFILE_UPDATED', 'medical_profile', profile.id, {
    patientId: user.id,
    fields: [
      'bloodType',
      'allergies',
      'criticalConditions',
      'currentMedications',
      'emergencyContacts',
    ],
    emergencyContactCount: input.emergencyContacts.length,
  });

  return profile;
}

export async function submitIntakeForCurrentPatient(input: IntakeInput) {
  const user = await requireUser(['patient']);
  const redFlag = computeRedFlag(input);
  const [intake] = await db
    .insert(intakeSessions)
    .values({
      patientId: user.id,
      chiefComplaint: input.chiefComplaint,
      symptomDuration: input.symptomDuration,
      location: input.location,
      character: input.character,
      severity: input.severity,
      aggravatingFactors: input.aggravatingFactors,
      relievingFactors: input.relievingFactors,
      associatedSymptoms: input.associatedSymptoms,
      redFlag: redFlag.redFlag,
      redFlagReason: redFlag.redFlagReason,
      summary: createIntakeSummary(input, redFlag.redFlagReason),
    })
    .returning();

  await logAudit(
    user.id,
    redFlag.redFlag ? 'INTAKE_RED_FLAG' : 'INTAKE_SUBMITTED',
    'intake',
    intake.id,
    {
      patientId: user.id,
    }
  );

  return intake;
}

export async function grantConsentForCurrentPatient(input: {
  doctorId?: string;
  durationMinutes: number;
}) {
  const user = await requireUser(['patient']);
  const expiresAt = new Date(Date.now() + input.durationMinutes * 60 * 1000);
  let granteeId: string | null = null;

  if (input.doctorId) {
    const [doctor] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'doctor'), eq(users.doctorId, input.doctorId)))
      .limit(1);

    granteeId = doctor?.id ?? null;
  }

  const [consent] = await db
    .insert(consents)
    .values({
      patientId: user.id,
      granteeId,
      code: createConsentCode(),
      durationMinutes: input.durationMinutes,
      expiresAt,
    })
    .returning();

  await logAudit(user.id, 'CONSENT_GRANTED', 'consent', consent.id, {
    patientId: user.id,
    code: consent.code,
    durationMinutes: consent.durationMinutes,
  });

  return consent;
}

export async function revokeConsentForCurrentPatient(consentId: string) {
  const user = await requireUser(['patient']);
  const [consent] = await db
    .update(consents)
    .set({ status: 'revoked', revokedAt: new Date() })
    .where(
      and(
        eq(consents.id, consentId),
        eq(consents.patientId, user.id),
        eq(consents.status, 'active')
      )
    )
    .returning();

  if (consent) {
    await logAudit(user.id, 'CONSENT_REVOKED', 'consent', consent.id, {
      patientId: user.id,
      code: consent.code,
    });
  }
}

async function getValidConsent(code: string, viewerId: string) {
  await expireOldConsents();

  const normalized = normalizeCode(code);
  const [consent] = await db.select().from(consents).where(eq(consents.code, normalized)).limit(1);

  if (!consent || consent.status !== 'active' || consent.expiresAt <= new Date()) {
    throw new ConsentAccessError('access_unavailable');
  }

  if (consent.granteeId && consent.granteeId !== viewerId) {
    await logAudit(viewerId, 'CONSENT_ACCESS_DENIED', 'consent', consent.id, {
      reason: 'assigned_to_another_clinician',
    });
    throw new ConsentAccessError('assigned_to_another_clinician');
  }

  return consent;
}

export async function redeemConsentForCurrentUser(code: string) {
  const viewer = await requireUser(['doctor', 'responder']);
  const consent = await getValidConsent(code, viewer.id);

  if (!consent.granteeId) {
    await db.update(consents).set({ granteeId: viewer.id }).where(eq(consents.id, consent.id));
  }

  await logAudit(viewer.id, 'VIEW', 'patient', consent.patientId, {
    code: consent.code,
    consentId: consent.id,
  });

  return consent.code;
}

export async function getDoctorAccessData(code: string) {
  const viewer = await requireUser(['doctor', 'responder']);
  const consent = await getValidConsent(code, viewer.id);
  const [patient] = await db.select().from(users).where(eq(users.id, consent.patientId)).limit(1);

  if (!patient) {
    throw new Error('Patient not found.');
  }

  const [profile] = await db
    .select()
    .from(medicalProfiles)
    .where(eq(medicalProfiles.userId, patient.id))
    .limit(1);

  const docs = await db
    .select({ document: documents, structured: structuredData })
    .from(documents)
    .leftJoin(structuredData, eq(structuredData.docId, documents.id))
    .where(eq(documents.userId, patient.id))
    .orderBy(desc(documents.uploadedAt));

  const intakes = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.patientId, patient.id))
    .orderBy(desc(intakeSessions.createdAt))
    .limit(5);

  return {
    viewer: toSafeUser(viewer),
    patient: toSafeUser(patient),
    profile,
    documents: docs,
    intakeSessions: intakes,
    consent,
  };
}

export async function addDoctorNoteForConsent(
  code: string,
  input: { title: string; note: string }
) {
  const viewer = await requireUser(['doctor', 'responder']);
  const consent = await getValidConsent(code, viewer.id);
  const [document] = await db
    .insert(documents)
    .values({
      userId: consent.patientId,
      uploadedById: viewer.id,
      title: input.title,
      docType: 'note',
      fileName: `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`,
      fileType: 'text/plain',
      fileSizeBytes: input.note.length,
      notes: input.note,
      status: 'processed',
    })
    .returning();

  await db.insert(structuredData).values({
    docId: document.id,
    extractedJson: {
      kind: 'clinical-note',
      summary: input.note,
      authorRole: viewer.role,
    },
    abnormalValues: [],
    aiConfidenceScore: 100,
  });

  await logAudit(viewer.id, 'DOCUMENT_ADDED', 'patient', consent.patientId, {
    documentId: document.id,
    consentId: consent.id,
  });

  return document;
}

export async function createBreakGlassAccess(input: { identifier: string; reason: string }) {
  const patientIdentifier = input.identifier;
  const [patient] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.phone, patientIdentifier),
        eq(users.aadhaarHash, hashIdentifier(patientIdentifier))
      )
    )
    .limit(1);

  if (!patient || patient.role !== 'patient') {
    throw new Error('No patient profile found for emergency access.');
  }

  const [responder] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'responder'))
    .orderBy(users.createdAt)
    .limit(1);

  if (!responder) {
    throw new Error('Seed the demo database to create an emergency responder account.');
  }

  const [consent] = await db
    .insert(consents)
    .values({
      patientId: patient.id,
      granteeId: responder.id,
      code: createConsentCode(),
      durationMinutes: 60,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning();

  await logAudit(responder.id, 'BREAK_GLASS', 'patient', patient.id, {
    reason: input.reason,
    code: consent.code,
    alert: 'Mock SMS/email sent to emergency contacts',
  });

  return {
    responder,
    code: consent.code,
  };
}
