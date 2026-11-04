CREATE TABLE "conversation_note" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"author_user_id" text,
	"texto" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quick_reply" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"atajo" text NOT NULL,
	"texto" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_note" ADD CONSTRAINT "conversation_note_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_note" ADD CONSTRAINT "conversation_note_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "crm"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_note" ADD CONSTRAINT "conversation_note_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "crm"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_reply" ADD CONSTRAINT "quick_reply_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_note_conv_idx" ON "conversation_note" USING btree ("organization_id","conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quick_reply_org_atajo_uq" ON "quick_reply" USING btree ("organization_id","atajo");