-- 0019 - Asistentes IA dedicados para Facebook Messenger e Instagram Direct
--
-- Agrega columnas assistant_id y ai_enabled a las credenciales de Instagram
-- y Messenger para permitir asociar un asistente conversacional específico y
-- controlar si la IA atiende en cada una de estas redes.

ALTER TABLE "instagram_credentials" ADD COLUMN IF NOT EXISTS "ai_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "instagram_credentials" ADD COLUMN IF NOT EXISTS "assistant_id" text REFERENCES "agent_profile"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "messenger_credentials" ADD COLUMN IF NOT EXISTS "ai_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "messenger_credentials" ADD COLUMN IF NOT EXISTS "assistant_id" text REFERENCES "agent_profile"("id") ON DELETE SET NULL;
