import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { deviceBlacklistKey } from "@/services/admin/devices";

export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type DeviceAuthResult =
  | {
      ok: true;
      tokenHash: string;
      device: {
        id: string;
        orgId: string;
        sucursalId: string;
        nombre: string;
      };
      org: {
        id: string;
        nombre: string;
        estado: string;
        cloudEvidencesEnabled: boolean;
        horasSemanalesMax: number;
        pinAuditoriaHash: string | null;
      };
    }
  | {
      ok: false;
      status: number;
      code: "MISSING_TOKEN" | "DEVICE_REVOKED" | "ORG_SUSPENDED";
      error: string;
    };

export async function authenticateDeviceToken(
  req: Request
): Promise<DeviceAuthResult> {
  const authHeader = req.headers.get("authorization");
  const headerToken = req.headers.get("x-device-token");

  let token = "";
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  } else if (headerToken) {
    token = headerToken.trim();
  }

  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "MISSING_TOKEN",
      error: "Falta el token de dispositivo.",
    };
  }

  const tokenHash = hashDeviceToken(token);

  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();
  const blacklisted = await redis.get(deviceBlacklistKey(tokenHash));
  if (blacklisted) {
    return {
      ok: false,
      status: 401,
      code: "DEVICE_REVOKED",
      error: "Dispositivo revocado.",
    };
  }

  const db = getDb();
  const [row] = await db
    .select({
      deviceId: schema.dispositivos.id,
      deviceOrgId: schema.dispositivos.orgId,
      sucursalId: schema.dispositivos.sucursalId,
      deviceNombre: schema.dispositivos.nombre,
      deviceActivo: schema.dispositivos.activo,
      orgId: schema.organizaciones.id,
      orgNombre: schema.organizaciones.nombre,
      orgEstado: schema.organizaciones.estado,
      cloudEvidencesEnabled: schema.organizaciones.cloudEvidencesEnabled,
      horasSemanalesMax: schema.organizaciones.horasSemanalesMax,
      pinAuditoriaHash: schema.organizaciones.pinAuditoriaHash,
    })
    .from(schema.dispositivos)
    .innerJoin(
      schema.organizaciones,
      eq(schema.dispositivos.orgId, schema.organizaciones.id)
    )
    .where(eq(schema.dispositivos.tokenHash, tokenHash))
    .limit(1);

  if (!row || !row.deviceActivo) {
    return {
      ok: false,
      status: 401,
      code: "DEVICE_REVOKED",
      error: "Dispositivo no válido o revocado.",
    };
  }

  if (row.orgEstado === "suspendido" || row.orgEstado === "cancelado") {
    return {
      ok: false,
      status: 403,
      code: "ORG_SUSPENDED",
      error: "El servicio de la organización se encuentra suspendido.",
    };
  }

  return {
    ok: true,
    tokenHash,
    device: {
      id: row.deviceId,
      orgId: row.deviceOrgId,
      sucursalId: row.sucursalId,
      nombre: row.deviceNombre,
    },
    org: {
      id: row.orgId,
      nombre: row.orgNombre,
      estado: row.orgEstado,
      cloudEvidencesEnabled: row.cloudEvidencesEnabled,
      horasSemanalesMax: Number(row.horasSemanalesMax),
      pinAuditoriaHash: row.pinAuditoriaHash ?? null,
    },
  };
}

export async function checkSyncRateLimit(
  deviceId: string,
  scope: string,
  maxPerMinute: number = 120
): Promise<boolean> {
  try {
    const redis = getRedis();
    if (redis.status === "wait") await redis.connect();
    const key = `sync:rl:${scope}:${deviceId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    return count <= maxPerMinute;
  } catch {
    return true;
  }
}

export async function requireSyncDevice(
  req: Request,
  scope: string
): Promise<
  | { ok: true; auth: Extract<DeviceAuthResult, { ok: true }> }
  | { ok: false; response: NextResponse }
> {
  const auth = await authenticateDeviceToken(req);
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, code: auth.code, error: auth.error },
        { status: auth.status }
      ),
    };
  }

  const allowed = await checkSyncRateLimit(auth.device.id, scope);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          code: "RATE_LIMITED",
          error: "Demasiadas solicitudes de sincronización.",
        },
        { status: 429 }
      ),
    };
  }

  return { ok: true, auth };
}
