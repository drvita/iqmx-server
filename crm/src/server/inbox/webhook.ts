import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Autenticación en dos capas del webhook (contrato webhook.md / DV-VC-02).
 * Este módulo es puro (sin BD) para poder testearse unitariamente.
 */

/** Comparación timing-safe de strings de longitud arbitraria. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac("sha256", "cmp").update(a).digest();
  const hb = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Capa 1: el segmento de la ruta debe coincidir con el verify token. */
export function isValidWebhookToken(
  segment: string,
  verifyToken: string
): boolean {
  return verifyToken.length > 0 && safeEqual(segment, verifyToken);
}

/**
 * Capa 2 (opcional): firma HMAC-SHA256 de Meta sobre el body CRUDO.
 * Devuelve true si no hay secreto configurado (capa desactivada).
 */
export function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined
): boolean {
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  return safeEqual(signatureHeader.slice("sha256=".length), expected);
}

/* ---------- Tipos del payload de Meta (subconjunto soportado) ---------- */

/** Payload de un adjunto en un mensaje del webhook (008). */
export type WebhookMediaPayload = {
  id?: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  /** Solo documentos. */
  filename?: string;
  /** Solo audio: true si es nota de voz. */
  voice?: boolean;
};

export type WebhookLocation = {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
};

/**
 * 016 — Objeto `referral`: SOLO llega cuando el mensaje viene de un anuncio
 * Click-to-WhatsApp, y normalmente solo en el PRIMER mensaje de la
 * conversación. Su `ctwa_clid` es lo que permite devolverle a Meta el
 * desenlace de ese lead; el resto son datos del creativo.
 */
export type WebhookReferral = {
  source_url?: string;
  source_id?: string;
  source_type?: string;
  headline?: string;
  body?: string;
  media_type?: string;
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  ctwa_clid?: string;
};

/**
 * 017 — Mapea la estructura de referral de Meta (Messenger e Instagram)
 * al formato unificado WebhookReferral que el CRM almacena en ad_attribution.
 */
export function mapMetaMessagingReferral(raw: unknown): WebhookReferral | null {
  if (!raw || typeof raw !== "object") return null;
  const ref = raw as Record<string, unknown>;
  const adsContext = (ref.ads_context_data ?? {}) as Record<string, unknown>;

  const adId =
    typeof ref.ad_id === "string"
      ? ref.ad_id
      : typeof ref.source_id === "string"
        ? ref.source_id
        : null;

  const headline =
    typeof adsContext.ad_title === "string"
      ? adsContext.ad_title
      : typeof ref.headline === "string"
        ? ref.headline
        : null;

  const photo =
    typeof adsContext.photo_url === "string"
      ? adsContext.photo_url
      : typeof ref.image_url === "string"
        ? ref.image_url
        : null;

  const video =
    typeof adsContext.video_url === "string"
      ? adsContext.video_url
      : typeof ref.video_url === "string"
        ? ref.video_url
        : null;

  const uri =
    typeof ref.referer_uri === "string"
      ? ref.referer_uri
      : typeof ref.source_url === "string"
        ? ref.source_url
        : null;

  const sourceType =
    typeof ref.source === "string"
      ? ref.source
      : typeof ref.source_type === "string"
        ? ref.source_type
        : "ad";

  if (!adId && !headline && !photo && !uri) return null;

  return {
    source_id: adId ?? undefined,
    source_url: uri ?? undefined,
    source_type: sourceType,
    headline: headline ?? undefined,
    image_url: photo ?? undefined,
    video_url: video ?? undefined,
    media_type: video ? "video" : photo ? "image" : undefined,
  };
}

export type WebhookMessage = {
  /** Teléfono del remitente. OPCIONAL desde la migración de Meta a BSUID (003). */
  from?: string;
  /** Business-Scoped User ID del remitente cuando no hay teléfono (003). */
  from_user_id?: string;
  /** Destinatario — presente en echoes de coexistence (008): el wa_id del lead. */
  to?: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: WebhookMediaPayload;
  video?: WebhookMediaPayload;
  audio?: WebhookMediaPayload;
  document?: WebhookMediaPayload;
  sticker?: WebhookMediaPayload;
  location?: WebhookLocation;
  contacts?: unknown[];
  /** 016: origen del anuncio, cuando la conversación nació de uno. */
  referral?: WebhookReferral;
};

export type WebhookStatus = {
  id: string;
  status: string;
  timestamp: string;
  recipient_id?: string;
  errors?: { code: number; title?: string; message?: string }[];
};

export type WebhookValue = {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string; user_id?: string }[];
  messages?: WebhookMessage[];
  /** Echoes de coexistence (008): mensajes enviados desde la app del teléfono. */
  message_echoes?: WebhookMessage[];
  statuses?: WebhookStatus[];
  // message_template_status_update
  event?: string;
  message_template_name?: string;
  message_template_language?: string;
  message_template_id?: number | string;
  reason?: string | null;
};

export type WebhookChange = { field?: string; value?: WebhookValue };

export type WebhookPayload = {
  object?: string;
  entry?: { id?: string; changes?: WebhookChange[] }[];
};
