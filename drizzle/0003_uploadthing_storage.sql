ALTER TABLE "documents" ADD COLUMN "storage_key" varchar(512);--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "storage_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_storage_key_idx" ON "documents" USING btree ("storage_key");
