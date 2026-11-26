import crypto from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { evaluateDeviceCreationLimit } from "@/services/admin/device-limits";
import type { DeviceType } from "@/services/sync/gps-incidence";

export const PAIRING_PIN_TTL_SECONDS = 600; // 10 minutos

export function generateSixDigitPin(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Genera el nombre automático para un dispositivo personal móvil:
 * `dispositivo_<primer_nombre>_<4_digitos>`.
 */
export function buildPersonalMobileDeviceName(
  nombreCompleto: string,
  randomDigits?: string
): string {
  const rawFirst = nombreCompleto.trim().split(/\s+/)[0] ?? "";
  const normalizedFirst = rawFirst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const safeFirst = normalizedFirst || "colaborador";
  const digits = randomDigits ?? String(crypto.randomInt(1000, 10000));
  return `dispositivo_${safeFirst}_${digits}`;
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
      tipo: schema.dispositivos.tipo,
      empleadoId: schema.dispositivos.empleadoId,
      empleadoNombre: schema.empleados.nombreCompleto,
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
    .leftJoin(
      schema.sucursales,
      eq(schema.dispositivos.sucursalId, schema.sucursales.id)
    )
    .leftJoin(
      schema.empleados,
      eq(schema.dispositivos.empleadoId, schema.empleados.id)
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
  payload: { orgId: string; dispositivoId: string; sucursalId: string | null }
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
  input: {
    sucursalId?: string | null;
    nombre?: string;
    tipo?: DeviceType;
    empleadoId?: string | null;
  }
) {
  const db = getDb();
  const deviceType: DeviceType =
    input.tipo === "dispositivo_personal_movil"
      ? "dispositivo_personal_movil"
      : "kiosco_sucursal";

  const [org] = await db
    .select({
      maxDispositivos: schema.organizaciones.maxDispositivos,
      maxEmpleados: schema.organizaciones.maxEmpleados,
    })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org) throw new Error("Organización no encontrada.");

  let resolvedSucursalId: string | null = null;
  let resolvedNombre = (input.nombre ?? "").trim();
  let assignedEmpleadoId: string | null = null;

  if (deviceType === "dispositivo_personal_movil") {
    if (!input.empleadoId) {
      throw new Error(
        "Un dispositivo personal móvil debe vincularse a un colaborador."
      );
    }
    const [emp] = await db
      .select({
        id: schema.empleados.id,
        activo: schema.empleados.activo,
        nombreCompleto: schema.empleados.nombreCompleto,
      })
      .from(schema.empleados)
      .where(
        and(
          eq(schema.empleados.id, input.empleadoId),
          eq(schema.empleados.orgId, orgId)
        )
      )
      .limit(1);

    if (!emp || !emp.activo) {
      throw new Error(
        "El colaborador seleccionado no existe o no está activo en tu organización."
      );
    }

    const [existingPersonal] = await db
      .select({ id: schema.dispositivos.id })
      .from(schema.dispositivos)
      .where(
        and(
          eq(schema.dispositivos.orgId, orgId),
          eq(schema.dispositivos.tipo, "dispositivo_personal_movil"),
          eq(schema.dispositivos.empleadoId, emp.id),
          eq(schema.dispositivos.activo, true)
        )
      )
      .limit(1);

    if (existingPersonal) {
      throw new Error(
        "Este colaborador ya tiene un dispositivo móvil personal asignado."
      );
    }

    const [mobileCnt] = await db
      .select({ value: count() })
      .from(schema.dispositivos)
      .innerJoin(
        schema.empleados,
        eq(schema.dispositivos.empleadoId, schema.empleados.id)
      )
      .where(
        and(
          eq(schema.dispositivos.orgId, orgId),
          eq(schema.dispositivos.activo, true),
          eq(schema.dispositivos.tipo, "dispositivo_personal_movil"),
          eq(schema.empleados.activo, true)
        )
      );

    const limit = evaluateDeviceCreationLimit({
      deviceType,
      activeKioskCount: 0,
      activePersonalMobileCount: mobileCnt?.value ?? 0,
      maxDispositivos: org.maxDispositivos,
      maxEmpleados: org.maxEmpleados,
    });
    if (!limit.allowed) {
      throw new Error(limit.error);
    }

    assignedEmpleadoId = emp.id;
    if (!resolvedNombre) {
      resolvedNombre = buildPersonalMobileDeviceName(emp.nombreCompleto);
    }
  } else {
    const [kioskCnt] = await db
      .select({ value: count() })
      .from(schema.dispositivos)
      .where(
        and(
          eq(schema.dispositivos.orgId, orgId),
          eq(schema.dispositivos.activo, true),
          eq(schema.dispositivos.tipo, "kiosco_sucursal")
        )
      );

    const limit = evaluateDeviceCreationLimit({
      deviceType,
      activeKioskCount: kioskCnt?.value ?? 0,
      activePersonalMobileCount: 0,
      maxDispositivos: org.maxDispositivos,
      maxEmpleados: org.maxEmpleados,
    });
    if (!limit.allowed) {
      throw new Error(limit.error);
    }

    if (!input.sucursalId) {
      throw new Error("Selecciona una sucursal para la terminal quiosco.");
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
    resolvedSucursalId = sucursal.id;
    if (resolvedNombre.length < 2) {
      throw new Error("Ingresa un nombre válido para la terminal.");
    }
  }

  const pin = generateSixDigitPin();
  const expiresAt = new Date(Date.now() + PAIRING_PIN_TTL_SECONDS * 1000);

  const [created] = await db
    .insert(schema.dispositivos)
    .values({
      orgId,
      sucursalId: resolvedSucursalId,
      tipo: deviceType,
      empleadoId: assignedEmpleadoId,
      nombre: resolvedNombre,
      pairingCode: pin,
      pairingExpiresAt: expiresAt,
    })
    .returning();

  if (!created) throw new Error("No se pudo registrar el dispositivo.");

  await storePairingPinInRedis(pin, {
    orgId,
    dispositivoId: created.id,
    sucursalId: resolvedSucursalId,
  });

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "DISPOSITIVO_CREADO",
    entidad: "dispositivos",
    entidadId: created.id,
    detalle: {
      nombre: created.nombre,
      sucursalId: resolvedSucursalId,
      tipo: deviceType,
      empleadoId: assignedEmpleadoId,
    },
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

export async function deactivatePersonalDevicesForEmployee(
  orgId: string,
  actorUserId: string,
  empleadoId: string,
  motivo = "Baja del colaborador"
): Promise<{ count: number }> {
  const db = getDb();
  const linkedDevices = await db
    .select({
      id: schema.dispositivos.id,
      nombre: schema.dispositivos.nombre,
      tokenHash: schema.dispositivos.tokenHash,
      pairingCode: schema.dispositivos.pairingCode,
    })
    .from(schema.dispositivos)
    .where(
      and(
        eq(schema.dispositivos.orgId, orgId),
        eq(schema.dispositivos.empleadoId, empleadoId),
        eq(schema.dispositivos.tipo, "dispositivo_personal_movil"),
        eq(schema.dispositivos.activo, true)
      )
    );

  if (linkedDevices.length === 0) {
    return { count: 0 };
  }

  const now = new Date();
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();

  for (const dev of linkedDevices) {
    if (dev.tokenHash) {
      await redis.set(deviceBlacklistKey(dev.tokenHash), now.toISOString());
    }
    if (dev.pairingCode) {
      await redis.del(pairingPinKey(dev.pairingCode));
    }

    const [usage] = await db
      .select({ value: count() })
      .from(schema.checadas)
      .where(
        and(
          eq(schema.checadas.orgId, orgId),
          eq(schema.checadas.dispositivoId, dev.id)
        )
      );

    const hardDeleted = (usage?.value ?? 0) === 0;
    if (hardDeleted) {
      await db
        .delete(schema.dispositivos)
        .where(
          and(
            eq(schema.dispositivos.id, dev.id),
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
          motivoRevocacion: motivo,
          pairingCode: null,
          pairingExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.dispositivos.id, dev.id),
            eq(schema.dispositivos.orgId, orgId)
          )
        );
    }

    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "DISPOSITIVO_REVOCADO_BAJA_EMPLEADO",
      entidad: "dispositivos",
      entidadId: dev.id,
      detalle: {
        empleadoId,
        nombre: dev.nombre,
        motivo,
        hardDeleted,
      },
    });
  }

  return { count: linkedDevices.length };
}
