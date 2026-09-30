ALTER TABLE "agent_profile" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "timezone" text DEFAULT 'America/Mexico_City' NOT NULL;