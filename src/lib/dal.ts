import "server-only";

import { cache } from "react";
import { and, desc, eq, gte, lt, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db/client";
import {
  auditLogs,
  consents,
  documents,
  intakeSessions,
  medicalProfiles,
  structuredData,
  users,
} from "@/db/schema";
import {
  createConsentCode,
  createShareToken,
  hashIdentifier,
  maskPhone,
} from "@/lib/identity";
import {
  createEmergencyPreview,
  readEmergencyPreview,
  readSession,
  type EmergencyPreviewPayload,
  type UserRole,
} from "@/lib/session";

type SafeUser = {
  id: string;
  name: string;
  role: UserRole;
  phoneMasked: string;
  doctorId: string | null;
  status: "active" | "deceased";
};

type DocumentInput = {
  title: string;
  docType: typeof documents.$inferInsert.docType;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  notes?: string;
  apiDocumentId?: string;
  extraction?: {
    extractedJson: Record<string, unknown>;
    abnormalValues: Array<{
      label: string;
      value: string;
      severity: "low" | "medium" | "high";
    }>;
    aiConfidenceScore: number;
  };
  status?: "processing" | "processed" | "failed";
};

type UploadThingDocumentInput = {
  userId: string;
  title: string;
  docType: typeof documents.$inferInsert.docType;
  notes?: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  storageKey: string;
  storageUrl: string;
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

type AiIntakeInput = {
  apiSessionId: string;
  patientHistory: Record<string, unknown>;
  physicianSummary: {
    en: string;
    hi: string;
    is_draft: boolean;
    disclaimer: string;
    highlights: string[];
    red_flags: string[];
  };
  bypassQueue: boolean;
  clinicalSummary?: Record<string, unknown> | null;
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

export type ConsentAccessErrorCode =
  "access_unavailable" | "assigned_to_another_clinician";

export class ConsentAccessError extends Error {
  constructor(public readonly code: ConsentAccessErrorCode) {
    super(code);
    this.name = "ConsentAccessError";
  }
}

export function isConsentAccessError(
  error: unknown,
): error is ConsentAccessError {
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
    .join(" ")
    .toLowerCase();

  const triggers = [
    "chest pain",
    "breathless",
    "shortness of breath",
    "unconscious",
    "seizure",
    "stroke",
    "facial droop",
    "severe bleeding",
    "blue lips",
  ];

  const reason = triggers.find((trigger) => text.includes(trigger));

  return {
    redFlag: Boolean(reason) || input.severity >= 9,
    redFlagReason: reason
      ? `Matched red-flag symptom: ${reason}`
      : input.severity >= 9
        ? "Severity score is 9 or higher"
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
    input.associatedSymptoms
      ? `Associated symptoms: ${input.associatedSymptoms}.`
      : null,
    redFlagReason
      ? `Red flag: ${redFlagReason}.`
      : "No red-flag trigger detected in demo rules.",
  ]
    .filter(Boolean)
    .join(" ");
}

function getTextValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getObjectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getSeverityValue(value: unknown) {
  const severity = typeof value === "number" ? value : Number(value);
  return Number.isInteger(severity) && severity >= 1 && severity <= 10
    ? severity
    : 5;
}

function createMockExtraction(input: DocumentInput) {
  if (input.docType === "lab") {
    return {
      extractedJson: {
        kind: "lab",
        source: input.fileName,
        values: [
          { label: "Hemoglobin", value: "11.2 g/dL", range: "12-16" },
          { label: "Fasting glucose", value: "152 mg/dL", range: "70-99" },
        ],
      },
      abnormalValues: [
        {
          label: "Fasting glucose",
          value: "152 mg/dL",
          severity: "medium" as const,
        },
      ],
      aiConfidenceScore: 84,
    };
  }

  if (input.docType === "rx") {
    return {
      extractedJson: {
        kind: "prescription",
        source: input.fileName,
        medications: ["Metformin 500mg", "Pantoprazole 40mg"],
      },
      abnormalValues: [],
      aiConfidenceScore: 81,
    };
  }

  return {
    extractedJson: {
      kind: input.docType,
      source: input.fileName,
      summary: input.notes || "Demo extraction queued for manual review.",
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
  metadata: Record<string, unknown> = {},
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

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || user.status !== "active") {
    return null;
  }

  return user;
});

export async function requireUser(roles?: UserRole[]) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (roles && !roles.includes(user.role)) {
    redirect(
      user.role === "patient"
        ? "/dashboard"
        : user.role === "responder"
          ? "/emergency"
          : "/doctor",
    );
  }

  return user;
}

export async function getAppShellUser() {
  const user = await requireUser();
  return toSafeUser(user);
}

export async function authenticateMockUser(
  identifier: string,
  otp: string,
  expectedRole?: "patient" | "doctor",
) {
  if (otp !== "123456") {
    throw new Error("Use demo OTP 123456.");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.phone, identifier),
        eq(users.aadhaarHash, hashIdentifier(identifier)),
      ),
    )
    .limit(1);

  if (!user || user.status !== "active") {
    throw new Error("No active demo account found for that identifier.");
  }

  if (expectedRole && user.role !== expectedRole) {
    throw new Error(`This account is not registered as a ${expectedRole}.`);
  }

  await logAudit(user.id, "LOGIN", "user", user.id);

  return user;
}

