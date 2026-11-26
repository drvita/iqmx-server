import { and, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { computeAcknowledgmentIntegrityHash } from "@/lib/security/integrity-seal";
import {
  computeWeeklyCompliance,
  formatDateKeyInTz,
  resolveReportDateRange,
  type CheckInEvent,
  type EmployeeScheduleInfo,
  type JornadaType,
  type ReportPeriodType,
} from "@/services/reports/attendance-compliance";

export type AcknowledgmentStatus = "aceptado" | "rechazado";
export type AcknowledgmentOrigin = "kiosco_touch" | "movil_personal";

export function getIsoWeekdayInTz(
  date: Date,
  timeZone: string = "America/Mexico_City"
): number {
  const dateKey = formatDateKeyInTz(date, timeZone);
  const [y = "1970", m = "01", d = "01"] = dateKey.split("-");
  const utcDay = new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d))
  ).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

/**
 * Determina si la fecha actual corresponde al último día laboral programado
 * del colaborador en su horario (o viernes/sábado si no tiene horario asignado).
 */
export function isLastScheduledWorkday(
  diasLaborales: number[] | null | undefined,
  date: Date = new Date(),
  timeZone: string = "America/Mexico_City"
): boolean {
  const isoDay = getIsoWeekdayInTz(date, timeZone);
  const validDays = (diasLaborales ?? []).filter(
    (d) => Number.isInteger(d) && d >= 1 && d <= 7
  );
  if (validDays.length > 0) {
    const maxDay = Math.max(...validDays);
    return isoDay === maxDay;
  }
  return isoDay === 5 || isoDay === 6;
}

export function resolveCurrentAcknowledgmentPeriod(
  periodicidad: string | null | undefined,
  now: Date = new Date(),
  timeZone: string = "America/Mexico_City"
) {
  const period: ReportPeriodType =
    periodicidad === "catorcenal" ||
    periodicidad === "quincenal" ||
    periodicidad === "mensual"
      ? periodicidad
      : "semanal";

  const range = resolveReportDateRange({
    period,
    now,
    timeZone,
  });

  return {
    ...range,
    periodoClave: `${range.startDateKey}_${range.endDateKey}`,
  };
}

