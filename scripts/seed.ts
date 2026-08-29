import { neon } from "@neondatabase/serverless";
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
import { demoCredentials } from "@/lib/demo-credentials";
import { hashIdentifier } from "@/lib/identity";

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

async function resetApplicationData() {
  // Delete child rows explicitly so audited access logs do not survive the reset.
  await db.delete(auditLogs);
  await db.delete(consents);
  await db.delete(structuredData);
  await db.delete(documents);
  await db.delete(intakeSessions);
  await db.delete(medicalProfiles);
  await db.delete(users);
}

async function main() {
  await resetApplicationData();

  await db.insert(users).values([
    {
      id: patientId,
      role: "patient",
      name: "Aarav Sharma",
      phone: "9876543210",
      aadhaarHash: hashIdentifier(demoCredentials.patient.identifier),
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
  ]);

  await db.insert(medicalProfiles).values({
    userId: patientId,
    bloodType: "B+",
    allergies: ["Penicillin"],
    criticalConditions: ["Type 2 Diabetes"],
    currentMedications: ["Metformin 500mg"],
    emergencyContacts: [
      { name: "Nisha Sharma", relation: "Spouse", phone: "9876500000" },
    ],
  });

  console.log("Database reset complete. Seeded 1 demo patient and 1 demo doctor.");
  console.log(`Patient Aadhaar: ${demoCredentials.patient.identifier}`);
  console.log(`Doctor Aadhaar: ${demoCredentials.doctor.identifier}`);
  console.log(`Demo OTP: ${demoCredentials.patient.otp}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
