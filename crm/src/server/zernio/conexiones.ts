import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { MetaApiError } from "@/lib/meta/client";
import { isChannelEnabled } from "@/server/channels/enabled";
import {
  getInstagramCredentialsByAccountRef,
  getInstagramCredentialsByOrg,
} from "@/server/instagram/credentials";
import {
  getMessengerCredentialsByAccountRef,
  getMessengerCredentialsByOrg,
} from "@/server/messenger/credentials";
import {
  webhookUrl,
  webhookVerifyToken,
  type WebhookChannel,
} from "@/server/whatsapp/webhook-url";
import type { ZernioChannel } from "@/server/zernio/cuentas";
import {
  cachedZernioWebhooks,
  ensureZernioWebhook,
  pointsHere,
} from "@/server/zernio/webhooks";
import { columnasDelSecreto } from "@/server/zernio/secreto-guardado";

export const ZERNIO_CHANNELS: readonly ZernioChannel[] = ["instagram", "messenger"];

const WEBHOOK_PATH: Record<ZernioChannel, WebhookChannel> = {
  instagram: "ig",
  messenger: "messenger",
};

export type ZernioConnection = {
  channel: ZernioChannel;
  id: string;
  organizationId: string;
  accountRef: string;
  token: string;
  webhookSecret: string | null;
  name: string | null;
  status: "connected" | "reconnect_required";
};

const arroba = (u: string | null) => (u ? `@${u.replace(/^@/, "")}` : null);

async function byOrg(
  channel: ZernioChannel,
  organizationId: string
): Promise<ZernioConnection | null> {
  if (channel === "instagram") {
    const c = await getInstagramCredentialsByOrg(organizationId);
    if (!c || c.source !== "zernio" || !c.accountRef) return null;
    return { channel, ...comun(c), accountRef: c.accountRef, name: arroba(c.username) };
  }
  const c = await getMessengerCredentialsByOrg(organizationId);
  if (!c || c.source !== "zernio" || !c.accountRef) return null;
  return { channel, ...comun(c), accountRef: c.accountRef, name: c.pageName };
}

async function byAccountRef(
  channel: ZernioChannel,
  accountRef: string
): Promise<ZernioConnection | null> {
  if (channel === "instagram") {
    const c = await getInstagramCredentialsByAccountRef(accountRef);
    if (!c || c.source !== "zernio" || !c.accountRef) return null;
    return { channel, ...comun(c), accountRef: c.accountRef, name: arroba(c.username) };
  }
  const c = await getMessengerCredentialsByAccountRef(accountRef);
  if (!c || c.source !== "zernio" || !c.accountRef) return null;
  return { channel, ...comun(c), accountRef: c.accountRef, name: c.pageName };
}

function comun(c: {
  id: string;
  organizationId: string;
  token: string;
  webhookSecret: string | null;
  status: "connected" | "reconnect_required";
}) {
  return {
    id: c.id,
    organizationId: c.organizationId,
    token: c.token,
    webhookSecret: c.webhookSecret,
    status: c.status,
  };
}

export async function zernioConnectionsOfOrg(
  organizationId: string
): Promise<ZernioConnection[]> {
  const found = await Promise.all(
    ZERNIO_CHANNELS.filter((c) => isChannelEnabled(c)).map((c) => byOrg(c, organizationId))
  );
  return found.filter((c): c is ZernioConnection => c !== null);
}

type EventAccount = { id?: string; accountId?: string; profileId?: string };

export async function findZernioConnection(
  channel: ZernioChannel,
  account: EventAccount | undefined
): Promise<{ connection: ZernioConnection; viaProfile: boolean } | null> {
  const id = account?.id ?? account?.accountId;
  if (id) {
    const direct = await byAccountRef(channel, id);
    if (direct) return { connection: direct, viaProfile: false };
  }
  const pid = account?.profileId;
  if (pid) {
    const viaProf = await byAccountRef(channel, pid);
    if (viaProf) return { connection: viaProf, viaProfile: true };
  }
  return null;
}