export interface EmployeeAcknowledgmentSummaryResult {
  employee: {
    id: string;
    nombreCompleto: string;
    codigoInterno: string | null;
    puesto: string | null;
  };
  period: {
    tipo: ReportPeriodType;
    periodoClave: string;
    startDateKey: string;
    endDateKey: string;
    label: string;
  };
  summary: {
    ordinaryHours: number;
    doubleOvertimeHours: number;
    tripleOvertimeHours: number;
    totalHours: number;
    tardies: number;
    daysComplete: number;
    tipoJornada: JornadaType;
    maxHours: number;
  };
  isLastWorkday: boolean;
  acknowledgment: {
    id: string;
    estado: AcknowledgmentStatus;
    origen: AcknowledgmentOrigin;
    horasOrdinarias: number;
    horasExtrasDobles: number;
    horasExtrasTriples: number;
    totalHoras: number;
    resueltoAt: string | null;
    notaResolucion: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export async function getEmployeeCurrentAcknowledgmentSummary(
  orgId: string,
  empleadoId: string,
  now: Date = new Date()
): Promise<EmployeeAcknowledgmentSummaryResult | null> {
  const db = getDb();

  const [org] = await db
    .select({
      id: schema.organizaciones.id,
      zonaHoraria: schema.organizaciones.zonaHoraria,
      horasSemanalesMax: schema.organizaciones.horasSemanalesMax,
      horasSemanalesMixta: schema.organizaciones.horasSemanalesMixta,
      horasSemanalesNocturna: schema.organizaciones.horasSemanalesNocturna,
      periodicidadReporte: schema.organizaciones.periodicidadReporte,
    })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org) return null;

  const [emp] = await db
    .select({
      id: schema.empleados.id,
      codigoInterno: schema.empleados.codigoInterno,
      nombreCompleto: schema.empleados.nombreCompleto,
      puesto: schema.empleados.puesto,
      horarioId: schema.empleados.horarioId,
      activo: schema.empleados.activo,
    })
    .from(schema.empleados)
    .where(
      and(
        eq(schema.empleados.id, empleadoId),
        eq(schema.empleados.orgId, orgId),
        eq(schema.empleados.activo, true)
      )
    )
    .limit(1);

  if (!emp) return null;

  const scheduleRow = emp.horarioId
    ? await db
        .select({
          id: schema.horarios.id,
          horaEntrada: schema.horarios.horaEntrada,
          horaSalida: schema.horarios.horaSalida,
          toleranciaMin: schema.horarios.toleranciaMin,
          minutosComida: schema.horarios.minutosComida,
          diasLaborales: schema.horarios.diasLaborales,
          tipoJornada: schema.horarios.tipoJornada,
          horasSemanalesLimite: schema.horarios.horasSemanalesLimite,
        })
        .from(schema.horarios)
        .where(
          and(
            eq(schema.horarios.id, emp.horarioId),
            eq(schema.horarios.orgId, orgId)
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const period = resolveCurrentAcknowledgmentPeriod(
    org.periodicidadReporte,
    now,
    org.zonaHoraria
  );

  // Margen +1 día para cubrir turnos nocturnos que cruzan medianoche
  const queryEndWithMargin = new Date(
    period.queryEnd.getTime() + 24 * 60 * 60 * 1000
  );

  const [checkIns, existingAck] = await Promise.all([
    db
      .select({
        id: schema.checadas.id,
        empleadoId: schema.checadas.empleadoId,
        tipo: schema.checadas.tipo,
        estado: schema.checadas.estado,
        timestampLocal: schema.checadas.timestampLocal,
      })
      .from(schema.checadas)
      .where(
        and(
          eq(schema.checadas.orgId, orgId),
          eq(schema.checadas.empleadoId, empleadoId),
          gte(schema.checadas.timestampLocal, period.queryStart),
          lte(schema.checadas.timestampLocal, queryEndWithMargin)
        )
      ),
    db
      .select()
      .from(schema.acusesSemanales)
      .where(
        and(
          eq(schema.acusesSemanales.orgId, orgId),
          eq(schema.acusesSemanales.empleadoId, empleadoId),
          eq(schema.acusesSemanales.periodoClave, period.periodoClave)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const schedulesById = new Map<string, EmployeeScheduleInfo>();
  if (scheduleRow) {
    schedulesById.set(scheduleRow.id, {
      horaEntrada: String(scheduleRow.horaEntrada),
      horaSalida: String(scheduleRow.horaSalida),
      toleranciaMin: scheduleRow.toleranciaMin,
      minutosComida: scheduleRow.minutosComida,
      tipoJornada: (scheduleRow.tipoJornada === "mixta" ||
      scheduleRow.tipoJornada === "nocturna"
        ? scheduleRow.tipoJornada
        : "diurna") as JornadaType,
      horasSemanalesLimite: scheduleRow.horasSemanalesLimite
        ? Number(scheduleRow.horasSemanalesLimite)
        : null,
    });
  }

  const [compliance] = computeWeeklyCompliance({
    employees: [
      {
        id: emp.id,
        codigoInterno: emp.codigoInterno,
        nombreCompleto: emp.nombreCompleto,
        puesto: emp.puesto,
        horarioId: emp.horarioId,
      },
    ],
    checkIns: checkIns as CheckInEvent[],
    schedulesById,
    horasSemanalesMax: Number(org.horasSemanalesMax),
    orgWeeklyLimits: {
      diurna: Number(org.horasSemanalesMax),
      mixta: Number(org.horasSemanalesMixta),
      nocturna: Number(org.horasSemanalesNocturna),
    },
    timeZone: org.zonaHoraria,
    todayKey: formatDateKeyInTz(now, org.zonaHoraria),
    startDateKey: period.startDateKey,
    endDateKey: period.endDateKey,
  });

  const isLastWorkday = isLastScheduledWorkday(
    scheduleRow?.diasLaborales,
    now,
    org.zonaHoraria
  );

  return {
    employee: {
      id: emp.id,
      nombreCompleto: emp.nombreCompleto,
      codigoInterno: emp.codigoInterno,
      puesto: emp.puesto,
    },
    period: {
      tipo: period.period,
      periodoClave: period.periodoClave,
      startDateKey: period.startDateKey,
      endDateKey: period.endDateKey,
      label: period.label,
    },
    summary: {
      ordinaryHours: compliance?.ordinaryHours ?? 0,
      doubleOvertimeHours: compliance?.doubleOvertimeHours ?? 0,
      tripleOvertimeHours: compliance?.tripleOvertimeHours ?? 0,
      totalHours: compliance?.workedHours ?? 0,
      tardies: compliance?.tardies ?? 0,
      daysComplete: compliance?.daysComplete ?? 0,
      tipoJornada: compliance?.tipoJornada ?? "diurna",
      maxHours: compliance?.maxHours ?? Number(org.horasSemanalesMax),
    },
    isLastWorkday,
    acknowledgment: existingAck
      ? {
          id: existingAck.id,
          estado: existingAck.estado as AcknowledgmentStatus,
          origen: existingAck.origen as AcknowledgmentOrigin,
          horasOrdinarias: Number(existingAck.horasOrdinarias),
          horasExtrasDobles: Number(existingAck.horasExtrasDobles),
          horasExtrasTriples: Number(existingAck.horasExtrasTriples),
          totalHoras: Number(existingAck.totalHoras),
          resueltoAt: existingAck.resueltoAt
            ? existingAck.resueltoAt.toISOString()
            : null,
          notaResolucion: existingAck.notaResolucion,
          createdAt: existingAck.createdAt.toISOString(),
          updatedAt: existingAck.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function recordEmployeeAcknowledgment(params: {
  orgId: string;
  empleadoId: string;
  dispositivoId: string | null;
  estado: AcknowledgmentStatus;
  origen: AcknowledgmentOrigin;
  now?: Date;
}) {
  const { orgId, empleadoId, dispositivoId, estado, origen, now = new Date() } =
    params;
  const db = getDb();

  const [org] = await db
    .select({
      acuseSemanalEnabled: schema.organizaciones.acuseSemanalEnabled,
      zonaHoraria: schema.organizaciones.zonaHoraria,
    })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org || !org.acuseSemanalEnabled) {
    throw new Error(
      "El acuse de conformidad de asistencia no está habilitado para esta organización."
    );
  }

  const current = await getEmployeeCurrentAcknowledgmentSummary(
    orgId,
    empleadoId,
    now
  );
  if (!current) {
    throw new Error("Colaborador activo no encontrado.");
  }

  if (current.acknowledgment?.estado === "aceptado") {
    return current.acknowledgment;
  }

  const period = resolveCurrentAcknowledgmentPeriod(
    current.period.tipo,
    now,
    org.zonaHoraria
  );

  const ordStr = current.summary.ordinaryHours.toFixed(2);
  const dblStr = current.summary.doubleOvertimeHours.toFixed(2);
  const trpStr = current.summary.tripleOvertimeHours.toFixed(2);
  const totStr = current.summary.totalHours.toFixed(2);
  const timestampIso = now.toISOString();

  const selloIntegridadSha256 = computeAcknowledgmentIntegrityHash({
    orgId,
    empleadoId,
    periodoClave: current.period.periodoClave,
    horasOrdinarias: ordStr,
    horasExtrasDobles: dblStr,
    horasExtrasTriples: trpStr,
    totalHoras: totStr,
    estado,
    origen,
    timestampIso,
  });

  const [saved] = await db
    .insert(schema.acusesSemanales)
    .values({
      orgId,
      empleadoId,
      dispositivoId,
      periodoClave: current.period.periodoClave,
      periodoInicio: period.queryStart,
      periodoFin: period.queryEnd,
      horasOrdinarias: ordStr,
      horasExtrasDobles: dblStr,
      horasExtrasTriples: trpStr,
      totalHoras: totStr,
      estado,
      origen,
      selloIntegridadSha256,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.acusesSemanales.orgId,
        schema.acusesSemanales.empleadoId,
        schema.acusesSemanales.periodoClave,
      ],
      set: {
        dispositivoId,
        horasOrdinarias: ordStr,
        horasExtrasDobles: dblStr,
        horasExtrasTriples: trpStr,
        totalHoras: totStr,
        estado,
        origen,
        selloIntegridadSha256,
        resueltoPor: null,
        resueltoAt: null,
        notaResolucion: null,
        updatedAt: now,
      },
    })
    .returning();

  if (!saved) {
    throw new Error("No se pudo guardar el acuse semanal.");
  }

  await db.insert(schema.auditLogs).values({
    orgId,
    accion:
      estado === "aceptado"
        ? "ACUSE_SEMANAL_ACEPTADO"
        : "ACUSE_SEMANAL_RECHAZADO",
    entidad: "acuses_semanales",
    entidadId: saved.id,
    detalle: {
      empleadoId,
      periodoClave: current.period.periodoClave,
      totalHoras: totStr,
      origen,
    },
  });

  return {
    id: saved.id,
    estado: saved.estado as AcknowledgmentStatus,
    origen: saved.origen as AcknowledgmentOrigin,
    horasOrdinarias: Number(saved.horasOrdinarias),
    horasExtrasDobles: Number(saved.horasExtrasDobles),
    horasExtrasTriples: Number(saved.horasExtrasTriples),
    totalHoras: Number(saved.totalHoras),
    resueltoAt: saved.resueltoAt ? saved.resueltoAt.toISOString() : null,
    notaResolucion: saved.notaResolucion,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  };
}

export async function resolveAcknowledgmentDiscrepancy(params: {
  orgId: string;
  acuseId: string;
  actorUserId: string;
  nota?: string | null;
}) {
  const { orgId, acuseId, actorUserId, nota } = params;
  const db = getDb();
  const now = new Date();

  const [updated] = await db
    .update(schema.acusesSemanales)
    .set({
      resueltoPor: actorUserId,
      resueltoAt: now,
      notaResolucion: nota?.trim() || "Conciliado por Recursos Humanos",
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.acusesSemanales.id, acuseId),
        eq(schema.acusesSemanales.orgId, orgId)
      )
    )
    .returning();

  if (!updated) {
    throw new Error("Acuse semanal no encontrado.");
  }

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "ACUSE_SEMANAL_CONCILIADO",
    entidad: "acuses_semanales",
    entidadId: updated.id,
    detalle: {
      empleadoId: updated.empleadoId,
      periodoClave: updated.periodoClave,
      notaResolucion: updated.notaResolucion,
    },
  });

  return updated;
}
