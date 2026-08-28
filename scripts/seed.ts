import { neon } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import {
  auditLogs,
  consents,
  documents,
  intakeSessions,
  medicalProfiles,
  structuredData,
  users,
} from "@/db/schema";
import { hashIdentifier } from "@/lib/identity";
import { demoCredentials } from "@/lib/demo-credentials";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim().replace(/^['"]|['"]$/g, "");

  if (!url) {
    throw new Error("DATABASE_URL is required.");
  }

  return url;
}

const db = drizzle(neon(getDatabaseUrl()));

const patientId = "11111111-1111-4111-8111-111111111111";
const doctorId = "22222222-2222-4222-8222-222222222222";
const responderId = "33333333-3333-4333-8333-333333333333";
const labDocId = "44444444-4444-4444-8444-444444444444";
const rxDocId = "55555555-5555-4555-8555-555555555555";
const consentId = "66666666-6666-4666-8666-666666666666";

async function main() {
  await db
    .insert(users)
    .values([
      {
        id: patientId,
        role: "patient",
        name: "Aarav Sharma",
        phone: "9876543210",
        aadhaarHash: hashIdentifier("123412341234"),
        shareToken: "a1111111-1111-4111-8111-111111111111",
      },
      {
        id: doctorId,
        role: "doctor",
        name: "Dr. Meera Iyer",
        phone: "9000000001",
        aadhaarHash: hashIdentifier(demoCredentials.doctor.identifier),
        doctorId: "HPR-DEMO-1001",
      },
      {
        id: responderId,
        role: "responder",
        name: "ER Desk Responder",
        phone: "9000000002",
      },
    ])
    .onConflictDoNothing();

  await db
    .update(users)
    .set({ aadhaarHash: hashIdentifier(demoCredentials.doctor.identifier) })
    .where(and(eq(users.id, doctorId), eq(users.role, "doctor")));

  const existingProfile = await db
    .select({ id: medicalProfiles.id })
    .from(medicalProfiles)
    .where(eq(medicalProfiles.userId, patientId))
    .limit(1);

  if (existingProfile.length === 0) {
    await db.insert(medicalProfiles).values({
      userId: patientId,
      bloodType: "B+",
      allergies: ["Penicillin"],
      criticalConditions: ["Type 2 Diabetes", "On anticoagulant therapy"],
      currentMedications: ["Metformin 500mg", "Warfarin 2mg"],
      emergencyContacts: [
        { name: "Nisha Sharma", relation: "Spouse", phone: "9876500000" },
        { name: "Rohan Sharma", relation: "Brother", phone: "9876500001" },
      ],
    });
  }

  await db
    .insert(documents)
    .values([
      {
        id: labDocId,
        userId: patientId,
        uploadedById: patientId,
        title: "Liver Function Test",
        docType: "lab",
        fileName: "lft-report-demo.pdf",
        fileType: "application/pdf",
        fileSizeBytes: 684000,
        mockFileUri: "neon://mock/lft-report-demo.pdf",
        notes: "Seeded demo lab report with abnormal bilirubin highlight.",
      },
      {
        id: rxDocId,
        userId: patientId,
        uploadedById: doctorId,
        title: "Diabetes Follow-up Prescription",
        docType: "rx",
        fileName: "rx-followup-demo.jpg",
        fileType: "image/jpeg",
        fileSizeBytes: 420000,
        mockFileUri: "neon://mock/rx-followup-demo.jpg",
        notes: "Seeded prescription from prior visit.",
      },
    ])
    .onConflictDoNothing();

  const existingLabExtraction = await db
    .select({ id: structuredData.id })
    .from(structuredData)
    .where(eq(structuredData.docId, labDocId))
    .limit(1);
  const existingRxExtraction = await db
    .select({ id: structuredData.id })
    .from(structuredData)
    .where(eq(structuredData.docId, rxDocId))
    .limit(1);

  if (existingLabExtraction.length === 0) {
    await db.insert(structuredData).values({
      docId: labDocId,
      aiConfidenceScore: 87,
      extractedJson: {
        diagnoses: ["Mild hepatic enzyme elevation"],
        labValues: [
          { label: "Total bilirubin", value: "2.1 mg/dL", range: "0.3-1.2" },
          { label: "ALT", value: "68 U/L", range: "7-56" },
        ],
      },
      abnormalValues: [
        { label: "Total bilirubin", value: "2.1 mg/dL", severity: "medium" },
        { label: "ALT", value: "68 U/L", severity: "low" },
      ],
    });
  }

  if (existingRxExtraction.length === 0) {
    await db.insert(structuredData).values({
      docId: rxDocId,
      aiConfidenceScore: 82,
      extractedJson: {
        medications: ["Metformin 500mg twice daily", "Warfarin 2mg once daily"],
        followUp: "Review in 30 days",
      },
      abnormalValues: [],
    });
  }

  const existingIntake = await db
    .select({ id: intakeSessions.id })
    .from(intakeSessions)
    .where(
      and(
        eq(intakeSessions.patientId, patientId),
        eq(intakeSessions.chiefComplaint, "Dizziness and fatigue"),
      ),
    )
    .limit(1);

  if (existingIntake.length === 0) {
    await db.insert(intakeSessions).values({
      patientId,
      chiefComplaint: "Dizziness and fatigue",
      symptomDuration: "3 days",
      location: "Generalized",
      character: "Intermittent weakness with lightheadedness",
      severity: 5,
      associatedSymptoms: "No chest pain, no loss of consciousness",
      redFlag: false,
      summary:
        "Patient reports dizziness and fatigue for 3 days, moderate severity, no immediate red flags in seeded intake.",
    });
  }

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await db
    .insert(consents)
    .values({
      id: consentId,
      patientId,
      granteeId: doctorId,
      code: "JIVA-DEMO",
      durationMinutes: 120,
      expiresAt,
    })
    .onConflictDoNothing();

  const existingLogs = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .limit(1);

  if (existingLogs.length === 0) {
    await db.insert(auditLogs).values([
      {
        actorId: patientId,
        action: "UPLOAD",
        targetResourceId: labDocId,
        targetResourceType: "document",
        metadata: { source: "seed" },
        blockchainTxHash: "mock-chain-seed-001",
      },
      {
        actorId: patientId,
        action: "CONSENT_GRANTED",
        targetResourceId: consentId,
        targetResourceType: "consent",
        metadata: { code: "JIVA-DEMO", durationMinutes: 120 },
        blockchainTxHash: "mock-chain-seed-002",
      },
    ]);
  }

  const [patient] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, patientId));
  console.log(`Seed complete for ${patient?.name ?? "JivaHQ demo user"}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
