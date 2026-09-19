import { graphRequest, MetaApiError } from "@/lib/meta/client";

/**
 * 017 — Suscripción y verificación de eventos de Webhook para Facebook Messenger.
 *
 * Campos que el CRM consume:
 * - messages: mensajes entrantes (texto, imágenes, audio, video, archivos, stickers)
 * - messaging_postbacks: clics en botones de plantillas / menús
 * - messaging_referrals: anuncios de Click to Messenger
 * - message_deliveries: acuses de entrega (doble check gris)
 * - message_reads: acuses de lectura (doble check azul / visto)
 */
export const MESSENGER_SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "messaging_referrals",
  "message_deliveries",
  "message_reads",
] as const;

export type SubscriptionStatus = {
  subscribed: boolean;
  fields: string[];
};

type SubscribedAppsResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    subscribed_fields?: string[];
  }>;
};

/**
 * Consulta las aplicaciones y campos suscritos a la página de Facebook.
 */
export async function getMessengerSubscription(
  pageId: string,
  token: string
): Promise<SubscriptionStatus> {
  try {
    const res = await graphRequest<SubscribedAppsResponse>(
      `${pageId}/subscribed_apps`,
      { method: "GET", token }
    );

    const app = res.data?.[0];
    if (!app) {
      return { subscribed: false, fields: [] };
    }

    const fields = app.subscribed_fields ?? [];
    return {
      subscribed: fields.length > 0,
      fields,
    };
  } catch (err) {
    if (err instanceof MetaApiError && (err.status === 404 || err.code === 100)) {
      return { subscribed: false, fields: [] };
    }
    throw err;
  }
}

/**
 * Suscribe la aplicación a la página con los campos necesarios para el CRM.
 */
export async function subscribeMessengerApp(
  pageId: string,
  token: string
): Promise<{ ok: boolean; fields: string[] }> {
  const fields = MESSENGER_SUBSCRIBED_FIELDS.join(",");
  await graphRequest<{ success?: boolean }>(
    `${pageId}/subscribed_apps?subscribed_fields=${encodeURIComponent(fields)}`,
    {
      method: "POST",
      token,
    }
  );

  return { ok: true, fields: [...MESSENGER_SUBSCRIBED_FIELDS] };
}
