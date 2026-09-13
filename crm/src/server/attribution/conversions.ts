import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import {
  getOrLinkWabaDataset,
  sendBusinessMessagingEvent,
} from "@/lib/meta/capi";
import {
  getCredentialsByOrg,
  getCredentialsByPhoneNumberId,
} from "@/server/whatsapp/credentials";
import { isAtribucionEnabled } from "@/server/attribution/flag";
import { getCapiSettings } from "@/server/attribution/settings";
import { getAttributionForConversation } from "@/server/attribution/store";
import { DEFAULT_CURRENCY } from "@/lib/money";

/**
 * 016 — Reporte de conversiones a Meta.
 *
 * Tres reglas duras, y ninguna es opcional:
 *
 * 1. **Dedup en la base**, no en el código: la fila se inserta ANTES de hablar
 *    con Meta, con `ON CONFLICT DO NOTHING` sobre (org, conversación, evento).
 *    A Meta no se le puede des-enviar una compra.
 * 2. **Best-effort absoluto**: nada de lo que pase aquí —Meta caído, token
 *    vencido, dataset sin configurar— puede impedir que el lead se mueva de
 *    etapa. Se registra el desenlace y se sigue.
 * 3. **Todo intento deja rastro**: `sent`, `failed` o `skipped` con el motivo
 *    escrito. Las filas `skipped` son la respuesta a "¿por qué este lead no
 *    aparece en Meta?", que sin ellas se contesta adivinando.
 */

/** Los dos eventos que Vocero emite (nombres del catálogo de Meta, tal cual). */
export const QUALIFIED_EVENT = "QualifiedLead";
export const PURCHASE_EVENT = "Purchase";

const NO_CLID_REASON =
  "sin ctwa_clid: la conversación no vino de un anuncio de WhatsApp";
const NOT_CONFIGURED_REASON =
  "atribución no configurada: falta el dataset de Meta o la conexión de WhatsApp";

type EmitOutcome = "sent" | "failed" | "skipped" | "dedup" | "error";

/**
 * Reporta un evento de una conversación. Público para que un fork pueda emitir
 * los suyos (p. ej. el espejo `InitiateCheckout` que documenta la guía) sin
 * reimplementar el dedup ni el manejo del acuse.
 */
export async function emitConversion(
  organizationId: string,
  conversationId: string,
  eventName: string,
  customData?: Record<string, unknown>
): Promise<EmitOutcome> {
  try {
    const db = getDb();

    // Dedup atómico: si ya existe ese evento para esta conversación, no-op.
    const inserted = await db
      .insert(schema.conversionEvent)
      .values({
        id: newId("conversionEvent"),
        organizationId,
        conversationId,
        eventName,
      })
      .onConflictDoNothing({
        target: [
          schema.conversionEvent.organizationId,
          schema.conversionEvent.conversationId,
          schema.conversionEvent.eventName,
        ],
      })
      .returning();

    const event = inserted[0];
    if (!event) return "dedup";

    const attribution = await getAttributionForConversation(
      organizationId,
      conversationId
    );
    const settings = await getCapiSettings(organizationId);

    // Resolver la línea de WhatsApp que atendió la conversación
    const convRows = await db
      .select({ phoneNumberId: schema.conversation.phoneNumberId })
      .from(schema.conversation)
      .where(
        and(
          scoped(schema.conversation.organizationId, organizationId),
          eq(schema.conversation.id, conversationId)
        )
      )
      .limit(1);

    const conv = convRows[0];
    let credentials = conv?.phoneNumberId
      ? await getCredentialsByPhoneNumberId(conv.phoneNumberId)
      : null;
    if (!credentials) {
      credentials = await getCredentialsByOrg(organizationId);
    }

    if (!attribution?.ctwaClid || !settings || !credentials) {
      await db
        .update(schema.conversionEvent)
        .set({
          status: "skipped",
          attributionId: attribution?.id ?? null,
          error: !attribution?.ctwaClid ? NO_CLID_REASON : NOT_CONFIGURED_REASON,
        })
        .where(eq(schema.conversionEvent.id, event.id));
      return "skipped";
    }

    // Resolver dataset vinculado a la WABA específica de esta conversación
    let targetDatasetId = settings.datasetId;
    if (credentials.wabaId) {
      const wabaDataset = await getOrLinkWabaDataset({
        wabaId: credentials.wabaId,
        token: credentials.token,
        fallbackToken: settings.token,
      });
      if (wabaDataset?.id) {
        targetDatasetId = wabaDataset.id;
      }
    }

    try {
      const primaryToken = settings.token || credentials.token;
      let ack;
      try {
        ack = await sendBusinessMessagingEvent({
          datasetId: targetDatasetId,
          token: primaryToken,
          event: {
            eventName,
            eventTime: Math.floor(Date.now() / 1000),
            ctwaClid: attribution.ctwaClid,
            wabaId: credentials.wabaId,
            customData,
          },
        });
      } catch (primaryErr) {
        if (credentials.token && credentials.token !== primaryToken) {
          ack = await sendBusinessMessagingEvent({
            datasetId: targetDatasetId,
            token: credentials.token,
            event: {
              eventName,
              eventTime: Math.floor(Date.now() / 1000),
              ctwaClid: attribution.ctwaClid,
              wabaId: credentials.wabaId,
              customData,
            },
          });
        } else {
          throw primaryErr;
        }
      }
      await db
        .update(schema.conversionEvent)
        .set({
          status: "sent",
          attributionId: attribution.id,
          sentAt: new Date(),
          fbTraceId: ack.fbTraceId,
          error: null,
        })
        .where(eq(schema.conversionEvent.id, event.id));
      return "sent";
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await db
        .update(schema.conversionEvent)
        .set({
          status: "failed",
          attributionId: attribution.id,
          error: errorMsg,
        })
        .where(eq(schema.conversionEvent.id, event.id));
      console.warn(
        `[capi] fallo al reportar ${eventName} de ${conversationId}: ${errorMsg}`
      );
      if (err && typeof err === "object" && "details" in err) {
        console.warn(
          `[capi] respuesta detallada de Meta:`,
          JSON.stringify((err as { details: unknown }).details, null, 2)
        );
      }
      return "failed";
    }
  } catch (err) {
    // Best-effort absoluto: ni siquiera un fallo de la base puede tumbar a
    // quien nos llamó (mover un lead de etapa).
    console.warn(`[capi] emitConversion(${eventName}) falló: ${err}`);
    return "error";
  }
}

