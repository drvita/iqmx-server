-- 016 Laboratorio Multi-Tenant, Auditoría en Vivo y Escenarios de Prueba
--
-- Editada a mano sobre la generada para ser RE-EJECUTABLE e IDEMPOTENTE (Constitución IV):
-- IF NOT EXISTS en tablas, columnas e índices, y DO-block en cada clave foránea.
--
-- Es puramente ADITIVA: no toca ninguna tabla existente de forma destructiva,
-- protegiendo los datos existentes en entornos de desarrollo y producción.

CREATE TABLE IF NOT EXISTS "lab_scenario" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"test_type" text DEFAULT 'sandbox' NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"synthetic_phone" text NOT NULL,
	"contact_name" text NOT NULL,
	"script" jsonb NOT NULL,
	"expected_outcome" jsonb,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lab_suite_config" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"enabled_suites" jsonb DEFAULT '["sandbox", "live_audit"]'::jsonb NOT NULL,
	"default_audit_sample_size" integer DEFAULT 10 NOT NULL,
	"last_generated_at" timestamp,
	"judge_model_override" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_test_run" ADD COLUMN IF NOT EXISTS "test_type" text DEFAULT 'sandbox' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent_test_run" ADD COLUMN IF NOT EXISTS "suite_name" text;
--> statement-breakpoint
ALTER TABLE "agent_test_run" ADD COLUMN IF NOT EXISTS "assistant_id" text;
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "last_judged_at" timestamp;
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "assistant_id" text;
--> statement-breakpoint
ALTER TABLE "lab_scenario" ADD COLUMN IF NOT EXISTS "assistant_id" text;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "conversation" ADD CONSTRAINT "conversation_assistant_id_agent_profile_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "crm"."agent_profile"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "agent_test_run" ADD CONSTRAINT "agent_test_run_assistant_id_agent_profile_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "crm"."agent_profile"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "lab_scenario" ADD CONSTRAINT "lab_scenario_assistant_id_agent_profile_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "crm"."agent_profile"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "lab_scenario" ADD CONSTRAINT "lab_scenario_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "lab_suite_config" ADD CONSTRAINT "lab_suite_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lab_scenario_org_type_idx" ON "lab_scenario" USING btree ("organization_id","test_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lab_scenario_org_asst_idx" ON "lab_scenario" USING btree ("organization_id","assistant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lab_scenario_org_key_uq" ON "lab_scenario" USING btree ("organization_id","key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lab_suite_config_org_uq" ON "lab_suite_config" USING btree ("organization_id");