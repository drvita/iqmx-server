import crypto from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";

export const PAIRING_PIN_TTL_SECONDS = 600; // 10 minutos

export function generateSixDigitPin(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function deviceBlacklistKey(tokenHash: string): string {
  return `blacklist:device:${tokenHash}`;
}

export function pairingPinKey(pin: string): string {
  return `pairing:pin:${pin}`;
}

export async function listDevices(orgId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.dispositivos.id,
      sucursalId: schema.dispositivos.sucursalId,
      sucursalNombre: schema.sucursales.nombre,
      nombre: schema.dispositivos.nombre,
      pairingCode: schema.dispositivos.pairingCode,
      pairingExpiresAt: schema.dispositivos.pairingExpiresAt,
      appVersion: schema.dispositivos.appVersion,
      plataforma: schema.dispositivos.plataforma,
      ultimoSyncAt: schema.dispositivos.ultimoSyncAt,
      ultimoHeartbeatAt: schema.dispositivos.ultimoHeartbeatAt,
      activo: schema.dispositivos.activo,
      revocadoAt: schema.dispositivos.revocadoAt,
      motivoRevocacion: schema.dispositivos.motivoRevocacion,
      vinculado: schema.dispositivos.tokenHash,
      createdAt: schema.dispositivos.createdAt,
    })
    .from(schema.dispositivos)
    .innerJoin(
      schema.sucursales,
      eq(schema.dispositivos.sucursalId, schema.sucursales.id)
    )
    .where(
      and(
        eq(schema.dispositivos.orgId, orgId),
        eq(schema.dispositivos.activo, true)
      )
    )
    .orderBy(desc(schema.dispositivos.createdAt));
}

async function storePairingPinInRedis(
  pin: string,
  payload: { orgId: string; dispositivoId: string; sucursalId: string }
): Promise<void> {
  const redis = getRedis();
  if (redis.status === "wait") {
    await redis.connect();
  }
  await redis.set(
    pairingPinKey(pin),
    JSON.stringify(payload),
    "EX",
    PAIRING_PIN_TTL_SECONDS
  );
}

export async function createDeviceWithPin(
  orgId: string,
  actorUserId: string,
  input: { sucursalId: string; nombre: string }
) {
  const db = getDb();

  const [org] = await db
    .select({ maxDispositivos: schema.organizaciones.maxDispositivos })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org) throw new Error("Organización no encontrada.");

  const [cnt] = await db
    .select({ value: count() })
    .from(schema.dispositivos)
    .where(
      and(
        eq(schema.dispositivos.orgId, orgId),
        eq(schema.dispositivos.activo, true)
      )
    );

  if ((cnt?.value ?? 0) >= org.maxDispositivos) {
    throw new Error(
      `PLAN_LIMIT_DEVICES: Alcanzaste el límite de ${org.maxDispositivos} dispositivo(s) de tu plan.`
    );
  }

  const [sucursal] = await db
    .select({ id: schema.sucursales.id })
    .from(schema.sucursales)
    .where(
      and(
        eq(schema.sucursales.id, input.sucursalId),
        eq(schema.sucursales.orgId, orgId)
      )
    )
    .limit(1);

  if (!sucursal) {
    throw new Error("La sucursal seleccionada no pertenece a tu organización.");
  }

  const pin = generateSixDigitPin();
  const expiresAt = new Date(Date.now() + PAIRING_PIN_TTL_SECONDS * 1000);

  const [created] = await db
    .insert(schema.dispositivos)
    .values({
      orgId,
      sucursalId: sucursal.id,
      nombre: input.nombre.trim(),
      pairingCode: pin,
      pairingExpiresAt: expiresAt,
    })
    .returning();

  if (!created) throw new Error("No se pudo registrar el dispositivo.");

  await storePairingPinInRedis(pin, {
    orgId,
    dispositivoId: created.id,
    sucursalId: sucursal.id,
  });

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "DISPOSITIVO_CREADO",
    entidad: "dispositivos",
    entidadId: created.id,
    detalle: { nombre: created.nombre, sucursalId: sucursal.id },
  });

  return created;
}

export async function regenerateDevicePin(
  orgId: string,
  actorUserId: string,
  dispositivoId: string
) {
  const db = getDb();
  const [existing] = await db
    .select({
      id: schema.dispositivos.id,
      sucursalId: schema.dispositivos.sucursalId,
      tokenHash: schema.dispositivos.tokenHash,
      pairingCode: schema.dispositivos.pairingCode,
      activo: schema.dispositivos.activo,
    })
    .from(schema.dispositivos)
    .where(
      and(
        eq(schema.dispositivos.id, dispositivoId),
        eq(schema.dispositivos.orgId, orgId)
      )
    )
    .limit(1);

  if (!existing || !existing.activo) {
    throw new Error("Dispositivo no encontrado o eliminado.");
  }

  const now = new Date();
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();
  if (existing.tokenHash) {
    await redis.set(deviceBlacklistKey(existing.tokenHash), now.toISOString());
  }
  if (existing.pairingCode) {
    await redis.del(pairingPinKey(existing.pairingCode));
  }

  const pin = generateSixDigitPin();
  const expiresAt = new Date(Date.now() + PAIRING_PIN_TTL_SECONDS * 1000);

  const [updated] = await db
    .update(schema.dispositivos)
    .set({
      tokenHash: null,
      plataforma: null,
      appVersion: null,
      revocadoAt: null,
      motivoRevocacion: null,
      pairingCode: pin,
      pairingExpiresAt: expiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.dispositivos.id, dispositivoId),
        eq(schema.dispositivos.orgId, orgId)
      )
    )
    .returning();

  await storePairingPinInRedis(pin, {
    orgId,
    dispositivoId,
    sucursalId: existing.sucursalId,
  });

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: existing.tokenHash
      ? "DISPOSITIVO_DESVINCULADO_Y_PIN"
      : "DISPOSITIVO_PIN_GENERADO",
    entidad: "dispositivos",
    entidadId: dispositivoId,
    detalle: {
      expiresAt: expiresAt.toISOString(),
      unlinkedPreviousToken: Boolean(existing.tokenHash),
    },
  });

  return updated ?? null;
}