export type RetryConversionOutcome = {
  ok: boolean;
  status: "sent" | "failed";
  fbTraceId?: string | null;
  error?: string | null;
};

/**
 * Reintenta reportar un evento que previamente falló a Meta CAPI.
 * Solo procede si el evento existe y se encuentra en estado 'failed'.
 */
export async function retryConversion(
  organizationId: string,
  eventId: string
): Promise<RetryConversionOutcome> {
  const db = getDb();

  const eventRows = await db
    .select()
    .from(schema.conversionEvent)
    .where(
      and(
        scoped(schema.conversionEvent.organizationId, organizationId),
        eq(schema.conversionEvent.id, eventId)
      )
    )
    .limit(1);

  const event = eventRows[0];
  if (!event) {
    return { ok: false, status: "failed", error: "Evento no encontrado" };
  }

  if (event.status !== "failed") {
    return {
      ok: false,
      status: event.status as "sent" | "failed",
      error: "Solo los eventos fallidos pueden reintentarse",
    };
  }

  const attribution = await getAttributionForConversation(
    organizationId,
    event.conversationId
  );
  const settings = await getCapiSettings(organizationId);

  const convRows = await db
    .select({ phoneNumberId: schema.conversation.phoneNumberId })
    .from(schema.conversation)
    .where(
      and(
        scoped(schema.conversation.organizationId, organizationId),
        eq(schema.conversation.id, event.conversationId)
      )
    )
    .limit(1);

  const conv = convRows[0];
  let credentials = conv?.phoneNumberId
    ? await getCredentialsByPhoneNumberId(conv.phoneNumberId)
    : null;
  if (!credentials) {
    credentials = await getCredentialsByOrg(organizationId);
  }

  if (!attribution?.ctwaClid || !settings || !credentials) {
    const reason = !attribution?.ctwaClid
      ? NO_CLID_REASON
      : NOT_CONFIGURED_REASON;
    await db
      .update(schema.conversionEvent)
      .set({
        error: reason,
      })
      .where(eq(schema.conversionEvent.id, event.id));
    return { ok: false, status: "failed", error: reason };
  }

  // Reconstruir customData si era Purchase
  let customData: Record<string, unknown> | undefined;
  if (event.eventName === PURCHASE_EVENT) {
    const leadRows = await db
      .select({
        amountCents: schema.lead.amountCents,
        currency: schema.lead.currency,
      })
      .from(schema.conversation)
      .innerJoin(
        schema.lead,
        and(
          eq(schema.lead.organizationId, schema.conversation.organizationId),
          eq(schema.lead.contactId, schema.conversation.contactId)
        )
      )
      .where(
        and(
          scoped(schema.conversation.organizationId, organizationId),
          eq(schema.conversation.id, event.conversationId)
        )
      )
      .limit(1);
    customData = purchaseCustomData(leadRows[0] ?? { amountCents: null, currency: null });
  } else if (event.eventName === QUALIFIED_EVENT) {
    customData = { lead_stage: "qualified" };
  }

  // Resolver dataset vinculado a la WABA específica de esta conversación
  let targetDatasetId = settings.datasetId;
  if (credentials.wabaId) {
    const wabaDataset = await getOrLinkWabaDataset({
      wabaId: credentials.wabaId,
      token: credentials.token,
      fallbackToken: settings.token,
    });
    if (wabaDataset?.id) {
      targetDatasetId = wabaDataset.id;
    }
  }

  try {
    const primaryToken = settings.token || credentials.token;
    let ack;
    try {
      ack = await sendBusinessMessagingEvent({
        datasetId: targetDatasetId,
        token: primaryToken,
        event: {
          eventName: event.eventName,
          eventTime: Math.floor(Date.now() / 1000),
          ctwaClid: attribution.ctwaClid,
          wabaId: credentials.wabaId,
          customData,
        },
      });
    } catch (primaryErr) {
      if (credentials.token && credentials.token !== primaryToken) {
        ack = await sendBusinessMessagingEvent({
          datasetId: targetDatasetId,
          token: credentials.token,
          event: {
            eventName: event.eventName,
            eventTime: Math.floor(Date.now() / 1000),
            ctwaClid: attribution.ctwaClid,
            wabaId: credentials.wabaId,
            customData,
          },
        });
      } else {
        throw primaryErr;
      }
    }

    await db
      .update(schema.conversionEvent)
      .set({
        status: "sent",
        attributionId: attribution.id,
        sentAt: new Date(),
        fbTraceId: ack.fbTraceId,
        error: null,
      })
      .where(eq(schema.conversionEvent.id, event.id));

    return { ok: true, status: "sent", fbTraceId: ack.fbTraceId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.conversionEvent)
      .set({
        status: "failed",
        attributionId: attribution.id,
        error: errorMsg,
      })
      .where(eq(schema.conversionEvent.id, event.id));

    console.warn(
      `[capi] fallo al reintentar ${event.eventName} de ${event.conversationId}: ${errorMsg}`
    );
    if (err && typeof err === "object" && "details" in err) {
      console.warn(
        `[capi] respuesta detallada de Meta:`,
        JSON.stringify((err as { details: unknown }).details, null, 2)
      );
    }
    return { ok: false, status: "failed", error: errorMsg };
  }
}

