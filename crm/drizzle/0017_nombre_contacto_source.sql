-- 003/#51 - De dónde viene el nombre de un contacto.
--
-- `perfil` = lo trajo WhatsApp y se mantiene al día solo.
-- `manual` = lo escribió una persona en el CRM y no se pisa nunca.
--
-- Las filas que ya existían quedan en 'perfil' a propósito para mantener
-- al día los contactos generados por el webhook. En cuanto un operador
-- edita un nombre manualmente, queda marcado como 'manual' de forma permanente.
ALTER TABLE "contact" ADD COLUMN "name_source" text DEFAULT 'perfil' NOT NULL;
