import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import type { Channel } from "@/lib/channels";
import type { LossReason } from "@/lib/types";
import { countVariables, sendTemplate, TemplateError } from "@/server/whatsapp/templates";
import { getOrCreateConversation } from "@/server/inbox/ingest";
import { isWithinSevenDaysWindow } from "@/server/inbox/window";

export type BroadcastAudienceFilter = {
  stageId: string;
  lossReason?: LossReason | "all" | null;
};

export type BroadcastRecipient = {
  leadId: string;
  contactId: string;
  name: string;
  phone: string | null;
  waIdentity: string;
  channel: Channel;
  conversationId: string | null;
  lastInboundAt: Date | null;
  lossReason: LossReason | null;
};

/**
 * Obtiene los prospectos de una etapa específica del pipeline para difusión.
 * Si la etapa es de tipo perdida ('lost') y se especifica un lossReason distinto de 'all',
 * filtra únicamente a los leads cuyo último movimiento a perdido coincide con dicho motivo.
 */
export async function getStageBroadcastAudience(
  organizationId: string,
  filter: BroadcastAudienceFilter
): Promise<{
  stage: { id: string; name: string; kind: "open" | "won" | "lost" };
  recipients: BroadcastRecipient[];
}> {
  const db = getDb();

  // Validar existencia de la etapa
  const stages = await db
    .select({
      id: schema.pipelineStage.id,
      name: schema.pipelineStage.name,
      kind: schema.pipelineStage.kind,
    })
    .from(schema.pipelineStage)
    .where(
      scoped(
        schema.pipelineStage.organizationId,
        organizationId,
        eq(schema.pipelineStage.id, filter.stageId)
      )
    )
    .limit(1);

  const stage = stages[0];
  if (!stage) {
    throw new Error("Etapa no encontrada");
  }

  // Consulta de leads en la etapa con sus contactos y datos de conversación (excluyendo contactos archivados)
  const rows = await db
    .select({
      leadId: schema.lead.id,
      contactId: schema.contact.id,
      name: schema.contact.name,
      phone: schema.contact.phone,
      waIdentity: schema.contact.waIdentity,
      channel: schema.contact.channel,
      conversationId: schema.conversation.id,
      lastInboundAt: schema.conversation.lastInboundAt,
      // Subconsulta para obtener el motivo de pérdida más reciente si aplica
      lastLossReason: sql<string | null>`(
        select lse."loss_reason"
        from "lead_stage_event" lse
        where lse."organization_id" = ${schema.lead.organizationId}
          and lse."lead_id" = ${schema.lead.id}
          and lse."to_stage_id" = ${schema.lead.stageId}
        order by lse."occurred_at" desc, lse."created_at" desc
        limit 1
      )`,
    })
    .from(schema.lead)
    .innerJoin(schema.contact, eq(schema.contact.id, schema.lead.contactId))
    .leftJoin(
      schema.conversation,
      and(
        eq(schema.conversation.organizationId, schema.lead.organizationId),
        eq(schema.conversation.contactId, schema.lead.contactId),
        eq(schema.conversation.isTest, false)
      )
    )
    .where(
      scoped(
        schema.lead.organizationId,
        organizationId,
        eq(schema.lead.stageId, filter.stageId),
        isNull(schema.contact.archivedAt)
      )
    )
    .orderBy(desc(schema.lead.lastActivityAt), desc(schema.lead.createdAt));

  let recipients: BroadcastRecipient[] = rows.map((r) => ({
    leadId: r.leadId,
    contactId: r.contactId,
    name: r.name,
    phone: r.phone,
    waIdentity: r.waIdentity,
    channel: (r.channel as Channel) || "whatsapp",
    conversationId: r.conversationId,
    lastInboundAt: r.lastInboundAt,
    lossReason: (r.lastLossReason as LossReason) ?? null,
  }));

  // Si la etapa es de tipo 'lost' y se especificó un filtro de motivo concreto
  if (stage.kind === "lost" && filter.lossReason && filter.lossReason !== "all") {
    recipients = recipients.filter((r) => r.lossReason === filter.lossReason);
  }

  return { stage, recipients };
}

export type BroadcastSendResult = {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: { contactName: string; reason: string }[];
};