/**
 * `custom_data` de un `Purchase` a partir del monto del trato. Pura y exportada
 * para fijar en un test la conversión centavos → unidades: Meta espera unidades
 * de la moneda (450.50) y la base guarda centavos enteros (45050).
 *
 * Meta CAPI exige OBLIGATORIAMENTE el parámetro `currency` en el evento `Purchase`
 * (subcódigo 2804010). Si no viene divisa en el lead, se asigna `DEFAULT_CURRENCY` ("MXN").
 * Sin monto (o en cero) no se manda `value` para no desinformar al optimizador de Meta.
 */
export function purchaseCustomData(amount: {
  amountCents: number | null;
  currency: string | null;
}): Record<string, unknown> {
  const currency =
    (amount.currency && amount.currency.trim().toUpperCase()) ||
    DEFAULT_CURRENCY;
  const res: Record<string, unknown> = {
    lead_stage: "won",
    currency,
  };
  if (amount.amountCents !== null && amount.amountCents > 0) {
    res.value = amount.amountCents / 100;
  }
  return res;
}

/**
 * Punto de entrada desde la puerta única de etapas.
 *
 * Vive aquí y no en `stage-history.ts` para que aquel archivo siga siendo lo
 * que dice ser: la puerta que escribe `stage_id`. Y cuelga de esa puerta —y no
 * de donde el bot escribe la ficha, como en el fork del que viene esta idea—
 * porque así reportan IGUAL los cuatro caminos que mueven un lead: el dueño
 * arrastrando, el agente incluido, un cerebro externo por `/api/bot/*` y
 * cualquier quinto camino que alguien agregue mañana.
 */
