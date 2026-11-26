import { NextResponse } from "next/server";
import { and, count, desc, eq, gte, isNotNull, lte, ne, or } from "drizzle-orm";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import {
  buildUnifiedAttendanceCsv,
  computeWeeklyCompliance,
  evaluateDailyWork,
  formatDateKeyInTz,
  type CheckInEvent,
  type EmployeeScheduleInfo,
} from "@/services/reports/attendance-compliance";
import { buildGoogleMapsUrl } from "@/services/sync/gps-incidence";

export const dynamic = "force-dynamic";

function resolveWeekBounds(weekStartParam: string | null): {
  start: Date;
  end: Date;
  label: string;
} {
  let start: Date;
  if (weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)) {
    start = new Date(`${weekStartParam}T00:00:00.000Z`);
  } else {
    const now = new Date();
    const day = now.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + diffToMonday
      )
    );
  }
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  const label = start.toISOString().slice(0, 10);
  return { start, end, label };
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
  const format = url.searchParams.get("format") ?? "json";
  const { start, end, label } = resolveWeekBounds(weekStartParam);

  const db = getDb();
  const [org] = await db
    .select({
      horasSemanalesMax: schema.organizaciones.horasSemanalesMax,
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
      .where(
        and(
          eq(schema.empleados.orgId, session.orgId),
          eq(schema.empleados.activo, true)
        )
      ),
    db
      .select({
        id: schema.horarios.id,
        horaEntrada: schema.horarios.horaEntrada,
        horaSalida: schema.horarios.horaSalida,
        toleranciaMin: schema.horarios.toleranciaMin,
        minutosComida: schema.horarios.minutosComida,
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
          gte(schema.checadas.timestampLocal, start),
          lte(schema.checadas.timestampLocal, end)
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
    });
  }

  const maxHours = Number(org.horasSemanalesMax);
  const compliance = computeWeeklyCompliance({
    employees: empRows,
    checkIns: checkInRows as CheckInEvent[],
    schedulesById,
    horasSemanalesMax: maxHours,
    timeZone: org.zonaHoraria,
  });

  if (format === "csv") {
    const detailRows = await db
      .select({
        timestampLocal: schema.checadas.timestampLocal,
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
          gte(schema.checadas.timestampLocal, start),
          lte(schema.checadas.timestampLocal, end)
        )
      )
      .orderBy(desc(schema.checadas.timestampLocal));

    const csv = buildUnifiedAttendanceCsv(
      compliance,
      detailRows.map((r) => ({
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
      })),
      label,
      org.zonaHoraria
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reporte-asistencia-${label}.csv"`,
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
    weekStart: label,
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
