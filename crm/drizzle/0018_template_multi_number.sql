-- 018 - Soporte Multi-Número y Multi-WABA para Plantillas de WhatsApp
--
-- Vincula explícitamente cada plantilla a su línea telefónica (phone_number_id)
-- y WABA de Meta (waba_id), permitiendo que organizaciones con múltiples números
-- gestionen y envíen plantillas correspondientes a la cuenta autorizada.

ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "phone_number_id" text;
--> statement-breakpoint
ALTER TABLE "template" ADD COLUMN IF NOT EXISTS "waba_id" text;
--> statement-breakpoint

-- Población de datos retroactiva para instancias existentes con plantillas previas
UPDATE "template" t
SET "phone_number_id" = mc."phone_number_id",
    "waba_id" = mc."waba_id"
FROM "meta_credentials" mc
WHERE t."phone_number_id" IS NULL
  AND mc."organization_id" = t."organization_id";
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "template_org_phone_idx" ON "template" USING btree ("organization_id", "phone_number_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_org_waba_idx" ON "template" USING btree ("organization_id", "waba_id");
--> statement-breakpoint

DROP INDEX IF EXISTS "template_org_name_lang_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "template_org_waba_name_lang_uq" ON "template" USING btree ("organization_id", COALESCE("waba_id", ''), "name", "language");
