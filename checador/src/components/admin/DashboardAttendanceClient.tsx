"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Cloud,
  Download,
  ExternalLink,
  HardDrive,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { resolveIncidentAction } from "@/actions/admin";
import {
  resolveReportDateRange,
  type ReportPeriodType,
  type WeeklyEmployeeCompliance,
} from "@/services/reports/attendance-compliance";
import { buildGoogleMapsUrl } from "@/services/sync/gps-incidence";

export interface RecentCheckInRow {
  id: string;
  empleadoNombre: string | null;
  codigoInterno: string | null;
  sucursalNombre: string;
  dispositivoNombre: string;
  dispositivoTipo?: string;
  tipo: string;
  estado: string;
  timestampLocalIso: string;
  desfaseRelojSeg: number | null;
  fotoEvidenciaKey: string | null;
  latitud?: string | null;
  longitud?: string | null;
  precisionGps?: number | null;
  isMockLocation?: boolean;
  incidenciaUbicacion?: string | null;
  incidenciaEstado?: string | null;
  incidenciaMotivo?: string | null;
  incidenciaResueltaAtIso?: string | null;
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
  defaultReportPeriod: "semanal" | "catorcenal" | "quincenal" | "mensual";
  branches: { id: string; nombre: string }[];
  zonaHoraria: string;
}

const TIPO_LABELS: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  inicio_comida: "Inicio Comida",
  fin_comida: "Fin Comida",
};

