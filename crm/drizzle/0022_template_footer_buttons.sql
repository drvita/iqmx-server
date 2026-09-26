-- 0022 - Soporte para Footer y Botones en Plantillas de WhatsApp
--
-- Agrega columnas footer (texto hasta 60 caracteres) y buttons (jsonb array)
-- a la tabla template para soportar componentes de Meta Graph API.

ALTER TABLE "crm"."template" ADD COLUMN IF NOT EXISTS "footer" text;
--> statement-breakpoint
ALTER TABLE "crm"."template" ADD COLUMN IF NOT EXISTS "buttons" jsonb DEFAULT '[]'::jsonb;
