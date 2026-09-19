import { apiError, withAuth } from "@/lib/api";
import { isChannelEnabledForOrg } from "@/server/channels/enabled";
import { getMessengerCredentialsByOrg } from "@/server/messenger/credentials";
import {
  getMessengerSubscription,
  subscribeMessengerApp,
} from "@/server/messenger/subscription";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/messenger/subscription
 * Consulta los campos y estado de suscripción de la página en Meta Graph API.
 */
export const GET = withAuth(async (session) => {
  if (!(await isChannelEnabledForOrg("messenger", session.organizationId))) {
    return apiError(403, "channel_disabled", "Canal Messenger deshabilitado");
  }

  const creds = await getMessengerCredentialsByOrg(session.organizationId);
  if (!creds || creds.source !== "meta" || !creds.pageId) {
    return Response.json({
      subscribed: false,
      fields: [],
      reason: "not_meta",
    });
  }

  try {
    const sub = await getMessengerSubscription(creds.pageId, creds.token);
    return Response.json({
      subscribed: sub.subscribed,
      fields: sub.fields,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error de comunicación con Meta";
    return apiError(502, "meta_error", message);
  }
});

/**
 * POST /api/settings/messenger/subscription
 * Suscribe la app a la página con los campos necesarios para el CRM (messages, deliveries, reads, etc).
 */
export const POST = withAuth(async (session) => {
  if (!(await isChannelEnabledForOrg("messenger", session.organizationId))) {
    return apiError(403, "channel_disabled", "Canal Messenger deshabilitado");
  }
  if (session.role !== "owner") {
    return apiError(403, "forbidden", "Solo el propietario puede gestionar suscripciones de eventos");
  }

  const creds = await getMessengerCredentialsByOrg(session.organizationId);
  if (!creds || creds.source !== "meta" || !creds.pageId) {
    return apiError(400, "invalid_source", "Solo las conexiones directas con Meta requieren suscripción de webhooks");
  }

  try {
    const res = await subscribeMessengerApp(creds.pageId, creds.token);
    return Response.json(res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "No se pudo suscribir la aplicación en Meta";
    return apiError(502, "meta_error", message);
  }
});