export async function createMockUser(input: {
  name: string;
  phone: string;
  aadhaar?: string;
  role: UserRole;
}) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.phone, input.phone))
    .limit(1);

  if (existing) {
    throw new Error("A demo account already exists for this phone number.");
  }

  const [user] = await db
    .insert(users)
    .values({
      name: input.name,
      phone: input.phone,
      role: input.role,
      aadhaarHash: input.aadhaar ? hashIdentifier(input.aadhaar) : null,
      shareToken: input.role === "patient" ? createShareToken() : null,
      doctorId:
        input.role === "doctor" ? `HPR-DEMO-${input.phone.slice(-4)}` : null,
    })
    .returning();

  if (user.role === "patient") {
    await db.insert(medicalProfiles).values({
      userId: user.id,
      bloodType: "O+",
      allergies: [],
      criticalConditions: [],
      currentMedications: [],
      emergencyContacts: [],
    });
  }

  await logAudit(user.id, "SIGN_UP", "user", user.id);

  return user;
}

async function expireOldConsents(patientId?: string) {
  const now = new Date();
  const baseFilter = and(
    eq(consents.status, "active"),
    lt(consents.expiresAt, now),
  );

  await db
    .update(consents)
    .set({ status: "expired" })
    .where(
      patientId
        ? and(baseFilter, eq(consents.patientId, patientId))
        : baseFilter,
    );
}

