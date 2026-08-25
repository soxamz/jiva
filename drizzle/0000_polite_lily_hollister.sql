CREATE TYPE "public"."consent_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('lab', 'rx', 'note', 'discharge', 'other');--> statement-breakpoint
CREATE TYPE "public"."intake_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('patient', 'doctor', 'responder', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'deceased');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(48) NOT NULL,
	"target_resource_id" varchar(160),
	"target_resource_type" varchar(80),
	"ip_address" varchar(80) DEFAULT 'demo-local' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"blockchain_tx_hash" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"grantee_id" uuid,
	"code" varchar(24) NOT NULL,
	"duration_minutes" integer DEFAULT 120 NOT NULL,
	"status" "consent_status" DEFAULT 'active' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"uploaded_by_id" uuid,
	"title" varchar(180) NOT NULL,
	"doc_type" "document_type" DEFAULT 'other' NOT NULL,
	"file_name" varchar(240) NOT NULL,
	"file_type" varchar(80) NOT NULL,
	"file_size_bytes" integer DEFAULT 0 NOT NULL,
	"mock_file_uri" text,
	"notes" text,
	"status" "document_status" DEFAULT 'processed' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"chief_complaint" text NOT NULL,
	"symptom_duration" varchar(120) NOT NULL,
	"location" varchar(160),
	"character" text,
	"severity" integer DEFAULT 5 NOT NULL,
	"aggravating_factors" text,
	"relieving_factors" text,
	"associated_symptoms" text,
	"red_flag" boolean DEFAULT false NOT NULL,
	"red_flag_reason" text,
	"summary" text NOT NULL,
	"status" "intake_status" DEFAULT 'submitted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blood_type" varchar(8) DEFAULT 'O+' NOT NULL,
	"allergies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"critical_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_medications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emergency_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structured_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_id" uuid NOT NULL,
	"extracted_json" jsonb NOT NULL,
	"abnormal_values" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_confidence_score" integer DEFAULT 82 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" DEFAULT 'patient' NOT NULL,
	"name" varchar(160) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"aadhaar_hash" varchar(128),
	"doctor_id" varchar(80),
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_grantee_id_users_id_fk" FOREIGN KEY ("grantee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_sessions" ADD CONSTRAINT "intake_sessions_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_profiles" ADD CONSTRAINT "medical_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_data" ADD CONSTRAINT "structured_data_doc_id_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "consents_code_idx" ON "consents" USING btree ("code");--> statement-breakpoint
CREATE INDEX "consents_patient_status_idx" ON "consents" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "consents_expires_at_idx" ON "consents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_uploaded_at_idx" ON "documents" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "intake_sessions_patient_idx" ON "intake_sessions" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "users_aadhaar_hash_idx" ON "users" USING btree ("aadhaar_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_doctor_id_idx" ON "users" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");