import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { saveCloudEvidenceJpeg } from "@/lib/storage/media";
import { requireSyncDevice } from "@/services/sync/device-auth";

const attendanceRecordSchema = z.object({
  id: z.string().uuid(),
  empleadoId: z.string().uuid().nullable(),
  tipo: z.enum(["entrada", "salida", "inicio_comida", "fin_comida"]),
  estado: z.enum(["valido", "rechazado_spoof", "rechazado_desconocido"]),
  timestampLocal: z.number().finite(),
  livenessScore: z.number().finite().nullable().optional(),
  matchConfidence: z.number().finite().nullable().optional(),
  relojAlterado: z.boolean().optional(),
  evidenciaBase64: z.string().max(700_000).nullable().optional(),
});

const batchSchema = z.object({
  clientTimeMs: z.number().finite().optional(),
  records: z.array(attendanceRecordSchema).max(100),
});

export async function POST(req: Request) {
  const gate = await requireSyncDevice(req, "attendance");
  if (!gate.ok) return gate.response;

  const { auth } = gate;
  const body = await req.json().catch(() => null);
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Lote de checadas inválido." },
      { status: 400 }
    );
  }

  const records = parsed.data.records;
  if (records.length === 0) {
    return NextResponse.json({
      ok: true,
      acceptedIds: [],
      cloudEvidencesEnabled: auth.org.cloudEvidencesEnabled,
    });
  }

  const db = getDb();
  const serverNow = new Date();
  const serverNowMs = serverNow.getTime();

  // Verificar que los empleadoId pertenezcan a la misma organización (evitar FK violations o cross-tenant)
  const candidateEmpIds = Array.from(
    new Set(
      records.map((r) => r.empleadoId).filter((id): id is string => Boolean(id))
    )
  );
  const validEmpIds = new Set<string>();
  if (candidateEmpIds.length > 0) {
    const empRows = await db
      .select({ id: schema.empleados.id })
      .from(schema.empleados)
      .where(
        and(
          eq(schema.empleados.orgId, auth.org.id),
          inArray(schema.empleados.id, candidateEmpIds)
        )
      );
    for (const row of empRows) {
      validEmpIds.add(row.id);
    }
  }

  const rowsToInsert = await Promise.all(
    records.map(async (r) => {
      let fotoEvidenciaKey: string | null = null;
      if (auth.org.cloudEvidencesEnabled && r.evidenciaBase64) {
        fotoEvidenciaKey = await saveCloudEvidenceJpeg(
          auth.org.id,
          r.id,
          r.evidenciaBase64
        ).catch(() => null);
      }

      let desfaseRelojSeg =
        typeof parsed.data.clientTimeMs === "number"
          ? Math.round((serverNowMs - parsed.data.clientTimeMs) / 1000)
          : 0;
      if (r.timestampLocal > serverNowMs + 120_000) {
        desfaseRelojSeg = Math.round((serverNowMs - r.timestampLocal) / 1000);
      } else if (r.relojAlterado && Math.abs(desfaseRelojSeg) <= 120) {
        desfaseRelojSeg = -9999;
      }
      const safeEmpleadoId =
        r.empleadoId && validEmpIds.has(r.empleadoId) ? r.empleadoId : null;

      return {
        id: r.id,
        orgId: auth.org.id,
        sucursalId: auth.device.sucursalId,
        dispositivoId: auth.device.id,
        empleadoId: safeEmpleadoId,
        tipo: r.tipo,
        estado: r.estado,
        timestampLocal: new Date(r.timestampLocal),
        timestampServidor: serverNow,
        desfaseRelojSeg,
        livenessScore: r.livenessScore ?? null,
        matchConfidence: r.matchConfidence ?? null,
        fotoEvidenciaKey,
      };
    })
  );

  await db
    .insert(schema.checadas)
    .values(rowsToInsert)
    .onConflictDoNothing({ target: schema.checadas.id });

  await db
    .update(schema.dispositivos)
    .set({ ultimoSyncAt: serverNow, updatedAt: serverNow })
    .where(eq(schema.dispositivos.id, auth.device.id));

  return NextResponse.json({
    ok: true,
    acceptedIds: records.map((r) => r.id),
    cloudEvidencesEnabled: auth.org.cloudEvidencesEnabled,
    serverTime: serverNow.toISOString(),
  });
}
