import { z } from "zod";
import { count, eq } from "drizzle-orm";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { IMPORT_MAX_ROWS, prepareImport } from "@/lib/contact-import";
import { importContacts } from "@/server/contacts-import";
import { getOrganizationSettings } from "@/server/settings/service";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().max(200),
        phone: z.string().max(40),
      })
    )
    .min(1)
    .max(IMPORT_MAX_ROWS),
  /** El agente no les responde: los atiende el dueño. */
  aiPaused: z.boolean().optional(),
});

/**
 * Importación de contactos en lote (CSV leído en el navegador).
 *
 * El navegador ya validó para enseñar la vista previa, pero aquí se valida
 * otra vez con la MISMA función: lo que llega por la red no es de fiar, y un
 * teléfono sin código de país crearía un contacto que nunca casa con quien
 * escriba después.
 *
 * Multi-tenant: Valida límite de contactos contratados (`maxContacts`).
 */
export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, importSchema);
  if (!body.ok) return body.response;

  const { valid, problems } = prepareImport(body.data.contacts);
  if (valid.length === 0) {
    return apiError(
      422,
      "nothing_to_import",
      "Ningún renglón trae un teléfono válido con código de país"
    );
  }

  // Validación de límites de membresía multi-tenant
  const settings = await getOrganizationSettings(session.organizationId);
  const db = getDb();
  const [row] = await db
    .select({ total: count() })
    .from(schema.contact)
    .where(eq(schema.contact.organizationId, session.organizationId));
  const currentCount = Number(row?.total ?? 0);

  if (currentCount >= settings.maxContacts) {
    return apiError(
      403,
      "quota_exceeded",
      `Has alcanzado el límite de ${settings.maxContacts} contactos permitidos por tu membresía.`
    );
  }

  // Si intentan importar más de los que caben en el margen restante:
  const margen = settings.maxContacts - currentCount;
  if (valid.length > margen) {
    return apiError(
      403,
      "quota_exceeded",
      `Tu membresía permite ${settings.maxContacts} contactos y tienes ${currentCount}. Solo puedes importar hasta ${margen} contactos nuevos.`
    );
  }

  const result = await importContacts(session.organizationId, valid, {
    aiPaused: body.data.aiPaused ?? false,
  });
  return Response.json({ ...result, skipped: problems });
});
