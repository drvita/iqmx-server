import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { apiError, parseBody } from "@/lib/api";
import { requireBotKeyAndResolveOrg } from "@/server/bot/auth";
import { getContactById } from "@/server/contacts";
import { getOrCreateContact, getOrCreateConversation } from "@/server/inbox/ingest";
import { SendError } from "@/server/inbox/send";
import {
  resolveApprovedTemplate,
  sendTemplate,
  TemplateError,
  templateErrorStatus,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** ID de la conversación en el CRM (opcional si se especifica phone o contactId). */
  conversationId: z.string().trim().optional(),
  /** ID del contacto en el CRM (opcional si se especifica conversationId o phone). */
  contactId: z.string().trim().optional(),
  /** Teléfono del destinatario con código de país (ej. +5215512345678). */
  phone: z.string().trim().optional(),
  /** Alias de phone para compatibilidad. */
  to: z.string().trim().optional(),

  /** ID interno de la plantilla en el CRM (ej. tpl_01H...). */
  templateId: z.string().trim().optional(),
  /** Nombre oficial de la plantilla en Meta (ej. seguimiento_cotizacion). */
  templateName: z.string().trim().optional(),
  /** Código de idioma de la plantilla (ej. es_MX). Por defecto es_MX. */
  language: z.string().trim().optional(),
  /** Línea telefónica de WhatsApp específica (opcional si hay múltiples líneas). */
  phoneNumberId: z.string().trim().optional(),

  /** Valores ordenados para las variables {{1}}..{{n}} de la plantilla. */
  variables: z.array(z.string().trim().max(500)).max(10).optional(),
  /** Variable única (para plantillas con una sola variable {{1}}). */
  variable: z.string().trim().max(500).optional(),

  /** Si es true, envía la plantilla incluso si un humano pausó la IA en la conversación. */
  force: z.boolean().optional().default(false),
});

export type BotTemplateRequestBody = z.infer<typeof bodySchema>;

/**
 * Envío de plantillas de WhatsApp desde un cerebro / bot externo (`/api/bot/messages/template`).
 * Autenticado mediante `X-API-Key`.
 *
 * Permite enviar plantillas fuera de la ventana de 24 h o iniciar conversaciones
 * proactivas especificando `conversationId`, `contactId` o `phone`.
 */
export async function POST(req: Request) {
  const auth = await requireBotKeyAndResolveOrg(req);
  if (!auth.ok) return auth.error;
  const { organizationId } = auth;

  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  const {
    conversationId,
    contactId,
    phone,
    to,
    templateId,
    templateName,
    language,
    phoneNumberId,
    variables,
    variable,
    force,
  } = body.data;

  // Validación de destino
  const targetPhone = phone ?? to;
  if (!conversationId && !contactId && !targetPhone) {
    return apiError(
      422,
      "invalid",
      "Debes especificar al menos un destino: 'conversationId', 'contactId' o 'phone'"
    );
  }

  // Validación de plantilla
  if (!templateId && !templateName) {
    return apiError(
      422,
      "invalid",
      "Debes especificar la plantilla mediante 'templateId' o 'templateName'"
    );
  }

  // 1. Resolver la plantilla aprobada en la organización
  let template: typeof schema.template.$inferSelect;
  try {
    template = await resolveApprovedTemplate(organizationId, {
      templateId,
      templateName,
      language,
      phoneNumberId,
    });
  } catch (err) {
    if (err instanceof TemplateError) {
      return apiError(templateErrorStatus(err), err.code, err.message);
    }
    throw err;
  }

  const db = getDb();
  let resolvedConvId: string | null = null;

  // 2. Resolver o crear la conversación
  if (conversationId) {
    const rows = await db
      .select({
        id: schema.conversation.id,
        aiEnabled: schema.conversation.aiEnabled,
        handoffAt: schema.conversation.handoffAt,
      })
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.organizationId, organizationId),
          eq(schema.conversation.id, conversationId)
        )
      )
      .limit(1);
    const conv = rows[0];
    if (!conv) return apiError(404, "not_found", "Conversación no encontrada");

    // Si un humano tomó la conversación y no se fuerza el envío, proteger al operador
    if (!force && (!conv.aiEnabled || conv.handoffAt)) {
      return apiError(
        409,
        "ai_paused",
        "La IA está en pausa en esta conversación (un humano tomó el control)"
      );
    }
    resolvedConvId = conv.id;
  } else if (contactId) {
    const contact = await getContactById(organizationId, contactId);
    if (!contact) return apiError(404, "not_found", "Contacto no encontrado");
    if (!contact.phone && !contact.waIdentity) {
      return apiError(
        422,
        "no_identity",
        "Este contacto no tiene teléfono ni identidad de WhatsApp"
      );
    }

    const conversation = await getOrCreateConversation(organizationId, contactId, {
      channel: contact.channel ?? "whatsapp",
      phoneNumberId: template.phoneNumberId,
    });
    resolvedConvId = conversation.id;
  } else if (targetPhone) {
    const { contact } = await getOrCreateContact(organizationId, targetPhone);
    const conversation = await getOrCreateConversation(organizationId, contact.id, {
      channel: "whatsapp",
      phoneNumberId: template.phoneNumberId,
    });
    resolvedConvId = conversation.id;
  }

  if (!resolvedConvId) {
    return apiError(500, "internal_error", "No se pudo resolver la conversación");
  }

  // 3. Preparar variables
  const finalVars =
    variables ?? (variable !== undefined ? [variable] : undefined);

  // 4. Enviar la plantilla
  try {
    const result = await sendTemplate({
      organizationId,
      conversationId: resolvedConvId,
      templateId: template.id,
      variables: finalVars,
    });

    return Response.json({
      ok: true,
      messageId: result.messageId,
      conversationId: resolvedConvId,
      templateId: template.id,
      phoneNumberId: template.phoneNumberId,
    });
  } catch (err) {
    if (err instanceof TemplateError) {
      return apiError(templateErrorStatus(err), err.code, err.message);
    }
    if (err instanceof SendError) {
      return apiError(403, err.code, err.message);
    }
    throw err;
  }
}
