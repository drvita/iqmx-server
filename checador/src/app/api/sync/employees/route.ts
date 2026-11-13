import { NextResponse } from "next/server";
import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireSyncDevice } from "@/services/sync/device-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireSyncDevice(req, "employees");
  if (!gate.ok) return gate.response;

  const { auth } = gate;
  const orgId = auth.org.id;
  const url = new URL(req.url);
  const sinceRaw = url.searchParams.get("since");

  let sinceDate: Date | null = null;
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (!Number.isNaN(parsed.getTime())) {
      sinceDate = parsed;
    }
  }

  const db = getDb();

  const [orgRow] = await db
    .select({
      id: schema.organizaciones.id,
      nombre: schema.organizaciones.nombre,
      logoUrl: schema.organizaciones.logoUrl,
      colorPrimario: schema.organizaciones.colorPrimario,
      colorSecundario: schema.organizaciones.colorSecundario,
      mensajeBienvenida: schema.organizaciones.mensajeBienvenida,
      cloudEvidencesEnabled: schema.organizaciones.cloudEvidencesEnabled,
      horasSemanalesMax: schema.organizaciones.horasSemanalesMax,
      pinAuditoriaHash: schema.organizaciones.pinAuditoriaHash,
    })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  const empConditions = [eq(schema.empleados.orgId, orgId)];
  if (sinceDate) {
    empConditions.push(gt(schema.empleados.updatedAt, sinceDate));
  }

  const changedEmployees = await db
    .select({
      id: schema.empleados.id,
      nombreCompleto: schema.empleados.nombreCompleto,
      codigoInterno: schema.empleados.codigoInterno,
      puesto: schema.empleados.puesto,
      horarioId: schema.empleados.horarioId,
      activo: schema.empleados.activo,
    })
    .from(schema.empleados)
    .where(and(...empConditions));

  const activeEmployees = changedEmployees.filter((e) => e.activo);
  const deletedIds = changedEmployees
    .filter((e) => !e.activo)
    .map((e) => e.id);

  // Siempre incluir bajas totales si no hay since, o las bajas desde `since`
  const activeIds = activeEmployees.map((e) => e.id);
  const vectors =
    activeIds.length > 0
      ? await db
          .select({
            id: schema.empleadoVectores.id,
            empleadoId: schema.empleadoVectores.empleadoId,
            embedding: schema.empleadoVectores.embedding,
          })
          .from(schema.empleadoVectores)
          .where(
            and(
              eq(schema.empleadoVectores.orgId, orgId),
              eq(schema.empleadoVectores.activo, true),
              inArray(schema.empleadoVectores.empleadoId, activeIds)
            )
          )
      : [];

  await db
    .update(schema.dispositivos)
    .set({ ultimoSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.dispositivos.id, auth.device.id));

  return NextResponse.json({
    ok: true,
    fullSync: sinceDate === null,
    serverTime: new Date().toISOString(),
    organization: orgRow ?? null,
    employees: activeEmployees,
    deletedIds,
    vectors: vectors.map((v) => ({
      id: v.id,
      empleadoId: v.empleadoId,
      embedding: Array.from(v.embedding),
    })),
  });
}
