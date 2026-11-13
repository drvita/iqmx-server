import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { Building2, Clock, TabletSmartphone, Users } from "lucide-react";
import DashboardAttendanceClient from "@/components/admin/DashboardAttendanceClient";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { getOrganizationOverview } from "@/services/admin/branding-users";
import {
  computeWeeklyCompliance,
  evaluateDailyWork,
  formatDateKeyInTz,
  type CheckInEvent,
  type EmployeeScheduleInfo,
} from "@/services/reports/attendance-compliance";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const overview = await getOrganizationOverview(session.orgId);
  if (!overview) redirect("/login");

  const { org, usage } = overview;

  // Calcular semana actual (lunes a domingo) y checadas recientes para el Dashboard
  const now = new Date();
  const utcDay = now.getUTCDay();
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const weekStartDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + diffToMonday
    )
  );
  const weekEndDate = new Date(
    weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1
  );
  const initialWeekStart = weekStartDate.toISOString().slice(0, 10);

  const db = getDb();
  const [empRows, schedRows, weekCheckIns, recentCountRes, recentRows] =
    await Promise.all([
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
          gte(schema.checadas.timestampLocal, weekStartDate),
          lte(schema.checadas.timestampLocal, weekEndDate)
        )
      ),
    db
      .select({ total: count() })
      .from(schema.checadas)
      .where(eq(schema.checadas.orgId, session.orgId)),
    db
      .select({
        id: schema.checadas.id,
        empleadoNombre: schema.empleados.nombreCompleto,
        codigoInterno: schema.empleados.codigoInterno,
        sucursalNombre: schema.sucursales.nombre,
        dispositivoNombre: schema.dispositivos.nombre,
        tipo: schema.checadas.tipo,
        estado: schema.checadas.estado,
        timestampLocal: schema.checadas.timestampLocal,
        desfaseRelojSeg: schema.checadas.desfaseRelojSeg,
        fotoEvidenciaKey: schema.checadas.fotoEvidenciaKey,
      })
      .from(schema.checadas)
      .innerJoin(
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
      .where(eq(schema.checadas.orgId, session.orgId))
      .orderBy(desc(schema.checadas.timestampLocal))
      .limit(10),
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

  const initialCompliance = computeWeeklyCompliance({
    employees: empRows,
    checkIns: weekCheckIns as CheckInEvent[],
    schedulesById,
    horasSemanalesMax: Number(org.horasSemanalesMax),
    timeZone: org.zonaHoraria,
  });

  const todayKey = formatDateKeyInTz(now, org.zonaHoraria);
  const todayEvents = (weekCheckIns as CheckInEvent[]).filter(
    (ev) => formatDateKeyInTz(ev.timestampLocal, org.zonaHoraria) === todayKey
  );
  const validTodayCount = new Set(
    todayEvents
      .filter((e) => e.estado === "valido" && e.empleadoId)
      .map((e) => e.empleadoId)
  ).size;
  const rejectedTodayCount = todayEvents.filter(
    (e) => e.estado !== "valido"
  ).length;

  let tardyTodayCount = 0;
  let inProgressTodayCount = 0;
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
    if (res.isTardy) tardyTodayCount += 1;
    if (res.status === "en_curso") inProgressTodayCount += 1;
  }

  const recentTotal = Number(recentCountRes[0]?.total ?? 0);
  const initialCheckIns = {
    total: recentTotal,
    page: 1,
    pageSize: 10,
    totalPages: Math.max(1, Math.ceil(recentTotal / 10)),
    items: recentRows.map((r) => ({
      id: r.id,
      empleadoNombre: r.empleadoNombre,
      codigoInterno: r.codigoInterno,
      sucursalNombre: r.sucursalNombre,
      dispositivoNombre: r.dispositivoNombre,
      tipo: r.tipo,
      estado: r.estado,
      timestampLocalIso: r.timestampLocal.toISOString(),
      desfaseRelojSeg: r.desfaseRelojSeg,
      fotoEvidenciaKey: r.fotoEvidenciaKey,
    })),
  };

  const cards = [
    {
      label: "Empleados Activos",
      value: String(usage.empleados),
      limitReached: usage.empleados >= org.maxEmpleados,
      href: "/empleados",
      icon: Users,
      accent: "text-[#4f46e5] bg-indigo-50",
    },
    {
      label: "Dispositivos Quiosco",
      value: String(usage.dispositivos),
      limitReached: usage.dispositivos >= org.maxDispositivos,
      href: "/dispositivos",
      icon: TabletSmartphone,
      accent: "text-[#059669] bg-emerald-50",
    },
    {
      label: "Sucursales",
      value: String(usage.sucursales),
      limitReached: usage.sucursales >= org.maxSucursales,
      href: "/sucursales",
      icon: Building2,
      accent: "text-[#1e1b4b] bg-slate-100",
    },
    {
      label: "Jornada Máx. Semanal",
      value: `${org.horasSemanalesMax} h`,
      limitReached: false,
      href: "/horarios",
      icon: Clock,
      accent: "text-amber-700 bg-amber-50",
    },
  ];

  const estadoLabel =
    org.estado === "activo"
      ? "Activa"
      : org.estado === "prueba"
        ? "En periodo de prueba"
        : "Suspendida";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
            Panel de Control — {org.nombre}
          </h1>
          <p className="text-xs text-slate-500 md:text-sm">
            Estado: <strong>{estadoLabel}</strong> · Zona horaria:{" "}
            {org.zonaHoraria}
          </p>
        </div>
        <Link
          href="/empleados"
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Users className="h-4 w-4" />
          Enrolar Empleado
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-indigo-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {card.label}
                </span>
                <span className={`rounded-lg p-2 ${card.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-2">
                <p className="tnum text-2xl font-bold text-slate-900">
                  {card.value}
                </p>
                {card.limitReached && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Límite alcanzado
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </section>

      <DashboardAttendanceClient
        initialWeekStart={initialWeekStart}
        initialSyncedAt={now.toISOString()}
        initialCompliance={initialCompliance}
        initialCheckIns={initialCheckIns}
        todayKpis={{
          validCount: validTodayCount,
          tardyCount: tardyTodayCount,
          rejectedCount: rejectedTodayCount,
          inProgressCount: inProgressTodayCount,
        }}
        cloudEvidencesEnabled={org.cloudEvidencesEnabled}
        horasSemanalesMax={Number(org.horasSemanalesMax)}
        zonaHoraria={org.zonaHoraria}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">
          Resumen Operativo
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-slate-500">Mensaje de Bienvenida del Quiosco</p>
            <p className="mt-1 truncate font-semibold text-slate-900">
              {org.mensajeBienvenida}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-slate-500">Respaldo de Evidencias</p>
            <p className="mt-1 font-semibold text-slate-900">
              {org.cloudEvidencesEnabled
                ? "Respaldo en la nube activo"
                : "Almacenamiento local en terminal"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-slate-500">Privacidad Biométrica</p>
            <p className="mt-1 font-semibold text-slate-900">
              Procesamiento local sin fotografías crudas
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
