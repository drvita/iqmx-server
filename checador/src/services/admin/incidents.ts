import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type ResolvableIncidentStatus = "justificada" | "resuelta";

export interface ResolveIncidentInput {
  checadaId: string;
  estado: ResolvableIncidentStatus;
  motivo: string;
}

export function validateIncidentResolutionInput(input: {
  estado: string;
  motivo: string;
}): { ok: true; estado: ResolvableIncidentStatus; motivo: string } | { ok: false; error: string } {
  if (input.estado !== "justificada" && input.estado !== "resuelta") {
    return {
      ok: false,
      error: "El estado de resolución debe ser justificada o resuelta.",
    };
  }
  const cleanMotivo = input.motivo.trim();
  if (cleanMotivo.length < 5) {
    return {
      ok: false,
      error: "Ingresa un motivo de al menos 5 caracteres para la bitácora.",
    };
  }
  if (cleanMotivo.length > 500) {
    return {
      ok: false,
      error: "El motivo no puede exceder 500 caracteres.",
    };
  }
  return { ok: true, estado: input.estado, motivo: cleanMotivo };
}

/**
 * Resuelve o justifica una incidencia de checada sin alterar los datos originales
 * de hora, tipo o coordenadas, y deja registro inmutable en `audit_logs`.
 */
export async function resolveCheckInIncident(
  orgId: string,
  actorUserId: string,
  input: ResolveIncidentInput
) {
  const validated = validateIncidentResolutionInput(input);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const db = getDb();
  const [existing] = await db
    .select({
      id: schema.checadas.id,
      empleadoId: schema.checadas.empleadoId,
      tipo: schema.checadas.tipo,
      incidenciaUbicacion: schema.checadas.incidenciaUbicacion,
      incidenciaEstado: schema.checadas.incidenciaEstado,
      desfaseRelojSeg: schema.checadas.desfaseRelojSeg,
    })
    .from(schema.checadas)
    .where(
      and(
        eq(schema.checadas.id, input.checadaId),
        eq(schema.checadas.orgId, orgId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new Error("Registro de asistencia no encontrado.");
  }

  const now = new Date();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(schema.checadas)
      .set({
        incidenciaEstado: validated.estado,
        incidenciaMotivo: validated.motivo,
        incidenciaResueltaPor: actorUserId,
        incidenciaResueltaAt: now,
      })
      .where(
        and(
          eq(schema.checadas.id, input.checadaId),
          eq(schema.checadas.orgId, orgId)
        )
      )
      .returning({
        id: schema.checadas.id,
        incidenciaEstado: schema.checadas.incidenciaEstado,
        incidenciaMotivo: schema.checadas.incidenciaMotivo,
        incidenciaResueltaAt: schema.checadas.incidenciaResueltaAt,
      });

    await tx.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "INCIDENCIA_RESUELTA",
      entidad: "checadas",
      entidadId: existing.id,
      detalle: {
        empleadoId: existing.empleadoId,
        tipoMovimiento: existing.tipo,
        incidenciaUbicacion: existing.incidenciaUbicacion,
        estadoAnterior: existing.incidenciaEstado ?? "abierta",
        estadoNuevo: validated.estado,
        motivo: validated.motivo,
      },
    });

    return rows;
  });

  if (!updated) {
    throw new Error("No se pudo actualizar la incidencia.");
  }

  return updated;
}
