import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { getDb, schema } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { sendPasswordResetEmail } from "@/lib/mail/mailer";
import { getRedis } from "@/lib/redis";

export const PASSWORD_RESET_TTL_SECONDS = 15 * 60;

export function passwordResetKey(token: string): string {
  return `checador:pwd-reset:${token}`;
}

export function isValidResetTokenFormat(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token.trim());
}

export async function requestPasswordReset(
  rawEmail: string,
  ipOrigen?: string | null
): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return;

  const db = getDb();
  const [user] = await db
    .select({
      id: schema.usuarios.id,
      orgId: schema.usuarios.orgId,
      nombre: schema.usuarios.nombre,
      email: schema.usuarios.email,
      activo: schema.usuarios.activo,
    })
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.email, email), eq(schema.usuarios.activo, true)))
    .limit(1);

  if (!user) {
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();

  await redis.set(
    passwordResetKey(token),
    JSON.stringify({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
    }),
    "EX",
    PASSWORD_RESET_TTL_SECONDS
  );

  const env = getEnv();
  const baseUrl = env.APP_BASE_URL.replace(/\/+$/, "");
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  await sendPasswordResetEmail({
    to: user.email,
    nombre: user.nombre,
    resetUrl,
  });

  await db.insert(schema.auditLogs).values({
    orgId: user.orgId,
    usuarioId: user.id,
    accion: "PASSWORD_RESET_SOLICITADO",
    entidad: "usuarios",
    entidadId: user.id,
    ipOrigen: ipOrigen || null,
    detalle: { email: user.email },
  });
}

export async function confirmPasswordReset(params: {
  token: string;
  newPassword: string;
  ipOrigen?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = params.token.trim();
  if (!isValidResetTokenFormat(token)) {
    return { ok: false, error: "El enlace de recuperación es inválido." };
  }

  if (params.newPassword.length < 8) {
    return {
      ok: false,
      error: "La contraseña debe tener al menos 8 caracteres.",
    };
  }

  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();

  const key = passwordResetKey(token);
  const rawPayload = await redis.get(key);
  if (!rawPayload) {
    return {
      ok: false,
      error:
        "El enlace de recuperación expiró o ya fue utilizado. Solicita uno nuevo.",
    };
  }

  let payload: { userId: string; orgId: string; email: string };
  try {
    payload = JSON.parse(rawPayload) as {
      userId: string;
      orgId: string;
      email: string;
    };
  } catch {
    return { ok: false, error: "Token de recuperación corrupto." };
  }

  await redis.del(key);

  const db = getDb();
  const newHash = hashPassword(params.newPassword);
  const [updated] = await db
    .update(schema.usuarios)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.usuarios.id, payload.userId),
        eq(schema.usuarios.orgId, payload.orgId),
        eq(schema.usuarios.activo, true)
      )
    )
    .returning({ id: schema.usuarios.id });

  if (!updated) {
    return {
      ok: false,
      error: "La cuenta asociada ya no se encuentra activa.",
    };
  }

  await db.insert(schema.auditLogs).values({
    orgId: payload.orgId,
    usuarioId: payload.userId,
    accion: "PASSWORD_RESET_COMPLETADO",
    entidad: "usuarios",
    entidadId: payload.userId,
    ipOrigen: params.ipOrigen || null,
    detalle: { email: payload.email },
  });

  return { ok: true };
}
