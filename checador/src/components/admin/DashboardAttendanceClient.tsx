"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Download,
  HardDrive,
  Image as ImageIcon,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import type { WeeklyEmployeeCompliance } from "@/services/reports/attendance-compliance";

export interface RecentCheckInRow {
  id: string;
  empleadoNombre: string | null;
  codigoInterno: string | null;
  sucursalNombre: string;
  dispositivoNombre: string;
  tipo: string;
  estado: string;
  timestampLocalIso: string;
  desfaseRelojSeg: number | null;
  fotoEvidenciaKey: string | null;
}

export interface PaginatedCheckIns {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: RecentCheckInRow[];
}

interface Props {
  initialWeekStart: string;
  initialSyncedAt: string;
  initialCompliance: WeeklyEmployeeCompliance[];
  initialCheckIns: PaginatedCheckIns;
  todayKpis: {
    validCount: number;
    tardyCount: number;
    rejectedCount: number;
    inProgressCount: number;
  };
  cloudEvidencesEnabled: boolean;
  horasSemanalesMax: number;
  zonaHoraria: string;
}

const TIPO_LABELS: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  inicio_comida: "Inicio Comida",
  fin_comida: "Fin Comida",
};

const COMPLIANCE_PAGE_SIZE = 10;

export default function DashboardAttendanceClient({
  initialWeekStart,
  initialSyncedAt,
  initialCompliance,
  initialCheckIns,
  todayKpis: initialKpis,
  cloudEvidencesEnabled,
  horasSemanalesMax,
  zonaHoraria,
}: Props) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [syncedAt, setSyncedAt] = useState(initialSyncedAt);
  const [compliance, setCompliance] = useState(initialCompliance);
  const [compliancePage, setCompliancePage] = useState(1);

  const [todayKpis, setTodayKpis] = useState(initialKpis);
  const [checkInsPage, setCheckInsPage] = useState(initialCheckIns);
  const [estadoFilter, setEstadoFilter] = useState<
    "all" | "valido" | "rechazado"
  >("all");

  const [refreshing, setRefreshing] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(
    null
  );

  const complianceTotalPages = Math.max(
    1,
    Math.ceil(compliance.length / COMPLIANCE_PAGE_SIZE)
  );
  const safeCompliancePage = Math.min(compliancePage, complianceTotalPages);
  const pagedCompliance = compliance.slice(
    (safeCompliancePage - 1) * COMPLIANCE_PAGE_SIZE,
    safeCompliancePage * COMPLIANCE_PAGE_SIZE
  );

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/admin/reports/attendance?weekStart=${encodeURIComponent(weekStart)}&page=${checkInsPage.page}&pageSize=${checkInsPage.pageSize}&estado=${estadoFilter}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok: boolean;
        syncedAt?: string;
        compliance?: WeeklyEmployeeCompliance[];
        todayKpis?: Props["todayKpis"];
        checkins?: PaginatedCheckIns;
      };
      if (data.syncedAt) setSyncedAt(data.syncedAt);
      if (data.compliance) {
        setCompliance(data.compliance);
        setCompliancePage(1);
      }
      if (data.todayKpis) setTodayKpis(data.todayKpis);
      if (data.checkins) setCheckInsPage(data.checkins);
    } finally {
      setRefreshing(false);
    }
  };

  const handleWeekChange = async (nextWeek: string) => {
    setWeekStart(nextWeek);
    setLoadingWeek(true);
    try {
      const res = await fetch(
        `/api/admin/reports/attendance?weekStart=${encodeURIComponent(nextWeek)}&page=${checkInsPage.page}&pageSize=${checkInsPage.pageSize}&estado=${estadoFilter}`
      );
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          syncedAt?: string;
          compliance?: WeeklyEmployeeCompliance[];
        };
        if (data.syncedAt) setSyncedAt(data.syncedAt);
        if (data.compliance) {
          setCompliance(data.compliance);
          setCompliancePage(1);
        }
      }
    } finally {
      setLoadingWeek(false);
    }
  };

  const loadCheckInsPage = async (
    nextPage: number,
    nextEstado: "all" | "valido" | "rechazado"
  ) => {
    setLoadingCheckIns(true);
    setEstadoFilter(nextEstado);
    try {
      const res = await fetch(
        `/api/admin/reports/attendance?view=checkins&page=${nextPage}&pageSize=${checkInsPage.pageSize}&estado=${nextEstado}`
      );
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          syncedAt?: string;
          checkins?: PaginatedCheckIns;
        };
        if (data.syncedAt) setSyncedAt(data.syncedAt);
        if (data.checkins) setCheckInsPage(data.checkins);
      }
    } finally {
      setLoadingCheckIns(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de sincronización bajo demanda (sin polling) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>
            Última actualización:{" "}
            <strong
              suppressHydrationWarning
              className="tnum text-slate-900"
            >
              {new Date(syncedAt).toLocaleString("es-MX", {
                timeZone: zonaHoraria,
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </strong>
          </span>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => void handleManualRefresh()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Actualizando..." : "Actualizar datos"}
        </button>
      </div>

      {/* KPIs de hoy */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Asistencias Hoy</span>
            <CheckCircle2 className="h-4 w-4 text-[#059669]" />
          </div>
          <p className="tnum mt-2 text-2xl font-bold text-slate-900">
            {todayKpis.validCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Retardos Hoy</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="tnum mt-2 text-2xl font-bold text-slate-900">
            {todayKpis.tardyCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Turnos en Curso Hoy</span>
            <Clock className="h-4 w-4 text-[#4f46e5]" />
          </div>
          <p className="tnum mt-2 text-2xl font-bold text-slate-900">
            {todayKpis.inProgressCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Intentos Rechazados Hoy</span>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </div>
          <p className="tnum mt-2 text-2xl font-bold text-slate-900">
            {todayKpis.rejectedCount}
          </p>
        </div>
      </section>

      {/* Reporte Semanal de Jornada */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Cumplimiento Semanal de Jornada
            </h2>
            <p className="text-xs text-slate-500">
              Límite configurado: {horasSemanalesMax} horas semanales · Turnos
              sin salida se marcan como requiere corrección
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Semana del:</span>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => void handleWeekChange(e.target.value)}
                className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
              />
            </label>
            <a
              href={`/api/admin/reports/attendance?weekStart=${encodeURIComponent(weekStart)}&format=csv`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </a>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Colaborador</th>
                <th className="px-3 py-2 font-semibold">Puesto</th>
                <th className="px-3 py-2 font-semibold">Horas Trabajadas</th>
                <th className="px-3 py-2 font-semibold">Días Completos</th>
                <th className="px-3 py-2 font-semibold">Retardos</th>
                <th className="py-2 pl-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingWeek && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Calculando reporte semanal...
                  </td>
                </tr>
              )}
              {!loadingWeek && pagedCompliance.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No hay colaboradores activos registrados.
                  </td>
                </tr>
              )}
              {!loadingWeek &&
                pagedCompliance.map((row) => (
                  <tr key={row.empleadoId}>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-slate-900">
                        {row.nombreCompleto}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Código: {row.codigoInterno}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{row.puesto}</td>
                    <td className="tnum px-3 py-2.5 font-semibold text-slate-900">
                      {row.workedHours.toFixed(2)} h / {row.maxHours} h
                    </td>
                    <td className="tnum px-3 py-2.5 text-slate-700">
                      <span>{row.daysComplete}</span>
                      {row.hasInProgressToday && (
                        <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-[#4f46e5]">
                          En curso hoy
                        </span>
                      )}
                      {row.daysRequireCorrection > 0 && (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          {row.daysRequireCorrection} requiere corrección
                        </span>
                      )}
                    </td>
                    <td className="tnum px-3 py-2.5 text-slate-700">
                      {row.tardies}
                    </td>
                    <td className="py-2.5 pl-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          row.weeklyStatus === "excedido"
                            ? "bg-red-50 text-red-700"
                            : row.weeklyStatus === "alerta_preventiva"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-emerald-50 text-[#059669]"
                        }`}
                      >
                        {row.weeklyStatus === "excedido"
                          ? "Jornada excedida"
                          : row.weeklyStatus === "alerta_preventiva"
                            ? "Próximo al límite"
                            : "En rango"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {compliance.length > COMPLIANCE_PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="tnum">
              Mostrando {pagedCompliance.length} de {compliance.length}{" "}
              colaboradores · Página {safeCompliancePage} de{" "}
              {complianceTotalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safeCompliancePage <= 1}
                onClick={() =>
                  setCompliancePage((p) => Math.max(1, p - 1))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                disabled={safeCompliancePage >= complianceTotalPages}
                onClick={() =>
                  setCompliancePage((p) =>
                    Math.min(complianceTotalPages, p + 1)
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Checadas recientes paginadas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Registros Recientes de Asistencia
            </h2>
            <p className="text-xs text-slate-500">
              Movimientos sincronizados desde terminales ({zonaHoraria})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-medium">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "valido", label: "Válidos" },
                  { id: "rechazado", label: "Rechazados" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => void loadCheckInsPage(1, tab.id)}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    estadoFilter === tab.id
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700">
              {cloudEvidencesEnabled ? (
                <>
                  <Cloud className="h-3.5 w-3.5 text-[#4f46e5]" />
                  Evidencia en Nube
                </>
              ) : (
                <>
                  <HardDrive className="h-3.5 w-3.5 text-slate-600" />
                  Evidencia Local 15 días
                </>
              )}
            </span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-semibold">Fecha y Hora</th>
                <th className="px-3 py-2 font-semibold">Colaborador</th>
                <th className="px-3 py-2 font-semibold">Movimiento</th>
                <th className="px-3 py-2 font-semibold">Terminal</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="py-2 pl-3 font-semibold">Evidencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingCheckIns && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Cargando registros...
                  </td>
                </tr>
              )}
              {!loadingCheckIns && checkInsPage.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No hay registros de asistencia para este filtro.
                  </td>
                </tr>
              )}
              {!loadingCheckIns &&
                checkInsPage.items.map((rec) => {
                  const clockAlert =
                    rec.desfaseRelojSeg !== null &&
                    Math.abs(rec.desfaseRelojSeg) > 120;
                  return (
                    <tr key={rec.id}>
                      <td className="tnum py-2.5 pr-3 text-slate-700">
                        <p suppressHydrationWarning>
                          {new Date(rec.timestampLocalIso).toLocaleString(
                            "es-MX",
                            {
                              timeZone: zonaHoraria,
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                        {clockAlert && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Diferencia de reloj
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">
                          {rec.empleadoNombre ?? "Persona no identificada"}
                        </p>
                        {rec.codigoInterno && (
                          <p className="text-[11px] text-slate-500">
                            Código: {rec.codigoInterno}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {TIPO_LABELS[rec.tipo] ?? rec.tipo}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {rec.sucursalNombre} · {rec.dispositivoNombre}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            rec.estado === "valido"
                              ? "bg-emerald-50 text-[#059669]"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {rec.estado === "valido"
                            ? "Válido"
                            : rec.estado === "rechazado_spoof"
                              ? "Foto/Pantalla"
                              : "No reconocido"}
                        </span>
                      </td>
                      <td className="py-2.5 pl-3">
                        {rec.fotoEvidenciaKey ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewEvidenceUrl(
                                `/api/admin/evidences/${rec.fotoEvidenciaKey}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-[#4f46e5] hover:bg-indigo-50"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                            Ver foto
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {cloudEvidencesEnabled
                              ? "Sin foto"
                              : "Local en terminal"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className="tnum">
            Mostrando {checkInsPage.items.length} de {checkInsPage.total}{" "}
            registros · Página {checkInsPage.page} de {checkInsPage.totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={loadingCheckIns || checkInsPage.page <= 1}
              onClick={() =>
                void loadCheckInsPage(checkInsPage.page - 1, estadoFilter)
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </button>
            <button
              type="button"
              disabled={
                loadingCheckIns || checkInsPage.page >= checkInsPage.totalPages
              }
              onClick={() =>
                void loadCheckInsPage(checkInsPage.page + 1, estadoFilter)
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {previewEvidenceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                Evidencia de Asistencia
              </h3>
              <button
                type="button"
                onClick={() => setPreviewEvidenceUrl(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewEvidenceUrl}
              alt="Evidencia de asistencia"
              className="mt-3 w-full rounded-xl border border-slate-200 object-cover"
            />
          </div>
        </div>
      )}
    </div>
  );
}
