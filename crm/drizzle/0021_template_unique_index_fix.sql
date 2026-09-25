-- 0021 - Corregir índice único en plantilla para permitir ON CONFLICT en Postgres
--
-- Postgres requiere que el target de ON CONFLICT coincida exactamente con las columnas
-- del índice. Al haber tenido COALESCE(waba_id, ''), infer_arbiter_indexes fallaba con 42P10.

DROP INDEX IF EXISTS "template_org_waba_name_lang_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "template_org_waba_name_lang_uq" ON "template" USING btree ("organization_id", "waba_id", "name", "language");
