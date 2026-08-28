import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", [
  "patient",
  "doctor",
  "responder",
  "admin",
]);
export const userStatus = pgEnum("user_status", ["active", "deceased"]);
export const documentStatus = pgEnum("document_status", [
  "processing",
  "processed",
  "failed",
]);
export const documentType = pgEnum("document_type", [
  "lab",
  "rx",
  "note",
  "discharge",
  "other",
]);
export const consentStatus = pgEnum("consent_status", [
  "active",
  "revoked",
  "expired",
]);
export const intakeStatus = pgEnum("intake_status", ["draft", "submitted"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    role: userRole("role").notNull().default("patient"),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    aadhaarHash: varchar("aadhaar_hash", { length: 128 }),
    doctorId: varchar("doctor_id", { length: 80 }),
    shareToken: uuid("share_token"),
    status: userStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_phone_idx").on(table.phone),
    uniqueIndex("users_aadhaar_hash_idx").on(table.aadhaarHash),
    uniqueIndex("users_doctor_id_idx").on(table.doctorId),
    uniqueIndex("users_share_token_idx").on(table.shareToken),
    index("users_role_idx").on(table.role),
  ],
);

export const medicalProfiles = pgTable("medical_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bloodType: varchar("blood_type", { length: 8 }).notNull().default("O+"),
  allergies: jsonb("allergies")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  criticalConditions: jsonb("critical_conditions")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  currentMedications: jsonb("current_medications")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  emergencyContacts: jsonb("emergency_contacts")
    .$type<Array<{ name: string; relation: string; phone: string }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 180 }).notNull(),
    docType: documentType("doc_type").notNull().default("other"),
    fileName: varchar("file_name", { length: 240 }).notNull(),
    fileType: varchar("file_type", { length: 80 }).notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull().default(0),
    storageKey: varchar("storage_key", { length: 512 }),
    storageUrl: text("storage_url"),
    mockFileUri: text("mock_file_uri"),
    notes: text("notes"),
    status: documentStatus("status").notNull().default("processed"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("documents_user_idx").on(table.userId),
    index("documents_uploaded_at_idx").on(table.uploadedAt),
    uniqueIndex("documents_storage_key_idx").on(table.storageKey),
  ],
);

export const structuredData = pgTable("structured_data", {
  id: uuid("id").defaultRandom().primaryKey(),
  docId: uuid("doc_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  extractedJson: jsonb("extracted_json")
    .$type<Record<string, unknown>>()
    .notNull(),
  abnormalValues: jsonb("abnormal_values")
    .$type<
      Array<{
        label: string;
        value: string;
        severity: "low" | "medium" | "high";
      }>
    >()
    .notNull()
    .default(sql`'[]'::jsonb`),
  aiConfidenceScore: integer("ai_confidence_score").notNull().default(82),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    granteeId: uuid("grantee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    code: varchar("code", { length: 24 }).notNull(),
    durationMinutes: integer("duration_minutes").default(120),
    status: consentStatus("status").notNull().default("active"),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastAuthenticatedAt: timestamp("last_authenticated_at", {
      withTimezone: true,
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("consents_code_idx").on(table.code),
    index("consents_patient_status_idx").on(table.patientId, table.status),
    index("consents_patient_grantee_status_idx").on(
      table.patientId,
      table.granteeId,
      table.status,
    ),
    index("consents_expires_at_idx").on(table.expiresAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 48 }).notNull(),
    targetResourceId: varchar("target_resource_id", { length: 160 }),
    targetResourceType: varchar("target_resource_type", { length: 80 }),
    ipAddress: varchar("ip_address", { length: 80 })
      .notNull()
      .default("demo-local"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    blockchainTxHash: varchar("blockchain_tx_hash", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

export const intakeSessions = pgTable(
  "intake_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chiefComplaint: text("chief_complaint").notNull(),
    symptomDuration: varchar("symptom_duration", { length: 120 }).notNull(),
    location: varchar("location", { length: 160 }),
    character: text("character"),
    severity: integer("severity").notNull().default(5),
    aggravatingFactors: text("aggravating_factors"),
    relievingFactors: text("relieving_factors"),
    associatedSymptoms: text("associated_symptoms"),
    redFlag: boolean("red_flag").notNull().default(false),
    redFlagReason: text("red_flag_reason"),
    summary: text("summary").notNull(),
    aiSessionId: varchar("ai_session_id", { length: 64 }),
    patientHistory: jsonb("patient_history").$type<Record<string, unknown>>(),
    physicianSummary:
      jsonb("physician_summary").$type<Record<string, unknown>>(),
    clinicalSummary: jsonb("clinical_summary").$type<Record<string, unknown>>(),
    redFlagDetails: jsonb("red_flag_details")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: intakeStatus("status").notNull().default("submitted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("intake_sessions_patient_idx").on(table.patientId),
    uniqueIndex("intake_sessions_ai_session_idx").on(table.aiSessionId),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  profile: one(medicalProfiles),
  documents: many(documents),
  consentsGranted: many(consents, { relationName: "patientConsents" }),
  consentsReceived: many(consents, { relationName: "granteeConsents" }),
  intakeSessions: many(intakeSessions),
}));

export const medicalProfilesRelations = relations(
  medicalProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [medicalProfiles.userId],
      references: [users.id],
    }),
  }),
);

export const documentsRelations = relations(documents, ({ one }) => ({
  patient: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  structuredData: one(structuredData),
}));

export const structuredDataRelations = relations(structuredData, ({ one }) => ({
  document: one(documents, {
    fields: [structuredData.docId],
    references: [documents.id],
  }),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  patient: one(users, {
    fields: [consents.patientId],
    references: [users.id],
    relationName: "patientConsents",
  }),
  grantee: one(users, {
    fields: [consents.granteeId],
    references: [users.id],
    relationName: "granteeConsents",
  }),
}));

export const intakeSessionsRelations = relations(intakeSessions, ({ one }) => ({
  patient: one(users, {
    fields: [intakeSessions.patientId],
    references: [users.id],
  }),
}));