export async function getPatientWorkspace() {
  const user = await requireUser(["patient"]);
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
    .select({
      consent: consents,
      doctor: {
        id: users.id,
        name: users.name,
        doctorId: users.doctorId,
      },
    })
    .from(consents)
    .innerJoin(users, eq(consents.granteeId, users.id))
    .where(
      and(
        eq(consents.patientId, user.id),
        eq(consents.status, "active"),
        eq(users.role, "doctor"),
      ),
    )
    .orderBy(desc(consents.lastAuthenticatedAt), desc(consents.grantedAt));

  const intakes = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.patientId, user.id))
    .orderBy(desc(intakeSessions.createdAt));

  const audits = await db
    .select()
    .from(auditLogs)
    .where(
      or(
        eq(auditLogs.actorId, user.id),
        eq(auditLogs.targetResourceId, user.id),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(30);

  const timeline = [
    ...docs.map(({ document, structured }) => ({
      id: document.id,
      type: document.docType,
      title: document.title,
      date: document.uploadedAt,
      body:
        document.notes ??
        `${document.fileName} processed with Document AI (confidence ${structured?.aiConfidenceScore ?? "n/a"}%).`,
      fileUrl: document.storageUrl,
      status: document.status,
      confidence: structured?.aiConfidenceScore ?? null,
      redFlag: false,
    })),
    ...intakes.map((intake) => ({
      id: intake.id,
      type: "intake",
      title: intake.chiefComplaint,
      date: intake.createdAt,
      body: intake.summary,
      fileUrl: null,
      status: intake.redFlag ? "urgent" : intake.status,
      confidence: null,
      redFlag: intake.redFlag,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    user: toSafeUser(user),
    shareToken: user.shareToken,
    profile,
    documents: docs,
    activeConsents,
    intakeSessions: intakes,
    auditLogs: audits,
    timeline,
  };
}

export async function startEmergencyPreview(
  method: EmergencyPreviewPayload["method"],
) {
  const [patient] = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "patient"), eq(users.status, "active")))
    .orderBy(users.createdAt)
    .limit(1);

  if (!patient) {
    return null;
  }

  await createEmergencyPreview({ patientId: patient.id, method });
  await logAudit(null, "BREAK_GLASS_AUTHENTICATED", "patient", patient.id, {
    method,
    source: "emergency_gateway",
    temporaryAccessMinutes: 15,
  });

  return toSafeUser(patient);
}

/**
 * Resolves only the patient selected by the signed, short-lived break-glass
 * cookie. It never falls back to an arbitrary account.
 */
export async function getEmergencyPreviewData() {
  const preview = await readEmergencyPreview();

  if (!preview) {
    return null;
  }

  const [patient] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, preview.patientId),
        eq(users.role, "patient"),
        eq(users.status, "active"),
      ),
    )
    .limit(1);

  if (!patient) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(medicalProfiles)
    .where(eq(medicalProfiles.userId, patient.id))
    .limit(1);

  const patientDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, patient.id))
    .orderBy(desc(documents.uploadedAt))
    .limit(10);

  const symptomChecks = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.patientId, patient.id))
    .orderBy(desc(intakeSessions.createdAt))
    .limit(5);

  return {
    patient: toSafeUser(patient),
    profile: profile ?? null,
    documents: patientDocuments,
    symptomChecks,
  };
}

/** Past-N-day intakes, OCR documents, and profile for Clinical Overview. */
export async function getPatientWeekClinicalContext(days = 7) {
  const user = await requireUser(["patient"]);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [profile] = await db
    .select()
    .from(medicalProfiles)
    .where(eq(medicalProfiles.userId, user.id))
    .limit(1);

  const weekDocuments = await db
    .select({
      document: documents,
      structured: structuredData,
    })
    .from(documents)
    .leftJoin(structuredData, eq(structuredData.docId, documents.id))
    .where(and(eq(documents.userId, user.id), gte(documents.uploadedAt, since)))
    .orderBy(desc(documents.uploadedAt));

  const weekIntakes = await db
    .select()
    .from(intakeSessions)
    .where(
      and(
        eq(intakeSessions.patientId, user.id),
        gte(intakeSessions.createdAt, since),
      ),
    )
    .orderBy(desc(intakeSessions.createdAt));

  return {
    user: toSafeUser(user),
    profile: profile ?? null,
    since,
    days,
    weekIntakes,
    weekDocuments,
  };
}

export async function getOcrExtractionsSince(since: Date) {
  const user = await requireUser(["patient"]);
  const rows = await db
    .select({
      documentId: documents.id,
      title: documents.title,
      docType: documents.docType,
      uploadedAt: documents.uploadedAt,
      extractedJson: structuredData.extractedJson,
      abnormalValues: structuredData.abnormalValues,
    })
    .from(documents)
    .innerJoin(structuredData, eq(structuredData.docId, documents.id))
    .where(and(eq(documents.userId, user.id), gte(documents.uploadedAt, since)))
    .orderBy(desc(documents.uploadedAt));

  return rows.filter(
    (row) => row.extractedJson && typeof row.extractedJson === "object",
  );
}

