ALTER TABLE "intake_sessions" ADD COLUMN "ai_session_id" varchar(64);--> statement-breakpoint
ALTER TABLE "intake_sessions" ADD COLUMN "patient_history" jsonb;--> statement-breakpoint
ALTER TABLE "intake_sessions" ADD COLUMN "physician_summary" jsonb;--> statement-breakpoint
ALTER TABLE "intake_sessions" ADD COLUMN "red_flag_details" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "intake_sessions_ai_session_idx" ON "intake_sessions" USING btree ("ai_session_id");