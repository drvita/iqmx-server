ALTER TABLE "media_asset" ADD COLUMN "ai_transcript" text;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "ai_description" text;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "ai_processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "ai_stt_model" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "ai_vision_model" text;