export async function createDocumentForCurrentPatient(input: DocumentInput) {
  const user = await requireUser(["patient"]);
  const extraction = input.extraction ?? createMockExtraction(input);
  const status = input.status ?? "processed";

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
      mockFileUri: input.apiDocumentId
        ? `document-ai://${input.apiDocumentId}`
        : `neon://mock/${input.fileName}`,
      status,
    })
    .returning();

  await db.insert(structuredData).values({
    docId: document.id,
    ...extraction,
  });

  await logAudit(user.id, "UPLOAD", "document", document.id, {
    title: document.title,
    patientId: user.id,
    apiDocumentId: input.apiDocumentId ?? null,
    source: input.extraction ? "document_ai" : "mock",
  });

  return document;
}

export async function createUploadThingDocument(
  input: UploadThingDocumentInput,
) {
  const [document] = await db
    .insert(documents)
    .values({
      userId: input.userId,
      uploadedById: input.userId,
      title: input.title,
      docType: input.docType,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSizeBytes: input.fileSizeBytes,
      storageKey: input.storageKey,
      storageUrl: input.storageUrl,
      mockFileUri: input.storageUrl,
      notes: input.notes,
      status: "processing",
    })
    .onConflictDoNothing({ target: documents.storageKey })
    .returning();

  if (!document) {
    const [existingDocument] = await db
      .select()
      .from(documents)
      .where(eq(documents.storageKey, input.storageKey))
      .limit(1);

    if (!existingDocument || existingDocument.userId !== input.userId) {
      throw new Error("Unable to save the uploaded document.");
    }

    return existingDocument;
  }

  await logAudit(input.userId, "UPLOAD", "document", document.id, {
    title: document.title,
    patientId: input.userId,
    storageKey: input.storageKey,
    source: "uploadthing",
  });

  return document;
}

export async function getStoredDocumentForCurrentPatient(documentId: string) {
  const user = await requireUser(["patient"]);
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
    .limit(1);

  if (!document?.storageKey) {
    throw new Error("Stored document not found.");
  }

  return document;
}

export async function completeStoredDocumentProcessingForCurrentPatient(
  documentId: string,
  extraction: NonNullable<DocumentInput["extraction"]>,
) {
  const user = await requireUser(["patient"]);
  const [document] = await db
    .update(documents)
    .set({ status: "processed" })
    .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
    .returning();

  if (!document) {
    throw new Error("Stored document not found.");
  }

  const [existingExtraction] = await db
    .select({ id: structuredData.id })
    .from(structuredData)
    .where(eq(structuredData.docId, document.id))
    .limit(1);

  if (existingExtraction) {
    await db
      .update(structuredData)
      .set(extraction)
      .where(eq(structuredData.id, existingExtraction.id));
  } else {
    await db
      .insert(structuredData)
      .values({ docId: document.id, ...extraction });
  }

  await logAudit(user.id, "DOCUMENT_PROCESSED", "document", document.id, {
    patientId: user.id,
    source: "uploadthing",
  });
}

export async function failStoredDocumentProcessingForCurrentPatient(
  documentId: string,
  reason: string,
) {
  const user = await requireUser(["patient"]);
  const [document] = await db
    .update(documents)
    .set({ status: "failed" })
    .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
    .returning({ id: documents.id });

  if (document) {
    await logAudit(
      user.id,
      "DOCUMENT_PROCESSING_FAILED",
      "document",
      document.id,
      {
        patientId: user.id,
        source: "uploadthing",
        reason,
      },
    );
  }
}

export async function updateMedicalProfileForCurrentPatient(
  input: MedicalProfileInput,
) {
  const user = await requireUser(["patient"]);
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

  await logAudit(user.id, "PROFILE_UPDATED", "medical_profile", profile.id, {
    patientId: user.id,
    fields: [
      "bloodType",
      "allergies",
      "criticalConditions",
      "currentMedications",
      "emergencyContacts",
    ],
    emergencyContactCount: input.emergencyContacts.length,
  });

  return profile;
}

