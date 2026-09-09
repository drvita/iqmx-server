import { withAuth } from "@/lib/api";
import { getEnv } from "@/lib/env";
import { isChannelEnabledForOrg } from "@/server/channels/enabled";
import { getOrGenerateWebhookToken } from "@/server/whatsapp/webhook-token";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const env = getEnv();
  const verifyToken = await getOrGenerateWebhookToken(session.organizationId);
  const base = env.APP_BASE_URL.replace(/\/$/, "");
  const url = `${base}/api/webhooks/wa/${verifyToken}`;
  const [hasIg, hasMessenger] = await Promise.all([
    isChannelEnabledForOrg("instagram", session.organizationId),
    isChannelEnabledForOrg("messenger", session.organizationId),
  ]);
  return Response.json({
    url,
    instagramUrl: hasIg
      ? `${base}/api/webhooks/ig/${verifyToken}`
      : null,
    messengerUrl: hasMessenger
      ? `${base}/api/webhooks/messenger/${verifyToken}`
      : null,
    verifyToken,
    isHttps: url.startsWith("https://"),
    signatureLayer: Boolean(env.META_APP_SECRET),
  });
});