export async function revokeDevice(
  orgId: string,
  actorUserId: string,
  dispositivoId: string,
  motivo = "Desvinculado desde el panel administrativo"
) {
  const db = getDb();
  const [existing] = await db
    .select({
      id: schema.dispositivos.id,
      sucursalId: schema.dispositivos.sucursalId,
      tokenHash: schema.dispositivos.tokenHash,
      pairingCode: schema.dispositivos.pairingCode,
    })
    .from(schema.dispositivos)
    .where(
      and(
        eq(schema.dispositivos.id, dispositivoId),
        eq(schema.dispositivos.orgId, orgId)
      )
    )
    .limit(1);

  if (!existing) return null;

  const now = new Date();
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();
  if (existing.tokenHash) {
    await redis.set(
      deviceBlacklistKey(existing.tokenHash),
      now.toISOString()
    );
  }
  if (existing.pairingCode) {
    await redis.del(pairingPinKey(existing.pairingCode));
  }

  const pin = generateSixDigitPin();
  const expiresAt = new Date(Date.now() + PAIRING_PIN_TTL_SECONDS * 1000);

  const [updated] = await db
    .update(schema.dispositivos)
    .set({
      activo: true,
      tokenHash: null,
      plataforma: null,
      appVersion: null,
      revocadoAt: null,
      motivoRevocacion: null,
      pairingCode: pin,
      pairingExpiresAt: expiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.dispositivos.id, dispositivoId),
        eq(schema.dispositivos.orgId, orgId)
      )
    )
    .returning();

  await storePairingPinInRedis(pin, {
    orgId,
    dispositivoId,
    sucursalId: existing.sucursalId,
  });

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "DISPOSITIVO_DESVINCULADO",
    entidad: "dispositivos",
    entidadId: dispositivoId,
    detalle: { motivo, blacklisted: Boolean(existing.tokenHash) },
  });

  return updated ?? null;
}

export async function deleteDevice(
  orgId: string,
  actorUserId: string,
  dispositivoId: string
) {
  const db = getDb();
  const [existing] = await db
    .select({
      id: schema.dispositivos.id,
      nombre: schema.dispositivos.nombre,
      tokenHash: schema.dispositivos.tokenHash,
      pairingCode: schema.dispositivos.pairingCode,
    })
    .from(schema.dispositivos)
    .where(
      and(
        eq(schema.dispositivos.id, dispositivoId),
        eq(schema.dispositivos.orgId, orgId)
      )
    )
    .limit(1);

  if (!existing) return null;

  const now = new Date();
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();
  if (existing.tokenHash) {
    await redis.set(
      deviceBlacklistKey(existing.tokenHash),
      now.toISOString()
    );
  }
  if (existing.pairingCode) {
    await redis.del(pairingPinKey(existing.pairingCode));
  }

  const [usage] = await db
    .select({ value: count() })
    .from(schema.checadas)
    .where(
      and(
        eq(schema.checadas.orgId, orgId),
        eq(schema.checadas.dispositivoId, dispositivoId)
      )
    );

  if ((usage?.value ?? 0) === 0) {
    await db
      .delete(schema.dispositivos)
      .where(
        and(
          eq(schema.dispositivos.id, dispositivoId),
          eq(schema.dispositivos.orgId, orgId)
        )
      );
  } else {
    await db
      .update(schema.dispositivos)
      .set({
        activo: false,
        tokenHash: null,
        revocadoAt: now,
        motivoRevocacion: "Eliminado desde el panel administrativo",
        pairingCode: null,
        pairingExpiresAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.dispositivos.id, dispositivoId),
          eq(schema.dispositivos.orgId, orgId)
        )
      );
  }

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "DISPOSITIVO_ELIMINADO",
    entidad: "dispositivos",
    entidadId: dispositivoId,
    detalle: {
      nombre: existing.nombre,
      hardDeleted: (usage?.value ?? 0) === 0,
    },
  });

  return { id: dispositivoId };
}

export async function updateDeviceName(
  orgId: string,
  actorUserId: string,
  dispositivoId: string,
  nombre: string
) {
  const db = getDb();
  const [updated] = await db
    .update(schema.dispositivos)
    .set({
      nombre: nombre.trim(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.dispositivos.id, dispositivoId),
        eq(schema.dispositivos.orgId, orgId)
      )
    )
    .returning();

  if (!updated) throw new Error("Dispositivo no encontrado.");

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "DISPOSITIVO_RENOMBRADO",
    entidad: "dispositivos",
    entidadId: dispositivoId,
    detalle: { nombre: updated.nombre },
  });

  return updated;
}