export async function submitIntakeForCurrentPatient(input: IntakeInput) {
  const user = await requireUser(["patient"]);
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
    redFlag.redFlag ? "INTAKE_RED_FLAG" : "INTAKE_SUBMITTED",
    "intake",
    intake.id,
    {
      patientId: user.id,
    },
  );

  return intake;
}

export async function saveAiIntakeForCurrentPatient(input: AiIntakeInput) {
  const user = await requireUser(["patient"]);
  const history = getObjectValue(input.patientHistory);
  const hpi = getObjectValue(history.hpi);
  const redFlags = input.physicianSummary.red_flags.filter(Boolean);
  const redFlag = input.bypassQueue || redFlags.length > 0;
  const chiefComplaint =
    getTextValue(history.chief_complaint) ?? "Symptom check";
  const redFlagReason = redFlag
    ? redFlags.join(", ") || "Urgent triage triggered during AI symptom check."
    : null;

  const [intake] = await db
    .insert(intakeSessions)
    .values({
      patientId: user.id,
      chiefComplaint,
      symptomDuration: getTextValue(hpi.onset) ?? "Not recorded",
      location: getTextValue(hpi.site),
      character: getTextValue(hpi.character),
      severity: getSeverityValue(hpi.severity),
      aggravatingFactors: getTextValue(hpi.exacerbating_relieving),
      associatedSymptoms: getTextValue(hpi.associations),
      redFlag,
      redFlagReason,
      summary: input.physicianSummary.en,
      aiSessionId: input.apiSessionId,
      patientHistory: input.patientHistory,
      physicianSummary: input.physicianSummary,
      clinicalSummary: input.clinicalSummary ?? null,
      redFlagDetails: redFlags,
    })
    .onConflictDoNothing({ target: intakeSessions.aiSessionId })
    .returning();

  if (!intake) {
    const [existing] = await db
      .select({ id: intakeSessions.id })
      .from(intakeSessions)
      .where(eq(intakeSessions.aiSessionId, input.apiSessionId))
      .limit(1);

    if (!existing) {
      throw new Error("Could not save the symptom check. Please try again.");
    }

    if (input.clinicalSummary) {
      await db
        .update(intakeSessions)
        .set({ clinicalSummary: input.clinicalSummary })
        .where(eq(intakeSessions.id, existing.id));
    }

    return existing;
  }

  await logAudit(
    user.id,
    redFlag ? "INTAKE_RED_FLAG" : "INTAKE_SUBMITTED",
    "intake",
    intake.id,
    {
      patientId: user.id,
      aiSessionId: input.apiSessionId,
      redFlags,
      source: "ai_chat",
    },
  );

  return intake;
}

export async function getRecentOcrExtractionsForCurrentPatient(limit = 5) {
  const user = await requireUser(["patient"]);
  const rows = await db
    .select({
      documentId: documents.id,
      title: documents.title,
      docType: documents.docType,
      extractedJson: structuredData.extractedJson,
    })
    .from(documents)
    .innerJoin(structuredData, eq(structuredData.docId, documents.id))
    .where(eq(documents.userId, user.id))
    .orderBy(desc(documents.uploadedAt))
    .limit(limit);

  return rows
    .map((row) => row.extractedJson)
    .filter(
      (value): value is Record<string, unknown> =>
        Boolean(value) && typeof value === "object",
    );
}

export async function grantConsentForCurrentPatient(input: {
  doctorId?: string;
  durationMinutes: number;
}) {
  const user = await requireUser(["patient"]);
  const expiresAt = new Date(Date.now() + input.durationMinutes * 60 * 1000);
  let granteeId: string | null = null;

  if (input.doctorId) {
    const [doctor] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "doctor"), eq(users.doctorId, input.doctorId)))
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

  await logAudit(user.id, "CONSENT_GRANTED", "consent", consent.id, {
    patientId: user.id,
    code: consent.code,
    durationMinutes: consent.durationMinutes,
  });

  return consent;
}

