import { NextResponse } from "next/server";
import { and, count, desc, eq, gte, isNotNull, lte, ne, or } from "drizzle-orm";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import {
  buildUnifiedAttendanceCsv,
  computeWeeklyCompliance,
  evaluateDailyWork,
  formatDateKeyInTz,
  resolveReportDateRange,
  type CheckInEvent,
  type EmployeeScheduleInfo,
  type JornadaType,
  type ReportPeriodType,
} from "@/services/reports/attendance-compliance";
import { generateStpsCompliancePdf } from "@/services/reports/stps-pdf";
import { buildGoogleMapsUrl } from "@/services/sync/gps-incidence";

export const dynamic = "force-dynamic";

const VALID_PERIODS = new Set<ReportPeriodType>([
  "semanal",
  "catorcenal",
  "quincenal",
  "mensual",
  "personalizado",
]);

function parseReportPeriod(raw: string | null): ReportPeriodType {
  if (raw && VALID_PERIODS.has(raw as ReportPeriodType)) {
    return raw as ReportPeriodType;
  }
  return "semanal";
}

async function queryPaginatedCheckIns(
  orgId: string,
  page: number,
  pageSize: number,
  estadoFilter: string
) {
  const db = getDb();
  const conditions = [eq(schema.checadas.orgId, orgId)];
  if (estadoFilter === "valido") {
    conditions.push(eq(schema.checadas.estado, "valido"));
  } else if (estadoFilter === "rechazado") {
    conditions.push(ne(schema.checadas.estado, "valido"));
  } else if (estadoFilter === "incidencia") {
    conditions.push(eq(schema.checadas.estado, "valido"));
    const incCond = or(
      isNotNull(schema.checadas.incidenciaEstado),
      isNotNull(schema.checadas.incidenciaUbicacion)
    );
    if (incCond) conditions.push(incCond);
  }

  const offset = (page - 1) * pageSize;
  const [totalResult, rows] = await Promise.all([
    db
      .select({ total: count() })
      .from(schema.checadas)
      .where(and(...conditions)),
    db
      .select({
        id: schema.checadas.id,
        empleadoNombre: schema.empleados.nombreCompleto,
        codigoInterno: schema.empleados.codigoInterno,
        sucursalNombre: schema.sucursales.nombre,
        dispositivoNombre: schema.dispositivos.nombre,
        dispositivoTipo: schema.dispositivos.tipo,
        tipo: schema.checadas.tipo,
        estado: schema.checadas.estado,
        timestampLocal: schema.checadas.timestampLocal,
        desfaseRelojSeg: schema.checadas.desfaseRelojSeg,
        fotoEvidenciaKey: schema.checadas.fotoEvidenciaKey,
        latitud: schema.checadas.latitud,
        longitud: schema.checadas.longitud,
        precisionGps: schema.checadas.precisionGps,
        isMockLocation: schema.checadas.isMockLocation,
        incidenciaUbicacion: schema.checadas.incidenciaUbicacion,
        incidenciaEstado: schema.checadas.incidenciaEstado,
        incidenciaMotivo: schema.checadas.incidenciaMotivo,
        incidenciaResueltaAt: schema.checadas.incidenciaResueltaAt,
      })
      .from(schema.checadas)
      .leftJoin(
        schema.sucursales,
        eq(schema.checadas.sucursalId, schema.sucursales.id)
      )
      .innerJoin(
        schema.dispositivos,
        eq(schema.checadas.dispositivoId, schema.dispositivos.id)
      )
      .leftJoin(
        schema.empleados,
        eq(schema.checadas.empleadoId, schema.empleados.id)
      )
      .where(and(...conditions))
      .orderBy(desc(schema.checadas.timestampLocal))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = Number(totalResult[0]?.total ?? 0);
  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((r) => ({
      id: r.id,
      empleadoNombre: r.empleadoNombre,
      codigoInterno: r.codigoInterno,
      sucursalNombre: r.sucursalNombre ?? "En campo",
      dispositivoNombre: r.dispositivoNombre,
      dispositivoTipo: r.dispositivoTipo,
      tipo: r.tipo,
      estado: r.estado,
      timestampLocalIso: r.timestampLocal.toISOString(),
      desfaseRelojSeg: r.desfaseRelojSeg,
      fotoEvidenciaKey: r.fotoEvidenciaKey,
      latitud: r.latitud,
      longitud: r.longitud,
      precisionGps: r.precisionGps,
      isMockLocation: r.isMockLocation,
      incidenciaUbicacion: r.incidenciaUbicacion,
      incidenciaEstado: r.incidenciaEstado,
      incidenciaMotivo: r.incidenciaMotivo,
      incidenciaResueltaAtIso: r.incidenciaResueltaAt
        ? r.incidenciaResueltaAt.toISOString()
        : null,
    })),
  };
}

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "summary";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    50,
    Math.max(5, Number(url.searchParams.get("pageSize") ?? "10") || 10)
  );
  const estadoFilter = url.searchParams.get("estado") ?? "all";

  if (view === "checkins") {
    const checkins = await queryPaginatedCheckIns(
      session.orgId,
      page,
      pageSize,
      estadoFilter
    );
    return NextResponse.json({
      ok: true,
      syncedAt: new Date().toISOString(),
      checkins,
    });
  }

  const weekStartParam = url.searchParams.get("weekStart");
  const periodParam = url.searchParams.get("period");
  const anchorDateParam = url.searchParams.get("anchorDate") ?? weekStartParam;
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");
  const includeSummaryParam = url.searchParams.get("includeSummary");
  const includeDetailParam = url.searchParams.get("includeDetail");
  const sucursalIdParam = url.searchParams.get("sucursalId");
  const format = url.searchParams.get("format") ?? "json";

  const db = getDb();
  const [org] = await db
    .select({
      nombre: schema.organizaciones.nombre,
      razonSocial: schema.organizaciones.razonSocial,
      rfc: schema.organizaciones.rfc,
      registroPatronalImss: schema.organizaciones.registroPatronalImss,
      horasSemanalesMax: schema.organizaciones.horasSemanalesMax,
      horasSemanalesMixta: schema.organizaciones.horasSemanalesMixta,
      horasSemanalesNocturna: schema.organizaciones.horasSemanalesNocturna,
      zonaHoraria: schema.organizaciones.zonaHoraria,
      cloudEvidencesEnabled: schema.organizaciones.cloudEvidencesEnabled,
    })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, session.orgId))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: "Organización no encontrada" },
      { status: 404 }
    );
  }

  let validSucursalId: string | null = null;
  let branchLabel = "Todas las sucursales";
  if (
    sucursalIdParam &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sucursalIdParam
    )
  ) {
    const [branch] = await db
      .select({ id: schema.sucursales.id, nombre: schema.sucursales.nombre })
      .from(schema.sucursales)
      .where(
        and(
          eq(schema.sucursales.id, sucursalIdParam),
          eq(schema.sucursales.orgId, session.orgId)
        )
      )
      .limit(1);
    if (branch) {
      validSucursalId = branch.id;
      branchLabel = branch.nombre;
    }
  }

  const period = parseReportPeriod(periodParam);
  const range = resolveReportDateRange({
    period,
    anchorDate: anchorDateParam,
    startDate: startDateParam,
    endDate: endDateParam,
    timeZone: org.zonaHoraria,
  });

  const empConditions = [
    eq(schema.empleados.orgId, session.orgId),
    eq(schema.empleados.activo, true),
  ];
  if (validSucursalId) {
    empConditions.push(eq(schema.empleados.sucursalId, validSucursalId));
  }

  const [empRows, schedRows, checkInRows] = await Promise.all([
    db
      .select({
        id: schema.empleados.id,
        codigoInterno: schema.empleados.codigoInterno,
        nombreCompleto: schema.empleados.nombreCompleto,
        puesto: schema.empleados.puesto,
        horarioId: schema.empleados.horarioId,
      })
      .from(schema.empleados)
      .where(and(...empConditions)),
    db
      .select({
        id: schema.horarios.id,
        horaEntrada: schema.horarios.horaEntrada,
        horaSalida: schema.horarios.horaSalida,
        toleranciaMin: schema.horarios.toleranciaMin,
        minutosComida: schema.horarios.minutosComida,
        tipoJornada: schema.horarios.tipoJornada,
        horasSemanalesLimite: schema.horarios.horasSemanalesLimite,
      })
      .from(schema.horarios)
      .where(eq(schema.horarios.orgId, session.orgId)),
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
          eq(schema.checadas.orgId, session.orgId),
          gte(schema.checadas.timestampLocal, range.queryStart),
          lte(schema.checadas.timestampLocal, range.queryEnd)
        )
      )
      .orderBy(desc(schema.checadas.timestampLocal)),
  ]);

  const schedulesById = new Map<string, EmployeeScheduleInfo>();
  for (const s of schedRows) {
    schedulesById.set(s.id, {
      horaEntrada: String(s.horaEntrada),
      horaSalida: String(s.horaSalida),
      toleranciaMin: s.toleranciaMin,
      minutosComida: s.minutosComida,
      tipoJornada: (s.tipoJornada === "mixta" || s.tipoJornada === "nocturna"
        ? s.tipoJornada
        : "diurna") as JornadaType,
      horasSemanalesLimite: s.horasSemanalesLimite
        ? Number(s.horasSemanalesLimite)
        : null,
    });
  }

  const maxHours = Number(org.horasSemanalesMax);
  const orgWeeklyLimits = {
    diurna: maxHours,
    mixta: Number(org.horasSemanalesMixta),
    nocturna: Number(org.horasSemanalesNocturna),
  };
  const compliance = computeWeeklyCompliance({
    employees: empRows,
    checkIns: checkInRows as CheckInEvent[],
    schedulesById,
    horasSemanalesMax: maxHours,
    orgWeeklyLimits,
    timeZone: org.zonaHoraria,
    startDateKey: range.startDateKey,
    endDateKey: range.endDateKey,
  });

  if (format === "csv" || format === "pdf") {
    let includeSummary = includeSummaryParam !== "false";
    const includeDetail = includeDetailParam !== "false";
    if (!includeSummary && !includeDetail) {
      includeSummary = true;
    }

    const detailRows = includeDetail
      ? await db
          .select({
            timestampLocal: schema.checadas.timestampLocal,
            sucursalId: schema.checadas.sucursalId,
            empleadoId: schema.checadas.empleadoId,
            codigoInterno: schema.empleados.codigoInterno,
            empleadoNombre: schema.empleados.nombreCompleto,
            sucursalNombre: schema.sucursales.nombre,
            dispositivoNombre: schema.dispositivos.nombre,
            dispositivoTipo: schema.dispositivos.tipo,
            tipo: schema.checadas.tipo,
            estado: schema.checadas.estado,
            latitud: schema.checadas.latitud,
            longitud: schema.checadas.longitud,
            precisionGps: schema.checadas.precisionGps,
            incidenciaUbicacion: schema.checadas.incidenciaUbicacion,
            incidenciaEstado: schema.checadas.incidenciaEstado,
            incidenciaMotivo: schema.checadas.incidenciaMotivo,
            selloIntegridadSha256: schema.checadas.selloIntegridadSha256,
          })
          .from(schema.checadas)
          .leftJoin(
            schema.sucursales,
            eq(schema.checadas.sucursalId, schema.sucursales.id)
          )
          .innerJoin(
            schema.dispositivos,
            eq(schema.checadas.dispositivoId, schema.dispositivos.id)
          )
          .leftJoin(
            schema.empleados,
            eq(schema.checadas.empleadoId, schema.empleados.id)
          )
          .where(
            and(
              eq(schema.checadas.orgId, session.orgId),
              gte(schema.checadas.timestampLocal, range.queryStart),
              lte(schema.checadas.timestampLocal, range.queryEnd)
            )
          )
          .orderBy(desc(schema.checadas.timestampLocal))
      : [];

    const branchEmpIds = new Set(empRows.map((e) => e.id));
    const filteredDetailRows = detailRows.filter((r) => {
      const dayKey = formatDateKeyInTz(r.timestampLocal, org.zonaHoraria);
      if (dayKey < range.startDateKey || dayKey > range.endDateKey) {
        return false;
      }
      if (validSucursalId) {
        return (
          r.sucursalId === validSucursalId ||
          (r.empleadoId !== null && branchEmpIds.has(r.empleadoId))
        );
      }
      return true;
    });

    const mappedDetail = filteredDetailRows.map((r) => ({
      timestampLocalIso: r.timestampLocal.toISOString(),
      codigoInterno: r.codigoInterno,
      empleadoNombre: r.empleadoNombre,
      sucursalNombre: r.sucursalNombre ?? "En campo",
      dispositivoNombre: r.dispositivoNombre,
      dispositivoTipo: r.dispositivoTipo,
      tipo: r.tipo,
      estado: r.estado,
      latitud: r.latitud,
      longitud: r.longitud,
      precisionGps: r.precisionGps,
      incidenciaUbicacion: r.incidenciaUbicacion,
      incidenciaEstado: r.incidenciaEstado,
      incidenciaMotivo: r.incidenciaMotivo,
      googleMapsUrl: buildGoogleMapsUrl(r.latitud, r.longitud),
      selloIntegridadSha256: r.selloIntegridadSha256,
    }));

    if (format === "pdf") {
      const pdf = await generateStpsCompliancePdf({
        org: {
          nombre: org.nombre,
          razonSocial: org.razonSocial,
          rfc: org.rfc,
          registroPatronalImss: org.registroPatronalImss,
          zonaHoraria: org.zonaHoraria,
        },
        branchLabel,
        periodLabel: range.label,
        issuedAtIso: new Date().toISOString(),
        complianceRows: compliance,
        detailRows: mappedDetail,
        includeSummary,
        includeDetail,
      });
      return new NextResponse(Buffer.from(pdf.bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="reporte-stps-${range.period}-${range.startDateKey}-a-${range.endDateKey}.pdf"`,
          "X-Document-Integrity-Sha256": pdf.documentHash,
        },
      });
    }

    const csv = buildUnifiedAttendanceCsv(
      compliance,
      mappedDetail,
      range.label,
      org.zonaHoraria,
      { includeSummary, includeDetail }
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reporte-asistencia-${range.period}-${range.startDateKey}-a-${range.endDateKey}.csv"`,
      },
    });
  }

  const now = new Date();
  const todayKey = formatDateKeyInTz(now, org.zonaHoraria);
  const todayEvents = (checkInRows as CheckInEvent[]).filter(
    (ev) => formatDateKeyInTz(ev.timestampLocal, org.zonaHoraria) === todayKey
  );
  const validCount = new Set(
    todayEvents
      .filter((e) => e.estado === "valido" && e.empleadoId)
      .map((e) => e.empleadoId)
  ).size;
  const rejectedCount = todayEvents.filter((e) => e.estado !== "valido").length;

  let tardyCount = 0;
  let inProgressCount = 0;
  for (const emp of empRows) {
    const empToday = todayEvents.filter(
      (e) => e.empleadoId === emp.id && e.estado === "valido"
    );
    if (empToday.length === 0) continue;
    const sched = emp.horarioId
      ? (schedulesById.get(emp.horarioId) ?? null)
      : null;
    const res = evaluateDailyWork(
      todayKey,
      empToday,
      sched,
      org.zonaHoraria,
      todayKey
    );
    if (res.isTardy) tardyCount += 1;
    if (res.status === "en_curso") inProgressCount += 1;
  }

  const checkins = await queryPaginatedCheckIns(
    session.orgId,
    page,
    pageSize,
    estadoFilter
  );

  return NextResponse.json({
    ok: true,
    syncedAt: now.toISOString(),
    weekStart: range.startDateKey,
    horasSemanalesMax: maxHours,
    compliance,
    todayKpis: {
      validCount,
      tardyCount,
      rejectedCount,
      inProgressCount,
    },
    checkins,
  });
}
