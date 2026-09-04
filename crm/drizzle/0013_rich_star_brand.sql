CREATE TABLE "member_phone_access" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text NOT NULL,
	"module" text NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "agent_profile_org_uq";--> statement-breakpoint
DROP INDEX "conversation_org_contact_real_uq";--> statement-breakpoint
DROP INDEX "meta_credentials_org_uq";--> statement-breakpoint
ALTER TABLE "agent_profile" ADD COLUMN "type" text DEFAULT 'conversational' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_profile" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_profile" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "phone_number_id" text;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "ai_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "assistant_id" text;--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD COLUMN "signup_method" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "member_phone_access" ADD CONSTRAINT "member_phone_access_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_phone_access" ADD CONSTRAINT "member_phone_access_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "crm"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_phone_access_uq" ON "member_phone_access" USING btree ("organization_id","member_id","phone_number_id");--> statement-breakpoint
CREATE INDEX "member_phone_access_org_idx" ON "member_phone_access" USING btree ("organization_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_perm_org_role_mod_uq" ON "role_permission" USING btree ("organization_id","role","module");--> statement-breakpoint
CREATE INDEX "role_perm_org_idx" ON "role_permission" USING btree ("organization_id","role");--> statement-breakpoint
ALTER TABLE "meta_credentials" ADD CONSTRAINT "meta_credentials_assistant_id_agent_profile_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "crm"."agent_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_profile_org_idx" ON "agent_profile" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_org_contact_phone_real_uq" ON "conversation" USING btree ("organization_id","contact_id",coalesce("phone_number_id", '')) WHERE "conversation"."is_test" = false;--> statement-breakpoint
CREATE INDEX "conversation_org_phone_idx" ON "conversation" USING btree ("organization_id","phone_number_id");--> statement-breakpoint
CREATE INDEX "meta_credentials_org_idx" ON "meta_credentials" USING btree ("organization_id");