export async function reportStageChange(input: {
  organizationId: string;
  leadId: string;
  contactId: string;
  toStageId: string;
  toStageKind: "open" | "won" | "lost";
}): Promise<void> {
  if (!(await isAtribucionEnabled(input.organizationId))) return;

  try {
    const settings = await getCapiSettings(input.organizationId);
    const isQualified =
      settings?.qualifiedStageId != null &&
      settings.qualifiedStageId === input.toStageId;
    const isWon = input.toStageKind === "won";
    if (!isQualified && !isWon) return;

    const db = getDb();
    // La conversación REAL del contacto (índice único parcial: una por
    // contacto). Las del Laboratorio (`is_test`) no entran aquí — mismo
    // guardrail que el sender: una conversación de prueba jamás toca el
    // mundo real.
    const rows = await db
      .select({
        conversationId: schema.conversation.id,
        amountCents: schema.lead.amountCents,
        currency: schema.lead.currency,
      })
      .from(schema.lead)
      .innerJoin(
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
          input.organizationId,
          eq(schema.lead.id, input.leadId)
        )
      )
      .limit(1);

    const row = rows[0];
    // Sin conversación de WhatsApp no hay `ctwa_clid` posible ni nada que
    // atribuir (p. ej. un prospecto capturado a mano que nunca escribió).
    if (!row) return;

    if (isWon) {
      await emitConversion(
        input.organizationId,
        row.conversationId,
        PURCHASE_EVENT,
        purchaseCustomData(row)
      );
      return;
    }

    await emitConversion(
      input.organizationId,
      row.conversationId,
      QUALIFIED_EVENT,
      { lead_stage: "qualified" }
    );
  } catch (err) {
    console.warn(`[capi] reportStageChange(${input.leadId}) falló: ${err}`);
  }
}

/* ---------------- Actividad reciente (solo lectura) ---------------- */

export type ConversionActivityRow = {
  id: string;
  conversationId: string;
  eventName: string;
  /** Nombre del contacto; null si la conversación ya no existe. */
  contactName: string | null;
  /** Titular del anuncio de origen, si se capturó. */
  adHeadline: string | null;
  status: "pending" | "sent" | "failed" | "skipped";
  /** Momento a mostrar: el envío si ocurrió, si no la creación. */
  at: string;
  fbTraceId: string | null;
  error: string | null;
};

/** Tope duro: es un panel de monitoreo, no un export. */
const ACTIVITY_MAX_LIMIT = 50;
export const ACTIVITY_DEFAULT_LIMIT = 25;

/** Pura y exportada para probar el fallback de fecha sin tocar la base. */
export function toConversionActivityRow(row: {
  id: string;
  conversationId: string;
  eventName: string;
  status: "pending" | "sent" | "failed" | "skipped";
  error: string | null;
  fbTraceId: string | null;
  sentAt: Date | null;
  createdAt: Date;
  contactName: string | null;
  adHeadline: string | null;
}): ConversionActivityRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    eventName: row.eventName,
    contactName: row.contactName,
    adHeadline: row.adHeadline,
    status: row.status,
    at: (row.sentAt ?? row.createdAt).toISOString(),
    fbTraceId: row.fbTraceId,
    error: row.error,
  };
}

/** Últimas conversiones de la organización, la más reciente primero. */
export async function listConversionActivity(
  organizationId: string,
  limit = ACTIVITY_DEFAULT_LIMIT
): Promise<ConversionActivityRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.conversionEvent.id,
      conversationId: schema.conversionEvent.conversationId,
      eventName: schema.conversionEvent.eventName,
      status: schema.conversionEvent.status,
      error: schema.conversionEvent.error,
      fbTraceId: schema.conversionEvent.fbTraceId,
      sentAt: schema.conversionEvent.sentAt,
      createdAt: schema.conversionEvent.createdAt,
      contactName: schema.contact.name,
      adHeadline: schema.adAttribution.headline,
    })
    .from(schema.conversionEvent)
    .leftJoin(
      schema.conversation,
      eq(schema.conversation.id, schema.conversionEvent.conversationId)
    )
    .leftJoin(
      schema.contact,
      eq(schema.contact.id, schema.conversation.contactId)
    )
    .leftJoin(
      schema.adAttribution,
      eq(schema.adAttribution.conversationId, schema.conversionEvent.conversationId)
    )
    .where(scoped(schema.conversionEvent.organizationId, organizationId))
    .orderBy(desc(schema.conversionEvent.createdAt))
    .limit(Math.min(Math.max(limit, 1), ACTIVITY_MAX_LIMIT));

  return rows.map(toConversionActivityRow);
}
