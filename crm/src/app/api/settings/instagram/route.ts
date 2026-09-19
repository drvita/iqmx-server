import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import {
  getInstagramCredentialsByOrg,
  saveInstagramCredentials,
  tokenLast4,
} from "@/server/instagram/credentials";
import {
  channelDisabledResponse,
  isChannelEnabledForOrg,
} from "@/server/channels/enabled";

import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

/** 014 — Estado de la conexión de Instagram (el token nunca sale entero). */
export const GET = withAuth(async (session) => {
  if (!(await isChannelEnabledForOrg("instagram", session.organizationId))) return channelDisabledResponse();
  const [creds, assistants] = await Promise.all([
    getInstagramCredentialsByOrg(session.organizationId),
    getDb()
      .select({
        id: schema.agentProfile.id,
        name: schema.agentProfile.name,
        isDefault: schema.agentProfile.isDefault,
      })
      .from(schema.agentProfile)
      .where(
        and(
          scoped(schema.agentProfile.organizationId, session.organizationId),
          eq(schema.agentProfile.type, "conversational")
        )
      )
      .orderBy(desc(schema.agentProfile.isDefault), desc(schema.agentProfile.createdAt)),
  ]);

  return Response.json({
    connection: creds
      ? {
          source: creds.source,
          igUserId: creds.igUserId,
          accountRef: creds.accountRef,
          username: creds.username,
          status: creds.status,
          aiEnabled: creds.aiEnabled,
          assistantId: creds.assistantId,
          tokenLast4: tokenLast4(creds.token),
        }
      : null,
    assistants,
  });
});

const putSchema = z.object({
  source: z.enum(["zernio", "meta"]).default("meta"),
  igUserId: z.string().trim().min(1).nullish(),
  accountRef: z.string().trim().min(1).nullish(),
  username: z.string().trim().nullish(),
  token: z.string().trim().min(1).optional(),
  webhookSecret: z.string().trim().min(1).nullish(),
  aiEnabled: z.boolean().optional(),
  assistantId: z.string().trim().min(1).nullish(),
});

/**
 * Guarda la conexión validando ANTES contra la plataforma, igual que el
 * wizard de WhatsApp: un token que no sirve no llega a la base.
 */
export const PUT = withAuth(async (session, req: Request) => {
  if (!(await isChannelEnabledForOrg("instagram", session.organizationId))) return channelDisabledResponse();
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;
  const data = { ...body.data, source: body.data.source ?? "meta" };

  const existing = await getInstagramCredentialsByOrg(session.organizationId);

  // Si no envía token pero ya existen credenciales guardadas, permite actualizar solo asistente o aiEnabled
  if (!data.token) {
    if (!existing) {
      return apiError(422, "missing_token", "Se requiere el token para la conexión inicial.");
    }
    await saveInstagramCredentials({
      organizationId: session.organizationId,
      source: existing.source,
      igUserId: existing.igUserId,
      accountRef: existing.accountRef,
      username: existing.username,
      token: existing.token,
      webhookSecret: existing.webhookSecret,
      aiEnabled: data.aiEnabled !== undefined ? data.aiEnabled : existing.aiEnabled,
      assistantId: data.assistantId !== undefined ? data.assistantId : existing.assistantId,
    });
    return Response.json({ ok: true, username: existing.username });
  }

  if (data.source === "meta" && !data.igUserId) {
    return apiError(
      422,
      "invalid_body",
      "En modo Meta hace falta el ID de usuario de Instagram (igUserId)"
    );
  }

  if (data.source === "zernio" && !data.accountRef) {
    return apiError(
      422,
      "invalid_body",
      "En modo Zernio hace falta el accountId de la cuenta conectada"
    );
  }

  const check = await verify({ ...data, igUserId: data.igUserId ?? "", token: data.token });
  if (!check.ok) {
    return apiError(check.status, check.code, check.message);
  }

  await saveInstagramCredentials({
    organizationId: session.organizationId,
    source: data.source,
    igUserId: data.igUserId ?? check.username ?? "ig_connected",
    accountRef: data.accountRef ?? null,
    username: check.username ?? data.username ?? null,
    token: data.token,
    webhookSecret: data.webhookSecret ?? null,
    aiEnabled: data.aiEnabled !== undefined ? data.aiEnabled : existing?.aiEnabled ?? true,
    assistantId: data.assistantId !== undefined ? data.assistantId : existing?.assistantId ?? null,
  });

  return Response.json({ ok: true, username: check.username ?? null });
});

type Check =
  | { ok: true; username: string | null }
  | { ok: false; status: number; code: string; message: string };

async function verify(data: z.infer<typeof putSchema>): Promise<Check> {
  const url =
    data.source === "meta"
      ? `${process.env.IG_GRAPH_BASE_URL ?? "https://graph.instagram.com"}/${
          process.env.META_GRAPH_API_VERSION ?? "v25.0"
        }/me?fields=id,username`
      : `${process.env.ZERNIO_BASE_URL ?? "https://zernio.com/api/v1"}/inbox/conversations?limit=1`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
  } catch {
    return {
      ok: false,
      status: 503,
      code: "platform_unavailable",
      message: "No se pudo contactar la plataforma; intenta de nuevo",
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: 422,
      code: "invalid_token",
      message:
        data.source === "meta"
          ? "El token de Instagram no es válido o no tiene permiso de mensajes"
          : "La API key de Zernio no es válida",
    };
  }

  if (data.source === "meta") {
    const json = (await res.json().catch(() => null)) as {
      id?: string;
      username?: string;
    } | null;
    if (json?.id && json.id !== data.igUserId) {
      return {
        ok: false,
        status: 422,
        code: "id_mismatch",
        message: `El IG_ID del token es ${json.id}, no ${data.igUserId}`,
      };
    }
    return { ok: true, username: json?.username ?? null };
  }

  return { ok: true, username: null };
}
