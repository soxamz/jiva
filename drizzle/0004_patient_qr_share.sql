ALTER TABLE "consents" ALTER COLUMN "duration_minutes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consents" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN "last_authenticated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "share_token" uuid;--> statement-breakpoint
UPDATE "users"
SET "share_token" = gen_random_uuid()
WHERE "role" = 'patient' AND "share_token" IS NULL;--> statement-breakpoint
UPDATE "consents"
SET "last_authenticated_at" = "granted_at"
WHERE "last_authenticated_at" IS NULL;--> statement-breakpoint
WITH ranked_active_consents AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "patient_id", "grantee_id"
      ORDER BY "granted_at" DESC, "id" DESC
    ) AS position
  FROM "consents"
  WHERE "status" = 'active' AND "grantee_id" IS NOT NULL
)
UPDATE "consents"
SET "status" = 'revoked', "revoked_at" = now()
FROM ranked_active_consents
WHERE "consents"."id" = ranked_active_consents."id"
  AND ranked_active_consents.position > 1;--> statement-breakpoint
CREATE INDEX "consents_patient_grantee_status_idx" ON "consents" USING btree ("patient_id","grantee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "consents_active_patient_grantee_idx"
ON "consents" USING btree ("patient_id", "grantee_id")
WHERE "status" = 'active' AND "grantee_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_share_token_idx" ON "users" USING btree ("share_token");
