import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { getRedis } from "@/lib/redis";
import { pairingPinKey } from "@/services/admin/devices";
import { hashDeviceToken } from "@/services/sync/device-auth";

export const dynamic = "force-dynamic";

const pairSchema = z.object({
  pin: z.string().trim().regex(/^\d{6}$/, "El PIN debe tener 6 dígitos."),
  plataforma: z.enum(["android", "ios", "web"]).optional().default("web"),
  appVersion: z.string().trim().max(40).optional().default("1.0.0"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 }
    );
  }

  const parsed = pairSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "El código de vinculación debe tener 6 dígitos." },
      { status: 422 }
    );
  }

  const { pin, plataforma, appVersion } = parsed.data;
  const db = getDb();
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();

  let dispositivoId: string | null = null;
  let orgId: string | null = null;

  const redisRaw = await redis.get(pairingPinKey(pin));
  if (redisRaw) {
    try {
      const payload = JSON.parse(redisRaw) as {
        orgId: string;
        dispositivoId: string;
      };
      dispositivoId = payload.dispositivoId;
      orgId = payload.orgId;
    } catch {
      // Fallback a DB
    }
  }

  const now = new Date();
  const [deviceRow] = dispositivoId && orgId
    ? await db
        .select({
          id: schema.dispositivos.id,
          orgId: schema.dispositivos.orgId,
          sucursalId: schema.dispositivos.sucursalId,
          nombre: schema.dispositivos.nombre,
          activo: schema.dispositivos.activo,
          sucursalNombre: schema.sucursales.nombre,
        })
        .from(schema.dispositivos)
        .innerJoin(
          schema.sucursales,
          eq(schema.dispositivos.sucursalId, schema.sucursales.id)
        )
        .where(
          and(
            eq(schema.dispositivos.id, dispositivoId),
            eq(schema.dispositivos.orgId, orgId)
          )
        )
        .limit(1)
    : await db
        .select({
          id: schema.dispositivos.id,
          orgId: schema.dispositivos.orgId,
          sucursalId: schema.dispositivos.sucursalId,
          nombre: schema.dispositivos.nombre,
          activo: schema.dispositivos.activo,
          sucursalNombre: schema.sucursales.nombre,
        })
        .from(schema.dispositivos)
        .innerJoin(
          schema.sucursales,
          eq(schema.dispositivos.sucursalId, schema.sucursales.id)
        )
        .where(
          and(
            eq(schema.dispositivos.pairingCode, pin),
            gt(schema.dispositivos.pairingExpiresAt, now)
          )
        )
        .limit(1);

  if (!deviceRow || !deviceRow.activo) {
    return Response.json(
      { ok: false, error: "PIN inválido, expirado o dispositivo revocado." },
      { status: 404 }
    );
  }

  const [org] = await db
    .select()
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, deviceRow.orgId))
    .limit(1);

  if (!org || org.estado === "suspendido" || org.estado === "cancelado") {
    return Response.json(
      {
        ok: false,
        code: "ORG_SUSPENDED",
        error: "La organización está suspendida o cancelada.",
      },
      { status: 403 }
    );
  }

  const deviceToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashDeviceToken(deviceToken);

  await db
    .update(schema.dispositivos)
    .set({
      tokenHash,
      pairingCode: null,
      pairingExpiresAt: null,
      plataforma,
      appVersion,
      ultimoSyncAt: now,
      ultimoHeartbeatAt: now,
      updatedAt: now,
    })
    .where(eq(schema.dispositivos.id, deviceRow.id));

  await redis.del(pairingPinKey(pin));

  await db.insert(schema.auditLogs).values({
    orgId: org.id,
    accion: "DISPOSITIVO_VINCULADO",
    entidad: "dispositivos",
    entidadId: deviceRow.id,
    detalle: { plataforma, appVersion },
  });

  // Descarga inicial de empleados y vectores activos para operación offline inmediata
  const [employees, vectors] = await Promise.all([
    db
      .select({
        id: schema.empleados.id,
        nombreCompleto: schema.empleados.nombreCompleto,
        codigoInterno: schema.empleados.codigoInterno,
        puesto: schema.empleados.puesto,
        horarioId: schema.empleados.horarioId,
        activo: schema.empleados.activo,
      })
      .from(schema.empleados)
      .where(
        and(
          eq(schema.empleados.orgId, org.id),
          eq(schema.empleados.activo, true)
        )
      ),
    db
      .select({
        id: schema.empleadoVectores.id,
        empleadoId: schema.empleadoVectores.empleadoId,
        embedding: schema.empleadoVectores.embedding,
      })
      .from(schema.empleadoVectores)
      .where(
        and(
          eq(schema.empleadoVectores.orgId, org.id),
          eq(schema.empleadoVectores.activo, true)
        )
      ),
  ]);

  return Response.json({
    ok: true,
    deviceToken,
    device: {
      id: deviceRow.id,
      nombre: deviceRow.nombre,
      sucursalId: deviceRow.sucursalId,
      sucursalNombre: deviceRow.sucursalNombre,
      plataforma,
    },
    organization: {
      id: org.id,
      nombre: org.nombre,
      logoUrl: org.logoUrl,
      colorPrimario: org.colorPrimario,
      colorSecundario: org.colorSecundario,
      mensajeBienvenida: org.mensajeBienvenida ?? "Bienvenido",
      cloudEvidencesEnabled: org.cloudEvidencesEnabled,
      horasSemanalesMax: Number(org.horasSemanalesMax),
      pinAuditoriaHash: org.pinAuditoriaHash ?? null,
    },
    employees,
    vectors,
  });
}