export async function revokeConsentForCurrentPatient(consentId: string) {
  const user = await requireUser(["patient"]);
  const [consent] = await db
    .update(consents)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(
      and(
        eq(consents.id, consentId),
        eq(consents.patientId, user.id),
        eq(consents.status, "active"),
      ),
    )
    .returning();

  if (consent) {
    await logAudit(user.id, "CONSENT_REVOKED", "consent", consent.id, {
      patientId: user.id,
      code: consent.code,
    });
  }
}

async function getValidConsent(code: string, viewerId: string) {
  await expireOldConsents();

  const normalized = normalizeCode(code);
  const [consent] = await db
    .select()
    .from(consents)
    .where(eq(consents.code, normalized))
    .limit(1);

  if (
    !consent ||
    consent.status !== "active" ||
    (consent.expiresAt && consent.expiresAt <= new Date())
  ) {
    throw new ConsentAccessError("access_unavailable");
  }

  if (consent.granteeId && consent.granteeId !== viewerId) {
    await logAudit(viewerId, "CONSENT_ACCESS_DENIED", "consent", consent.id, {
      reason: "assigned_to_another_clinician",
    });
    throw new ConsentAccessError("assigned_to_another_clinician");
  }

  return consent;
}

export async function redeemPatientQrForCurrentDoctor(shareToken: string) {
  const viewer = await requireUser(["doctor"]);
  const [patient] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.shareToken, shareToken),
        eq(users.role, "patient"),
        eq(users.status, "active"),
      ),
    )
    .limit(1);

  if (!patient) {
    throw new ConsentAccessError("access_unavailable");
  }

  const now = new Date();
  const [activeConsent] = await db
    .select()
    .from(consents)
    .where(
      and(
        eq(consents.patientId, patient.id),
        eq(consents.granteeId, viewer.id),
        eq(consents.status, "active"),
      ),
    )
    .orderBy(desc(consents.grantedAt))
    .limit(1);

  if (activeConsent) {
    await db
      .update(consents)
      .set({
        durationMinutes: null,
        expiresAt: null,
        lastAuthenticatedAt: now,
      })
      .where(eq(consents.id, activeConsent.id));
    await logAudit(viewer.id, "QR_SHARE_SCANNED", "patient", patient.id, {
      patientId: patient.id,
      consentId: activeConsent.id,
    });
    return activeConsent.code;
  }

  const [previousConsent] = await db
    .select()
    .from(consents)
    .where(
      and(
        eq(consents.patientId, patient.id),
        eq(consents.granteeId, viewer.id),
      ),
    )
    .orderBy(desc(consents.grantedAt))
    .limit(1);

  const consentValues = {
    code: createConsentCode(),
    status: "active" as const,
    grantedAt: now,
    durationMinutes: null,
    expiresAt: null,
    revokedAt: null,
    lastAuthenticatedAt: now,
  };

  const [consent] = previousConsent
    ? await db
        .update(consents)
        .set(consentValues)
        .where(eq(consents.id, previousConsent.id))
        .returning()
    : await db
        .insert(consents)
        .values({
          patientId: patient.id,
          granteeId: viewer.id,
          ...consentValues,
        })
        .returning();

  await logAudit(
    viewer.id,
    previousConsent ? "QR_SHARE_REGRANTED" : "QR_SHARE_GRANTED",
    "patient",
    patient.id,
    {
      patientId: patient.id,
      consentId: consent.id,
    },
  );

  return consent.code;
}

export async function redeemConsentForCurrentUser(code: string) {
  const viewer = await requireUser(["doctor"]);
  const consent = await getValidConsent(code, viewer.id);

  if (!consent.granteeId) {
    await db
      .update(consents)
      .set({ granteeId: viewer.id })
      .where(eq(consents.id, consent.id));
  }

  await logAudit(viewer.id, "VIEW", "patient", consent.patientId, {
    code: consent.code,
    consentId: consent.id,
  });

  return consent.code;
}

