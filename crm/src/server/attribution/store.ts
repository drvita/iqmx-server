import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import type { AnuncioDto } from "@/lib/types";
import { descargaEnCurso, guardarCreativo } from "@/server/attribution/creativo";
import { isAtribucionEnabled } from "@/server/attribution/flag";
import {
  anuncioDeWhatsapp,
  sinIdentificadorDeClic,
  type AnuncioDeOrigen,
} from "@/server/attribution/referral";
import type { WebhookReferral } from "@/server/inbox/webhook";

/**
 * 016 + 018 — De qué anuncio vino una conversación.
 *
 * El `referral` llega cuando el mensaje viene de un anuncio Click-to-WhatsApp.
 * Guarda la información del anuncio para visualización y si la atribución
 * está encendida para el inquilino, guarda también el `ctwa_clid`.
 */

export function anuncioParaGuardar(
  anuncio: AnuncioDeOrigen,
  atribuye: boolean = false
): AnuncioDeOrigen {
  return atribuye ? anuncio : sinIdentificadorDeClic(anuncio);
}

export async function registrarAnuncioDeOrigen(input: {
  organizationId: string;
  contactId: string;
  conversationId: string;
  anuncio: AnuncioDeOrigen;
}): Promise<void> {
  const db = getDb();
  const atribuye = await isAtribucionEnabled(input.organizationId);
  const a = anuncioParaGuardar(input.anuncio, atribuye);

  const creadas = await db
    .insert(schema.adAttribution)
    .values({
      id: newId("adAttribution"),
      organizationId: input.organizationId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      ctwaClid: a.ctwaClid,
      sourceId: a.sourceId,
      sourceType: a.sourceType,
      sourceUrl: a.sourceUrl,
      headline: a.headline,
      body: a.body,
      mediaType: a.mediaType,
      raw: a.raw,
    })
    .onConflictDoNothing({
      target: [
        schema.adAttribution.organizationId,
        schema.adAttribution.conversationId,
      ],
    })
    .returning({ id: schema.adAttribution.id });

  if (creadas[0] && a.sourceId && a.imageUrl) {
    const { organizationId, conversationId } = input;
    const sourceId = a.sourceId;
    const imageUrl = a.imageUrl;
    void guardarCreativo({ organizationId, conversationId, sourceId, imageUrl }).catch(
      (err) =>
        console.warn(
          `[atribucion] imagen del anuncio ${sourceId} no guardada:`,
          err instanceof Error ? err.message : err
        )
    );
  }
}

/** Compatibilidad con callers anteriores de recordAttribution */
export async function recordAttribution(input: {
  organizationId: string;
  contactId: string;
  conversationId: string;
  referral: WebhookReferral;
}): Promise<void> {
  const parsed = anuncioDeWhatsapp(input.referral);
  if (parsed) {
    await registrarAnuncioDeOrigen({
      organizationId: input.organizationId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      anuncio: parsed,
    });
  }
}

/** Usada por la Conversions API (016): el anuncio de UNA conversación. */
export async function getAttributionForConversation(
  organizationId: string,
  conversationId: string
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.adAttribution)
    .where(
      scoped(
        schema.adAttribution.organizationId,
        organizationId,
        eq(schema.adAttribution.conversationId, conversationId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/** La primera fila del anuncio de origen de un contacto. */
async function primeraFilaDelContacto(organizationId: string, contactId: string) {
  const db = getDb();
  const filas = await db
    .select()
    .from(schema.adAttribution)
    .where(
      scoped(
        schema.adAttribution.organizationId,
        organizationId,
        eq(schema.adAttribution.contactId, contactId)
      )
    )
    .orderBy(asc(schema.adAttribution.createdAt), asc(schema.adAttribution.id))
    .limit(1);
  return filas[0] ?? null;
}

export async function anuncioDelContacto(
  organizationId: string,
  contactId: string
): Promise<AnuncioDto | null> {
  const fila = await primeraFilaDelContacto(organizationId, contactId);
  if (!fila) return null;
  const atribuye = await isAtribucionEnabled(organizationId);
  return serializarAnuncio(fila, atribuye);
}

export const REPARAR_CADA_MS = 10 * 60_000;

export function crearFreno(ventanaMs = REPARAR_CADA_MS, maxClaves = 5_000) {
  const ultimos = new Map<string, number>();
  return {
    intentar(clave: string, ahora = Date.now()): boolean {
      const anterior = ultimos.get(clave);
      if (anterior !== undefined && ahora - anterior < ventanaMs) return false;
      ultimos.set(clave, ahora);
      if (ultimos.size > maxClaves) {
        for (const [k, t] of ultimos) {
          if (ahora - t >= ventanaMs) ultimos.delete(k);
        }
      }
      return true;
    },
    get claves() {
      return ultimos.size;
    },
  };
}

const frenoDeReparacion = crearFreno();

export function repararImagenSiFalta(organizationId: string, contactId: string): void {
  void (async () => {
    const fila = await primeraFilaDelContacto(organizationId, contactId);
    if (!fila || fila.imageAssetId || !fila.sourceId) return;
    if (descargaEnCurso(organizationId, fila.sourceId)) return;
    if (!frenoDeReparacion.intentar(`${organizationId}:${fila.sourceId}`)) return;

    const anuncio = anuncioDeWhatsapp(fila.raw);
    if (!anuncio?.imageUrl) return;
    await guardarCreativo({
      organizationId,
      conversationId: fila.conversationId,
      sourceId: fila.sourceId,
      imageUrl: anuncio.imageUrl,
    });
  })().catch((err) =>
    console.warn(
      `[atribucion] reparación de imagen del contacto ${contactId} falló:`,
      err instanceof Error ? err.message : err
    )
  );
}

export function serializarAnuncio(
  fila: typeof schema.adAttribution.$inferSelect,
  atribuye: boolean = false
): AnuncioDto {
  return {
    sourceId: fila.sourceId,
    sourceType: fila.sourceType,
    sourceUrl: fila.sourceUrl?.startsWith("https://") ? fila.sourceUrl : null,
    headline: fila.headline,
    body: fila.body,
    mediaType: fila.mediaType,
    imageAssetId: fila.imageAssetId,
    hasCtwaClid: atribuye && fila.ctwaClid !== null,
    capturedAt: fila.createdAt.toISOString(),
  };
}
