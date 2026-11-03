CREATE TABLE "ai_usage_monthly" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"month" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_monthly" ADD CONSTRAINT "ai_usage_monthly_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_monthly_org_month_uq" ON "ai_usage_monthly" USING btree ("organization_id","month");--> statement-breakpoint
CREATE INDEX "ai_usage_monthly_org_idx" ON "ai_usage_monthly" USING btree ("organization_id");