async function update(
  channel: ZernioChannel,
  id: string,
  values: { accountRef?: string; webhookSecret?: string | null }
): Promise<void> {
  const db = getDb();
  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (values.accountRef !== undefined) setValues.accountRef = values.accountRef;
  if (values.webhookSecret !== undefined) {
    Object.assign(setValues, columnasDelSecreto(values.webhookSecret));
  }

  if (channel === "instagram") {
    await db
      .update(schema.instagramCredentials)
      .set(setValues)
      .where(eq(schema.instagramCredentials.id, id));
  } else {
    await db
      .update(schema.messengerCredentials)
      .set(setValues)
      .where(eq(schema.messengerCredentials.id, id));
  }
}

export async function healZernioAccountRef(
  channel: ZernioChannel,
  account: EventAccount | undefined
): Promise<void> {
  const found = await findZernioConnection(channel, account);
  const id = account?.id ?? account?.accountId;
  if (!found?.viaProfile || !id) return;
  await update(channel, found.connection.id, { accountRef: id });
  console.warn(
    `[zernio] la conexión de ${channel} tenía el id del perfil (${account?.profileId}): corregida a la cuenta ${id}`
  );
}

export async function storedZernioSecrets(organizationId: string): Promise<string[]> {
  const conns = await zernioConnectionsOfOrg(organizationId);
  return [...new Set(conns.map((c) => c.webhookSecret).filter((s): s is string => !!s))];
}

export type EnsureWebhookResult =
  | { ok: true; created: boolean; accounts: number }
  | { ok: false; code: string; message: string };

export async function ensureWebhookForOrg(
  organizationId: string,
  opts: { secret?: string | null } = {}
): Promise<EnsureWebhookResult> {
  const conns = await zernioConnectionsOfOrg(organizationId);
  if (conns.length === 0) {
    return {
      ok: false,
      code: "sin_conexiones",
      message: "No hay ningún canal conectado por Zernio.",
    };
  }

  const env = getEnv();
  const url = webhookUrl(WEBHOOK_PATH[conns[0]!.channel]);
  if (!url.startsWith("https://") && !process.env.ZERNIO_BASE_URL) {
    return {
      ok: false,
      code: "sin_https",
      message:
        "Esta instancia no tiene una URL pública con https (APP_BASE_URL): Zernio no puede entregarle mensajes.",
    };
  }

  const segment = webhookVerifyToken();
  const name = `vocero-${new URL(env.APP_BASE_URL).host}`;
  const acceptableUrls = ZERNIO_CHANNELS.filter((c) => isChannelEnabled(c)).map((c) =>
    webhookUrl(WEBHOOK_PATH[c])
  );

  try {
    let secret =
      opts.secret ||
      (conns.map((c) => c.webhookSecret).find((s): s is string => !!s) ?? null);
    if (!secret) {
      const { webhooks } = await cachedZernioWebhooks(conns[0]!.token);
      secret =
        webhooks.find((w) => pointsHere(w, segment) && w.secret)?.secret ??
        randomBytes(24).toString("hex");
    }

    const porLlave = new Map<string, ZernioConnection[]>();
    for (const c of conns) porLlave.set(c.token, [...(porLlave.get(c.token) ?? []), c]);

    let created = false;
    for (const [token, grupo] of porLlave) {
      const r = await ensureZernioWebhook({
        token,
        segment,
        name,
        url,
        acceptableUrls,
        accountIds: grupo.map((c) => c.accountRef),
        secret,
      });
      created ||= r.created;
    }

    for (const c of conns) {
      if (c.webhookSecret !== secret) await update(c.channel, c.id, { webhookSecret: secret });
    }
    return { ok: true, created, accounts: conns.length };
  } catch (err) {
    const caido = err instanceof MetaApiError && (err.status === 0 || err.status >= 500);
    console.warn("[zernio] no se pudo dar de alta el webhook:", err instanceof Error ? err.message : err);
    return caido
      ? {
          ok: false,
          code: "zernio_unavailable",
          message: "No se pudo contactar a Zernio para dar de alta el webhook.",
        }
      : {
          ok: false,
          code: "zernio_rejected",
          message: "Zernio no aceptó el webhook.",
        };
  }
}
