import crypto from "node:crypto";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export const SESSION_COOKIE_NAME = "checador_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

export type RolCodigo =
  | "ORG_ADMIN"
  | "RH_ASSISTANT"
  | "SUPERVISOR_SUCURSAL"
  | "AUDITOR_NOMINA";

export interface SessionPayload {
  userId: string;
  orgId: string;
  rol: RolCodigo;
  nombre: string;
  email: string;
  exp: number;
}

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.PROVISION_SECRET_KEY ||
    "dev-checador-session-secret-change-me"
  );
}

export function signSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(encoded)
    .digest("base64url");

  const bufA = Buffer.from(sig);
  const bufB = Buffer.from(expectedSig);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;
    if (
      !parsed.userId ||
      !parsed.orgId ||
      !parsed.rol ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/**
 * Lee y valida la sesión contra la BD para asegurar que el usuario y la organización
 * sigan activos y no hayan sido suspendidos/cancelados.
 */
export async function getSessionOrNull(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;

  const payload = verifySessionToken(raw);
  if (!payload) return null;

  const db = getDb();
  const rows = await db
    .select({
      userId: schema.usuarios.id,
      orgId: schema.usuarios.orgId,
      activo: schema.usuarios.activo,
      orgEstado: schema.organizaciones.estado,
      rolCodigo: schema.roles.codigo,
      nombre: schema.usuarios.nombre,
      email: schema.usuarios.email,
    })
    .from(schema.usuarios)
    .innerJoin(
      schema.organizaciones,
      eq(schema.usuarios.orgId, schema.organizaciones.id)
    )
    .innerJoin(schema.roles, eq(schema.usuarios.rolId, schema.roles.id))
    .where(
      and(
        eq(schema.usuarios.id, payload.userId),
        eq(schema.usuarios.orgId, payload.orgId)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row || !row.activo) return null;
  if (row.orgEstado === "suspendido" || row.orgEstado === "cancelado") {
    return null;
  }

  return {
    userId: row.userId,
    orgId: row.orgId,
    rol: row.rolCodigo as RolCodigo,
    nombre: row.nombre,
    email: row.email,
    exp: payload.exp,
  };
}

export async function requireSession(
  allowedRoles?: readonly RolCodigo[]
): Promise<SessionPayload> {
  const session = await getSessionOrNull();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  if (allowedRoles && !allowedRoles.includes(session.rol)) {
    throw new Error("FORBIDDEN_ROLE");
  }
  return session;
}
