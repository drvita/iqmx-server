CREATE TABLE "storage_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"endpoint" text NOT NULL,
	"bucket_name" text NOT NULL,
	"region" text DEFAULT 'auto' NOT NULL,
	"access_key_id" text NOT NULL,
	"secret_key_cipher" text NOT NULL,
	"secret_key_iv" text NOT NULL,
	"secret_key_tag" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storage_credentials" ADD CONSTRAINT "storage_credentials_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "storage_credentials_org_uq" ON "storage_credentials" USING btree ("organization_id");