/**
 * Despacha el envío masivo secuencial con control de tasa y manejo individual de errores.
 * Admite reemplazo dinámico de variables: `{{nombre}}` o `{{1}} = "[nombre]"` se sustituye
 * por el primer nombre del contacto si el usuario así lo configuró.
 * Omnicanal: contactos en WhatsApp reciben la plantilla oficial de Meta; contactos en
 * Messenger o Instagram reciben el texto de la plantilla renderizado, siempre que se
 * encuentren dentro de la ventana permitida de 7 días.
 */
export async function executeStageBroadcast(input: {
  organizationId: string;
  stageId: string;
  lossReason?: LossReason | "all" | null;
  templateId: string;
  variableMappings?: string[]; // ej: ["{{nombre}}", "20% OFF"]
  delayMs?: number;
}): Promise<BroadcastSendResult> {
  const db = getDb();

  // Verificar la plantilla aprobada
  const templates = await db
    .select()
    .from(schema.template)
    .where(
      scoped(
        schema.template.organizationId,
        input.organizationId,
        eq(schema.template.id, input.templateId)
      )
    )
    .limit(1);

  const template = templates[0];
  if (!template) throw new TemplateError("not_found", "Plantilla no encontrada");
  if (template.status !== "approved") {
    throw new TemplateError("invalid", "Solo se pueden enviar plantillas aprobadas");
  }

  const { recipients } = await getStageBroadcastAudience(input.organizationId, {
    stageId: input.stageId,
    lossReason: input.lossReason,
  });

  const varCount = countVariables(template.body);
  const delay = Math.max(80, input.delayMs ?? 150); // mínimo 80ms entre envíos para cuidar rate limits

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: { contactName: string; reason: string }[] = [];

  for (const recipient of recipients) {
    // 1. Validaciones por canal antes de intentar el envío
    if (recipient.channel === "whatsapp") {
      // Si no tiene teléfono ni identidad para WhatsApp, omitir
      if (!recipient.phone && !recipient.waIdentity) {
        skipped++;
        continue;
      }
    } else if (
      recipient.channel === "messenger" ||
      recipient.channel === "instagram"
    ) {
      // Messenger / Instagram requieren haber tenido interacción en los últimos 7 días (HUMAN_AGENT tag)
      if (!isWithinSevenDaysWindow(recipient.lastInboundAt)) {
        skipped++;
        errors.push({
          contactName: recipient.name,
          reason: `Fuera de la ventana de 7 días de ${recipient.channel === "messenger" ? "Facebook Messenger" : "Instagram"}`,
        });
        continue;
      }
    }

    try {
      // 2. Obtener o crear conversación real respetando el canal del contacto
      let conversationId = recipient.conversationId;
      if (!conversationId) {
        const conv = await getOrCreateConversation(
          input.organizationId,
          recipient.contactId,
          { channel: recipient.channel }
        );
        conversationId = conv.id;
      }

      // 3. Resolver variables personalizadas por contacto
      const firstName = recipient.name.trim().split(/\s+/)[0] || "Cliente";
      const resolvedVariables: string[] = [];

      for (let i = 0; i < varCount; i++) {
        const rawMapping = input.variableMappings?.[i] || "";
        if (
          rawMapping.toLowerCase() === "{{nombre}}" ||
          rawMapping.toLowerCase() === "[nombre]" ||
          rawMapping.toLowerCase() === "nombre"
        ) {
          resolvedVariables.push(firstName);
        } else if (
          rawMapping.toLowerCase() === "{{nombre_completo}}" ||
          rawMapping.toLowerCase() === "[nombre_completo]"
        ) {
          resolvedVariables.push(recipient.name);
        } else {
          resolvedVariables.push(rawMapping || " ");
        }
      }

      // 4. Enviar plantilla (sendTemplate redirige a texto renderizado si es messenger/instagram)
      await sendTemplate({
        organizationId: input.organizationId,
        conversationId,
        templateId: template.id,
        variables: resolvedVariables,
      });

      sent++;

      // Retardo seguro entre llamadas sucesivas a Meta
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (err: unknown) {
      failed++;
      const message = err instanceof Error ? err.message : "Error desconocido";
      errors.push({
        contactName: recipient.name,
        reason: message,
      });
    }
  }

  return {
    total: recipients.length,
    sent,
    failed,
    skipped,
    errors: errors.slice(0, 20), // primeros 20 errores de muestra
  };
}