export async function getDoctorAccessData(code: string) {
  const viewer = await requireUser(["doctor"]);
  const consent = await getValidConsent(code, viewer.id);
  const [patient] = await db
    .select()
    .from(users)
    .where(eq(users.id, consent.patientId))
    .limit(1);

  if (!patient) {
    throw new Error("Patient not found.");
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
    .where(
      and(
        eq(documents.userId, patient.id),
        eq(documents.shareWithDoctor, true),
      ),
    )
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
  input: { title: string; note: string },
) {
  const viewer = await requireUser(["doctor"]);
  const consent = await getValidConsent(code, viewer.id);
  const [document] = await db
    .insert(documents)
    .values({
      userId: consent.patientId,
      uploadedById: viewer.id,
      title: input.title,
      docType: "note",
      fileName: `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`,
      fileType: "text/plain",
      fileSizeBytes: input.note.length,
      notes: input.note,
      shareWithDoctor: true,
      status: "processed",
    })
    .returning();

  await db.insert(structuredData).values({
    docId: document.id,
    extractedJson: {
      kind: "clinical-note",
      summary: input.note,
      authorRole: viewer.role,
    },
    abnormalValues: [],
    aiConfidenceScore: 100,
  });

  await logAudit(viewer.id, "DOCUMENT_ADDED", "patient", consent.patientId, {
    documentId: document.id,
    consentId: consent.id,
  });

  return document;
}

export async function setDocumentDoctorSharingForCurrentPatient(
  documentId: string,
  shareWithDoctor: boolean,
) {
  const user = await requireUser(["patient"]);
  const [document] = await db
    .update(documents)
    .set({ shareWithDoctor })
    .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
    .returning({ id: documents.id, title: documents.title });

  if (!document) {
    throw new Error("Medical record not found.");
  }

  await logAudit(
    user.id,
    "DOCUMENT_DOCTOR_SHARING_UPDATED",
    "document",
    document.id,
    {
      shareWithDoctor,
      title: document.title,
    },
  );

  return document;
}

export async function getEmergencyAccessData(code: string) {
  const viewer = await requireUser(["responder"]);
  const consent = await getValidConsent(code, viewer.id);

  if (consent.granteeId !== viewer.id) {
    throw new ConsentAccessError("access_unavailable");
  }

  const [patient] = await db
    .select()
    .from(users)
    .where(eq(users.id, consent.patientId))
    .limit(1);

  if (!patient) {
    throw new ConsentAccessError("access_unavailable");
  }

  const [profile] = await db
    .select()
    .from(medicalProfiles)
    .where(eq(medicalProfiles.userId, patient.id))
    .limit(1);

  const recentIntakes = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.patientId, patient.id))
    .orderBy(desc(intakeSessions.createdAt))
    .limit(3);

  const patientDocuments = await db
    .select({ document: documents, structured: structuredData })
    .from(documents)
    .leftJoin(structuredData, eq(structuredData.docId, documents.id))
    .where(eq(documents.userId, patient.id))
    .orderBy(desc(documents.uploadedAt))
    .limit(5);

  return {
    viewer: toSafeUser(viewer),
    patient: toSafeUser(patient),
    profile,
    recentIntakes,
    documents: patientDocuments,
    consent,
  };
}

export async function createBreakGlassAccess(input: {
  identifier: string;
  reason: string;
}) {
  const patientIdentifier = input.identifier;
  const [patient] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.phone, patientIdentifier),
        eq(users.aadhaarHash, hashIdentifier(patientIdentifier)),
      ),
    )
    .limit(1);

  if (!patient || patient.role !== "patient") {
    throw new Error("No patient profile found for emergency access.");
  }

  const [responder] = await db
    .select()
    .from(users)
    .where(eq(users.role, "responder"))
    .orderBy(users.createdAt)
    .limit(1);

  if (!responder) {
    throw new Error(
      "Seed the demo database to create an emergency responder account.",
    );
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

  await logAudit(responder.id, "BREAK_GLASS", "patient", patient.id, {
    reason: input.reason,
    code: consent.code,
    alert: "Mock SMS/email sent to emergency contacts",
  });

  return {
    responder,
    code: consent.code,
  };
}
