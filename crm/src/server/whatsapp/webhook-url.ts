import { getEnv } from "@/lib/env";

export type WebhookChannel = "wa" | "ig" | "messenger";

export function webhookVerifyToken(): string {
  return getEnv().META_WEBHOOK_VERIFY_TOKEN ?? "";
}

export function webhookUrl(channel: WebhookChannel, verifyToken?: string): string {
  const env = getEnv();
  const base = env.APP_BASE_URL.replace(/\/+$/, "");
  const token = verifyToken ?? env.META_WEBHOOK_VERIFY_TOKEN ?? "";
  return `${base}/api/webhooks/${channel}/${token}`;
}
