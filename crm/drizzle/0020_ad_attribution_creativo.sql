-- 0020 - Imagen del creativo para el anuncio de origen de Meta (CTWA)
--
-- Agrega columna image_asset_id a ad_attribution con clave foránea a media_asset,
-- e índice compuesto (organization_id, source_id) para consulta rápida del creativo.

ALTER TABLE "ad_attribution" ADD COLUMN IF NOT EXISTS "image_asset_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ad_attribution" ADD CONSTRAINT "ad_attribution_image_asset_id_media_asset_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "crm"."media_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_attribution_org_source_idx" ON "ad_attribution" USING btree ("organization_id","source_id");
