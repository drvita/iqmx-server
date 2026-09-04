ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "external_customer_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organization_external_customer_idx" ON "organization" USING btree ("external_customer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"agenda_enabled" boolean DEFAULT false NOT NULL,
	"attribution_enabled" boolean DEFAULT false NOT NULL,
	"channels" text DEFAULT 'whatsapp' NOT NULL,
	"max_whatsapp_accounts" integer DEFAULT 1 NOT NULL,
	"max_team_members" integer DEFAULT 2 NOT NULL,
	"max_contacts" integer DEFAULT 100 NOT NULL,
	"max_tokens_in" integer DEFAULT 50000 NOT NULL,
	"max_tokens_out" integer DEFAULT 20000 NOT NULL,
	"ai_enabled" boolean DEFAULT true NOT NULL,
	"lab_enabled" boolean DEFAULT false NOT NULL,
	"tasks_enabled" boolean DEFAULT false NOT NULL,
	"ai_api_key_encrypted" text,
	"ai_model" text DEFAULT 'anthropic/claude-sonnet-4.5',
	"ai_judge_model" text,
	"ai_base_url" text DEFAULT 'https://openrouter.ai/api',
	"agent_coalesce_ms" integer DEFAULT 6000 NOT NULL,
	"bot_api_key" text,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_settings" DROP CONSTRAINT IF EXISTS "organization_settings_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_settings_org_uq" ON "organization_settings" USING btree ("organization_id");
