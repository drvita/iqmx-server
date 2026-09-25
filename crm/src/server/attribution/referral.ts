import type { WebhookReferral } from "@/server/inbox/webhook";

/**
 * 018 — Del `referral` de WhatsApp a UN anuncio de origen.
 *
 * Se prueba sin base de datos, y es la puerta por la que un payload externo
 * llega a una columna validada y recortada.
 */

export type AnuncioDeOrigen = {
  sourceId: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  headline: string | null;
  body: string | null;
  mediaType: string | null;
  ctwaClid: string | null;
  /** De dónde bajar la imagen del creativo; se valida antes de usarla. */
  imageUrl: string | null;
  /** El referral recortado, para no perder campos que Meta añada después. */
  raw: Record<string, unknown>;
};

export const COTAS = {
  id: 128,
  titular: 300,
  texto: 2000,
  url: 2048,
  raw: 8_000,
} as const;

const CLAVES_WHATSAPP = [
  "source_url",
  "source_id",
  "source_type",
  "headline",
  "body",
  "media_type",
  "image_url",
  "video_url",
  "thumbnail_url",
  "ctwa_clid",
] as const;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const limpio = v.trim();
  if (!limpio) return null;
  return limpio.length > max ? limpio.slice(0, max) : limpio;
}

function url(v: unknown): string | null {
  const t = texto(v, COTAS.url);
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function recortarCampos(
  origen: Record<string, unknown>,
  claves: readonly string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of claves) {
    const v = texto(origen[k], k.endsWith("_url") ? COTAS.url : COTAS.texto);
    if (v) out[k] = v;
  }
  return out;
}

function acotarRaw(raw: Record<string, unknown>, esencial: Record<string, unknown>) {
  return JSON.stringify(raw).length <= COTAS.raw ? raw : esencial;
}

/** WhatsApp Cloud API: `messages[].referral`. */
export function anuncioDeWhatsapp(referral: unknown): AnuncioDeOrigen | null {
  if (!esObjeto(referral)) return null;
  const r = referral as WebhookReferral & Record<string, unknown>;

  const sourceId = texto(r.source_id, COTAS.id);
  const ctwaClid = texto(r.ctwa_clid, COTAS.texto);
  const headline = texto(r.headline, COTAS.titular);
  const sourceUrl = url(r.source_url);
  if (!sourceId && !ctwaClid && !headline && !sourceUrl) return null;

  const raw = recortarCampos(r, CLAVES_WHATSAPP);
  return {
    sourceId,
    sourceType: texto(r.source_type, COTAS.id),
    sourceUrl,
    headline,
    body: texto(r.body, COTAS.texto),
    mediaType: texto(r.media_type, COTAS.id),
    ctwaClid,
    imageUrl: url(r.thumbnail_url) ?? url(r.image_url),
    raw: acotarRaw(raw, { source_id: sourceId, headline }),
  };
}

/**
 * Sin la bandera `ATRIBUCION`, el anuncio se guarda sin su identificador de clic
 * en la columna ni dentro del raw.
 */
export function sinIdentificadorDeClic(anuncio: AnuncioDeOrigen): AnuncioDeOrigen {
  const raw = { ...anuncio.raw };
  delete raw.ctwa_clid;
  return { ...anuncio, ctwaClid: null, raw };
}
