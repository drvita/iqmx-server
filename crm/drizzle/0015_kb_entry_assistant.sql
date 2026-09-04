ALTER TABLE "kb_entry" ADD COLUMN IF NOT EXISTS "assistant_id" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kb_entry_assistant_id_agent_profile_id_fk'
  ) THEN
    ALTER TABLE "kb_entry" ADD CONSTRAINT "kb_entry_assistant_id_agent_profile_id_fk"
      FOREIGN KEY ("assistant_id") REFERENCES "crm"."agent_profile"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_assistant_idx" ON "kb_entry" USING btree ("assistant_id");
--> statement-breakpoint
-- Asignar entradas previas sin asistente al asistente predeterminado de cada organización
UPDATE "kb_entry" kb
SET "assistant_id" = ap.id
FROM (
  SELECT id, organization_id
  FROM "agent_profile"
  WHERE is_default = true AND type = 'conversational'
) ap
WHERE kb."assistant_id" IS NULL AND kb."organization_id" = ap.organization_id;
--> statement-breakpoint
-- Si aún quedan sin asistente porque no había uno default marcado, tomar el primer asistente conversacional creado
UPDATE "kb_entry" kb
SET "assistant_id" = ap.id
FROM (
  SELECT DISTINCT ON (organization_id) id, organization_id
  FROM "agent_profile"
  WHERE type = 'conversational'
  ORDER BY organization_id, created_at ASC
) ap
WHERE kb."assistant_id" IS NULL AND kb."organization_id" = ap.organization_id;