const INCIDENCIA_LABELS: Record<string, string> = {
  sin_gps: "Sin GPS",
  precision_baja: "Precisión baja",
  ubicacion_pendiente: "Ubicación pendiente",
  fuera_geocerca: "Fuera de zona",
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
  defaultReportPeriod,
  branches,
  zonaHoraria,
}: Props) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [syncedAt, setSyncedAt] = useState(initialSyncedAt);
  const [compliance, setCompliance] = useState(initialCompliance);
  const [compliancePage, setCompliancePage] = useState(1);
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exportSucursalId, setExportSucursalId] = useState("");
  const [exportPeriod, setExportPeriod] =
    useState<ReportPeriodType>(defaultReportPeriod);
  const [exportAnchorDate, setExportAnchorDate] = useState(initialWeekStart);
  const [exportMonth, setExportMonth] = useState(initialWeekStart.slice(0, 7));
  const [exportHalf, setExportHalf] = useState<"1" | "2">(
    Number(initialWeekStart.slice(8, 10)) <= 15 ? "1" : "2"
  );
  const [exportStartDate, setExportStartDate] = useState(initialWeekStart);
  const [exportEndDate, setExportEndDate] = useState(initialWeekStart);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeDetail, setIncludeDetail] = useState(true);

  const [todayKpis, setTodayKpis] = useState(initialKpis);
  const [checkInsPage, setCheckInsPage] = useState(initialCheckIns);
  const [estadoFilter, setEstadoFilter] = useState<
    "all" | "valido" | "rechazado" | "incidencia"
  >("all");

  const [refreshing, setRefreshing] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(
    null
  );
  const [resolvingRow, setResolvingRow] = useState<RecentCheckInRow | null>(
    null
  );
  const [resolveStatus, setResolveStatus] = useState<"justificada" | "resuelta">(
    "justificada"
  );
  const [resolveMotivo, setResolveMotivo] = useState("");
  const [resolveBusy, setResolveBusy] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const alertRows = compliance.filter((row) => row.alertaJornada === 1);
  const exceededCount = compliance.filter(
    (row) => row.weeklyStatus === "excedido"
  ).length;
  const preventiveCount = compliance.filter(
    (row) => row.weeklyStatus === "alerta_preventiva"
  ).length;
  const displayedCompliance = onlyAlerts ? alertRows : compliance;

  const complianceTotalPages = Math.max(
    1,
    Math.ceil(displayedCompliance.length / COMPLIANCE_PAGE_SIZE)
  );
  const safeCompliancePage = Math.min(compliancePage, complianceTotalPages);
  const pagedCompliance = displayedCompliance.slice(
    (safeCompliancePage - 1) * COMPLIANCE_PAGE_SIZE,
    safeCompliancePage * COMPLIANCE_PAGE_SIZE
  );

  useEffect(() => {
    if (!exportOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exportOpen]);

  const effectiveAnchorForExport =
    exportPeriod === "quincenal"
      ? `${exportMonth}-${exportHalf === "1" ? "01" : "16"}`
      : exportPeriod === "mensual"
        ? `${exportMonth}-01`
        : exportAnchorDate;

  const exportRangePreview = resolveReportDateRange({
    period: exportPeriod,
    anchorDate: effectiveAnchorForExport,
    startDate: exportStartDate,
    endDate: exportEndDate,
    timeZone: zonaHoraria,
  });

  const handleOpenExportModal = () => {
    setExportPeriod(defaultReportPeriod);
    setExportAnchorDate(weekStart);
    setExportMonth(weekStart.slice(0, 7));
    setExportHalf(Number(weekStart.slice(8, 10)) <= 15 ? "1" : "2");
    setExportStartDate(weekStart);
    setExportEndDate(exportRangePreview.endDateKey || weekStart);
    setExportOpen(true);
  };

  const handleDownloadExport = () => {
    if (!includeSummary && !includeDetail) return;
    const params = new URLSearchParams({
      format: exportFormat,
      period: exportPeriod,
      includeSummary: String(includeSummary),
      includeDetail: String(includeDetail),
    });
    if (exportSucursalId) {
      params.set("sucursalId", exportSucursalId);
    }
    if (exportPeriod === "personalizado") {
      params.set("startDate", exportStartDate);
      params.set("endDate", exportEndDate);
    } else {
      params.set("anchorDate", effectiveAnchorForExport);
    }
    window.location.href = `/api/admin/reports/attendance?${params.toString()}`;
    setExportOpen(false);
  };

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
    nextEstado: "all" | "valido" | "rechazado" | "incidencia"
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

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingRow) return;
    setResolveBusy(true);
    setResolveError(null);
    const res = await resolveIncidentAction({
      checadaId: resolvingRow.id,
      estado: resolveStatus,
      motivo: resolveMotivo,
    });
    setResolveBusy(false);
    if (!res.ok) {
      setResolveError(res.error ?? "No se pudo guardar la resolución.");
      return;
    }
    setResolvingRow(null);
    setResolveMotivo("");
    await loadCheckInsPage(checkInsPage.page, estadoFilter);
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
            <button
              type="button"
              onClick={handleOpenExportModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar Reporte
            </button>
          </div>
        </div>

        {alertRows.length > 0 && (
          <div
            className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
              exceededCount > 0
                ? "border-red-200 bg-red-50/80 text-red-900"
                : "border-amber-200 bg-amber-50/80 text-amber-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`h-4 w-4 shrink-0 ${
                  exceededCount > 0 ? "text-red-600" : "text-amber-600"
                }`}
              />
              <span>
                <strong>
                  {alertRows.length} colaborador(es) en alerta de jornada:
                </strong>{" "}
                {exceededCount > 0 && `${exceededCount} excedido(s)`}
                {exceededCount > 0 && preventiveCount > 0 && " · "}
                {preventiveCount > 0 &&
                  `${preventiveCount} próximo(s) al límite (≥ 90%)`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setOnlyAlerts((prev) => !prev);
                setCompliancePage(1);
              }}
              className="rounded-lg border border-current/25 bg-white/80 px-2.5 py-1 text-[11px] font-semibold transition hover:bg-white"
            >
              {onlyAlerts ? "Ver todos" : "Ver solo alertas"}
            </button>
          </div>
        )}

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
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>
                          {row.ordinaryHours.toFixed(2)} h / {row.maxHours} h
                        </span>
                        {row.doubleOvertimeHours > 0 && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            +{row.doubleOvertimeHours.toFixed(2)} h dobles
                          </span>
                        )}
                        {row.tripleOvertimeHours > 0 && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                            +{row.tripleOvertimeHours.toFixed(2)} h triples
                          </span>
                        )}
                      </div>
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

        {displayedCompliance.length > COMPLIANCE_PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="tnum">
              Mostrando {pagedCompliance.length} de{" "}
              {displayedCompliance.length} colaboradores · Página{" "}
              {safeCompliancePage} de {complianceTotalPages}
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
                  { id: "incidencia", label: "Incidencias" },
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
                <th className="px-3 py-2 font-semibold">Ubicación</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="py-2 pl-3 font-semibold">Evidencia / RH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingCheckIns && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Cargando registros...
                  </td>
                </tr>
              )}
              {!loadingCheckIns && checkInsPage.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No hay registros de asistencia para este filtro.
                  </td>
                </tr>
              )}
              {!loadingCheckIns &&
                checkInsPage.items.map((rec) => {
                  const clockAlert =
                    rec.desfaseRelojSeg !== null &&
                    Math.abs(rec.desfaseRelojSeg) > 120;
                  const mapsUrl = buildGoogleMapsUrl(rec.latitud, rec.longitud);
                  const hasIncidence = Boolean(
                    rec.incidenciaUbicacion ||
                      rec.incidenciaEstado ||
                      rec.isMockLocation ||
                      clockAlert
                  );
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
                        <p>{rec.sucursalNombre}</p>
                        <p className="text-[11px] text-slate-400">
                          {rec.dispositivoNombre}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          {mapsUrl ? (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#059669] hover:bg-emerald-100"
                            >
                              <MapPin className="h-3 w-3" />
                              Ver mapa
                              {rec.precisionGps !== null &&
                                rec.precisionGps !== undefined && (
                                  <span className="tnum font-normal">
                                    ±{Math.round(rec.precisionGps)} m
                                  </span>
                                )}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : rec.incidenciaUbicacion ? (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                              <AlertTriangle className="h-3 w-3" />
                              {INCIDENCIA_LABELS[rec.incidenciaUbicacion] ??
                                "Sin ubicación"}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {rec.dispositivoTipo ===
                              "dispositivo_personal_movil"
                                ? "Sin GPS"
                                : "Quiosco fijo"}
                            </span>
                          )}
                          {rec.incidenciaUbicacion && mapsUrl && (
                            <span className="inline-flex w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                              {INCIDENCIA_LABELS[rec.incidenciaUbicacion] ??
                                "Revisión"}
                            </span>
                          )}
                          {rec.isMockLocation && (
                            <span className="inline-flex w-fit rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              Ubicación simulada
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
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
                          {rec.incidenciaEstado && (
                            <span
                              title={rec.incidenciaMotivo ?? undefined}
                              className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                rec.incidenciaEstado === "abierta"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-indigo-50 text-[#4f46e5]"
                              }`}
                            >
                              {rec.incidenciaEstado === "abierta"
                                ? "Incidencia abierta"
                                : rec.incidenciaEstado === "justificada"
                                  ? "Justificada"
                                  : "Resuelta"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pl-3">
                        <div className="flex flex-wrap items-center gap-1.5">
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
                                : "Local"}
                            </span>
                          )}
                          {rec.estado === "valido" && hasIncidence && (
                            <button
                              type="button"
                              onClick={() => {
                                setResolvingRow(rec);
                                setResolveStatus(
                                  rec.incidenciaEstado === "resuelta"
                                    ? "resuelta"
                                    : "justificada"
                                );
                                setResolveMotivo(rec.incidenciaMotivo ?? "");
                                setResolveError(null);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                            >
                              <ClipboardCheck className="h-3 w-3" />
                              {rec.incidenciaEstado &&
                              rec.incidenciaEstado !== "abierta"
                                ? "Editar nota"
                                : "Resolver"}
                            </button>
                          )}
                        </div>
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

      {resolvingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900">
                Resolver Incidencia de Registro
              </h3>
              <button
                type="button"
                onClick={() => setResolvingRow(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleResolveSubmit} className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 text-slate-700">
                <p className="font-semibold text-slate-900">
                  {resolvingRow.empleadoNombre ?? "Persona no identificada"} ·{" "}
                  {TIPO_LABELS[resolvingRow.tipo] ?? resolvingRow.tipo}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  El registro original de hora y coordenadas se conserva intacto
                  en la bitácora.
                </p>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Resolución de RH
                </label>
                <select
                  value={resolveStatus}
                  onChange={(e) =>
                    setResolveStatus(
                      e.target.value as "justificada" | "resuelta"
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="justificada">Justificada</option>
                  <option value="resuelta">Resuelta</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Motivo o nota de auditoría *
                </label>
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                  value={resolveMotivo}
                  onChange={(e) => setResolveMotivo(e.target.value)}
                  placeholder="Ej. Visita con cliente en bodega sin señal GPS..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                />
              </div>

              {resolveError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-red-700">
                  {resolveError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResolvingRow(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resolveBusy}
                  className="rounded-xl bg-[#4f46e5] px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {resolveBusy ? "Guardando..." : "Guardar Resolución"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-report-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3
                  id="export-report-title"
                  className="text-sm font-bold text-slate-900"
                >
                  Exportar Reporte de Asistencia
                </h3>
                <p className="text-[11px] text-slate-500">
                  Elige formato, sucursal, temporalidad y secciones a incluir
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Formato
                  </label>
                  <select
                    value={exportFormat}
                    onChange={(e) =>
                      setExportFormat(e.target.value as "csv" | "pdf")
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  >
                    <option value="csv">CSV (Prenómina / Excel)</option>
                    <option value="pdf">PDF Oficial (STPS)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Sucursal / Centro
                  </label>
                  <select
                    value={exportSucursalId}
                    onChange={(e) => setExportSucursalId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  >
                    <option value="">Todas las sucursales</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Temporalidad del reporte
                </label>
                <select
                  value={exportPeriod}
                  onChange={(e) =>
                    setExportPeriod(e.target.value as ReportPeriodType)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                >
                  <option value="semanal">Semanal (lunes a domingo)</option>
                  <option value="catorcenal">Catorcenal (14 días)</option>
                  <option value="quincenal">Quincenal (1-15 o 16-fin)</option>
                  <option value="mensual">Mensual (mes calendario)</option>
                  <option value="personalizado">Rango personalizado</option>
                </select>
              </div>

              {(exportPeriod === "semanal" || exportPeriod === "catorcenal") && (
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    {exportPeriod === "semanal"
                      ? "Semana que contiene el día"
                      : "Fecha de inicio (14 días)"}
                  </label>
                  <input
                    type="date"
                    value={exportAnchorDate}
                    onChange={(e) => setExportAnchorDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                  />
                </div>
              )}

              {exportPeriod === "quincenal" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Mes
                    </label>
                    <input
                      type="month"
                      value={exportMonth}
                      onChange={(e) => setExportMonth(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Quincena
                    </label>
                    <select
                      value={exportHalf}
                      onChange={(e) =>
                        setExportHalf(e.target.value as "1" | "2")
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    >
                      <option value="1">1ª quincena (1–15)</option>
                      <option value="2">2ª quincena (16–fin)</option>
                    </select>
                  </div>
                </div>
              )}

              {exportPeriod === "mensual" && (
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Mes
                  </label>
                  <input
                    type="month"
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                  />
                </div>
              )}

              {exportPeriod === "personalizado" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[11px] text-slate-700">
                Rango a exportar:{" "}
                <strong className="tnum text-[#1e1b4b]">
                  Del {exportRangePreview.startDateKey} al{" "}
                  {exportRangePreview.endDateKey}
                </strong>{" "}
                ({exportRangePreview.daysCount} días)
              </div>

              <div className="space-y-2">
                <span className="block font-semibold text-slate-700">
                  Información a incluir
                </span>
                <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-2.5">
                  <input
                    type="checkbox"
                    checked={includeSummary}
                    onChange={(e) => setIncludeSummary(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4f46e5]"
                  />
                  <span>
                    <strong className="block text-slate-900">
                      Resumen de prenómina por colaborador
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Horas ordinarias, extras dobles/triples, retardos y
                      bandera de alerta (1 / 0)
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-2.5">
                  <input
                    type="checkbox"
                    checked={includeDetail}
                    onChange={(e) => setIncludeDetail(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4f46e5]"
                  />
                  <span>
                    <strong className="block text-slate-900">
                      Detalle cronológico de checadas
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Movimientos con ubicación GPS, incidencias y enlaces a
                      Google Maps
                    </span>
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setExportOpen(false)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!includeSummary && !includeDetail}
                  onClick={handleDownloadExport}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {exportFormat === "pdf" ? "Descargar PDF STPS" : "Descargar CSV"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
