export type CheckInEvent = {
  id: string;
  empleadoId: string | null;
  tipo: "entrada" | "salida" | "inicio_comida" | "fin_comida";
  estado: "valido" | "rechazado_spoof" | "rechazado_desconocido";
  timestampLocal: Date;
};

export type JornadaType = "diurna" | "mixta" | "nocturna";

export type OrgWeeklyLimits = {
  diurna: number;
  mixta: number;
  nocturna: number;
};

export type EmployeeScheduleInfo = {
  horaEntrada: string; // "HH:MM:SS" or "HH:MM"
  horaSalida: string;
  toleranciaMin: number;
  minutosComida: number;
  tipoJornada?: JornadaType;
  horasSemanalesLimite?: number | null;
};

export type EmployeeComplianceInput = {
  id: string;
  codigoInterno: string | null;
  nombreCompleto: string;
  puesto: string | null;
  horarioId: string | null;
};

export type DailyWorkResult = {
  dateKey: string;
  status: "completo" | "en_curso" | "requiere_correccion" | "sin_registro";
  workedMinutes: number;
  isTardy: boolean;
  tardyMinutes: number;
};

export type ReportPeriodType =
  | "semanal"
  | "catorcenal"
  | "quincenal"
  | "mensual"
  | "personalizado";

export type OvertimeBreakdown = {
  ordinaryHours: number;
  doubleOvertimeHours: number;
  tripleOvertimeHours: number;
};

export type WeeklyEmployeeCompliance = {
  empleadoId: string;
  codigoInterno: string;
  nombreCompleto: string;
  puesto: string;
  tipoJornada: JornadaType;
  workedMinutes: number;
  workedHours: number;
  ordinaryHours: number;
  doubleOvertimeHours: number;
  tripleOvertimeHours: number;
  maxHours: number;
  daysComplete: number;
  daysRequireCorrection: number;
  hasInProgressToday: boolean;
  tardies: number;
  weeklyStatus: "normal" | "alerta_preventiva" | "excedido";
  alertaJornada: 0 | 1;
};

export function resolveEffectiveWeeklyLimit(
  schedule: EmployeeScheduleInfo | null,
  orgLimits: OrgWeeklyLimits
): { tipoJornada: JornadaType; maxHours: number } {
  const tipo: JornadaType =
    schedule?.tipoJornada === "mixta" || schedule?.tipoJornada === "nocturna"
      ? schedule.tipoJornada
      : "diurna";
  if (
    typeof schedule?.horasSemanalesLimite === "number" &&
    Number.isFinite(schedule.horasSemanalesLimite) &&
    schedule.horasSemanalesLimite > 0
  ) {
    return { tipoJornada: tipo, maxHours: schedule.horasSemanalesLimite };
  }
  return { tipoJornada: tipo, maxHours: orgLimits[tipo] };
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function isValidDateKey(val: string | null | undefined): val is string {
  return Boolean(val && /^\d{4}-\d{2}-\d{2}$/.test(val));
}

function parseDateKeyUtc(dateKey: string): Date {
  const [y = "1970", m = "01", d = "01"] = dateKey.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const dt = parseDateKeyUtc(dateKey);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Calcula el desglose de horas ordinarias y extras LFT (Arts. 66-68) para una semana natural:
 * - Ordinarias: hasta `maxWeeklyHours`.
 * - Dobles (200%): primeras 9 horas por encima del tope semanal.
 * - Triples (300%): excedente sobre las 9 horas extras dobles.
 */
export function computeLftWeeklyOvertime(
  workedHours: number,
  maxWeeklyHours: number
): OvertimeBreakdown {
  const safeWorked = Math.max(0, workedHours);
  const safeMax = Math.max(0, maxWeeklyHours);
  const ordinaryHours = round2(Math.min(safeWorked, safeMax));
  const overtime = Math.max(0, safeWorked - safeMax);
  const doubleOvertimeHours = round2(Math.min(overtime, 9));
  const tripleOvertimeHours = round2(Math.max(0, overtime - 9));
  return { ordinaryHours, doubleOvertimeHours, tripleOvertimeHours };
}

/**
 * Devuelve la fecha `YYYY-MM-DD` del lunes correspondiente a la semana natural de `dateKey`.
 */
export function getIsoWeekMondayKey(dateKey: string): string {
  const dt = parseDateKeyUtc(dateKey);
  const day = dt.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt.toISOString().slice(0, 10);
}

export function resolveReportDateRange(params: {
  period: ReportPeriodType;
  anchorDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
  timeZone?: string;
}): {
  period: ReportPeriodType;
  startDateKey: string;
  endDateKey: string;
  queryStart: Date;
  queryEnd: Date;
  label: string;
  daysCount: number;
} {
  const tz = params.timeZone ?? "America/Mexico_City";
  const todayKey = formatDateKeyInTz(params.now ?? new Date(), tz);
  const refKey = isValidDateKey(params.anchorDate) ? params.anchorDate : todayKey;

  let startDateKey: string;
  let endDateKey: string;

  if (params.period === "semanal") {
    startDateKey = getIsoWeekMondayKey(refKey);
    endDateKey = addDaysToDateKey(startDateKey, 6);
  } else if (params.period === "catorcenal") {
    if (isValidDateKey(params.anchorDate)) {
      startDateKey = params.anchorDate;
    } else {
      startDateKey = addDaysToDateKey(getIsoWeekMondayKey(todayKey), -7);
    }
    endDateKey = addDaysToDateKey(startDateKey, 13);
  } else if (params.period === "quincenal") {
    const [yStr = "1970", mStr = "01", dStr = "01"] = refKey.split("-");
    const year = Number(yStr);
    const month = Number(mStr);
    const day = Number(dStr);
    const ym = `${yStr}-${mStr}`;
    if (day <= 15) {
      startDateKey = `${ym}-01`;
      endDateKey = `${ym}-15`;
    } else {
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      startDateKey = `${ym}-16`;
      endDateKey = `${ym}-${String(lastDay).padStart(2, "0")}`;
    }
  } else if (params.period === "mensual") {
    const [yStr = "1970", mStr = "01"] = refKey.split("-");
    const year = Number(yStr);
    const month = Number(mStr);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    startDateKey = `${yStr}-${mStr}-01`;
    endDateKey = `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`;
  } else {
    let s = isValidDateKey(params.startDate) ? params.startDate : refKey;
    let e = isValidDateKey(params.endDate) ? params.endDate : s;
    if (s > e) {
      const tmp = s;
      s = e;
      e = tmp;
    }
    startDateKey = s;
    endDateKey = e;
  }

  const rawDays =
    Math.round(
      (parseDateKeyUtc(endDateKey).getTime() -
        parseDateKeyUtc(startDateKey).getTime()) /
        86_400_000
    ) + 1;
  if (rawDays > 366) {
    endDateKey = addDaysToDateKey(startDateKey, 365);
  }

  const daysCount =
    Math.round(
      (parseDateKeyUtc(endDateKey).getTime() -
        parseDateKeyUtc(startDateKey).getTime()) /
        86_400_000
    ) + 1;

  const queryStart = new Date(
    `${addDaysToDateKey(startDateKey, -1)}T00:00:00.000Z`
  );
  const queryEnd = new Date(
    `${addDaysToDateKey(endDateKey, 1)}T23:59:59.999Z`
  );

  return {
    period: params.period,
    startDateKey,
    endDateKey,
    queryStart,
    queryEnd,
    label: `${startDateKey} a ${endDateKey}`,
    daysCount,
  };
}

export function formatDateKeyInTz(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getMinutesOfDayInTz(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (hour % 24) * 60 + minute;
}

export function parseScheduleTimeToMinutes(hhmm: string): number {
  const [hStr = "0", mStr = "0"] = hhmm.split(":");
  return Number(hStr) * 60 + Number(mStr);
}

export function evaluateDailyWork(
  dateKey: string,
  events: CheckInEvent[],
  schedule: EmployeeScheduleInfo | null,
  timeZone: string,
  todayKey: string = formatDateKeyInTz(new Date(), timeZone)
): DailyWorkResult {
  const validEvents = events
    .filter((e) => e.estado === "valido")
    .sort((a, b) => a.timestampLocal.getTime() - b.timestampLocal.getTime());

  if (validEvents.length === 0) {
    return {
      dateKey,
      status: "sin_registro",
      workedMinutes: 0,
      isTardy: false,
      tardyMinutes: 0,
    };
  }

  const firstEntry = validEvents.find((e) => e.tipo === "entrada") ?? null;
  const lastExit =
    [...validEvents].reverse().find((e) => e.tipo === "salida") ?? null;
  const mealStart =
    validEvents.find((e) => e.tipo === "inicio_comida") ?? null;
  const mealEnd =
    [...validEvents].reverse().find((e) => e.tipo === "fin_comida") ?? null;

  let isTardy = false;
  let tardyMinutes = 0;
  if (firstEntry && schedule) {
    const entryMin = getMinutesOfDayInTz(firstEntry.timestampLocal, timeZone);
    const expectedMin =
      parseScheduleTimeToMinutes(schedule.horaEntrada) + schedule.toleranciaMin;
    if (entryMin > expectedMin) {
      isTardy = true;
      tardyMinutes = entryMin - expectedMin;
    }
  }

  // Turno sin cierre: si es el día actual y ya tiene entrada, sigue en curso; si es día pasado o falta entrada, requiere corrección
  if (!firstEntry || !lastExit) {
    const isTodayInProgress = dateKey >= todayKey && firstEntry !== null;
    return {
      dateKey,
      status: isTodayInProgress ? "en_curso" : "requiere_correccion",
      workedMinutes: 0,
      isTardy,
      tardyMinutes,
    };
  }

  const grossMinutes = Math.max(
    0,
    Math.round(
      (lastExit.timestampLocal.getTime() - firstEntry.timestampLocal.getTime()) /
        60_000
    )
  );

  const mealMinutes =
    mealStart &&
    mealEnd &&
    mealEnd.timestampLocal.getTime() > mealStart.timestampLocal.getTime()
      ? Math.round(
          (mealEnd.timestampLocal.getTime() -
            mealStart.timestampLocal.getTime()) /
            60_000
        )
      : 0;

  return {
    dateKey,
    status: "completo",
    workedMinutes: Math.max(0, grossMinutes - mealMinutes),
    isTardy,
    tardyMinutes,
  };
}

export function computeWeeklyCompliance(params: {
  employees: EmployeeComplianceInput[];
  checkIns: CheckInEvent[];
  schedulesById: Map<string, EmployeeScheduleInfo>;
  horasSemanalesMax: number;
  orgWeeklyLimits?: OrgWeeklyLimits;
  timeZone: string;
  todayKey?: string;
  startDateKey?: string;
  endDateKey?: string;
}): WeeklyEmployeeCompliance[] {
  const {
    employees,
    checkIns,
    schedulesById,
    horasSemanalesMax,
    orgWeeklyLimits = {
      diurna: horasSemanalesMax,
      mixta: Math.min(horasSemanalesMax, 45),
      nocturna: Math.min(horasSemanalesMax, 42),
    },
    timeZone,
    todayKey = formatDateKeyInTz(new Date(), timeZone),
    startDateKey,
    endDateKey,
  } = params;

  const scheduleByEmpId = new Map<string, EmployeeScheduleInfo | null>();
  for (const emp of employees) {
    scheduleByEmpId.set(
      emp.id,
      emp.horarioId ? (schedulesById.get(emp.horarioId) ?? null) : null
    );
  }

  const eventsByEmp = new Map<string, CheckInEvent[]>();
  for (const ev of checkIns) {
    if (!ev.empleadoId || ev.estado !== "valido") continue;
    const list = eventsByEmp.get(ev.empleadoId) ?? [];
    list.push(ev);
    eventsByEmp.set(ev.empleadoId, list);
  }

  return employees.map((emp) => {
    const schedule = scheduleByEmpId.get(emp.id) ?? null;
    const { tipoJornada, maxHours } = resolveEffectiveWeeklyLimit(
      schedule,
      orgWeeklyLimits
    );

    const crossesMidnight =
      schedule !== null &&
      (parseScheduleTimeToMinutes(schedule.horaSalida) <
        parseScheduleTimeToMinutes(schedule.horaEntrada) ||
        schedule.tipoJornada === "nocturna");
    const entryThresholdMin = schedule
      ? Math.max(0, parseScheduleTimeToMinutes(schedule.horaEntrada) - 120)
      : 720;

    const empEvents = [...(eventsByEmp.get(emp.id) ?? [])].sort(
      (a, b) => a.timestampLocal.getTime() - b.timestampLocal.getTime()
    );

    const dayMap = new Map<string, CheckInEvent[]>();
    for (const ev of empEvents) {
      let dayKey = formatDateKeyInTz(ev.timestampLocal, timeZone);

      if (crossesMidnight && ev.tipo !== "entrada") {
        const minOfDay = getMinutesOfDayInTz(ev.timestampLocal, timeZone);
        if (minOfDay < entryThresholdMin) {
          const prevDayKey = addDaysToDateKey(dayKey, -1);
          const prevEvents = dayMap.get(prevDayKey) ?? [];
          const prevEntry = prevEvents.find((p) => p.tipo === "entrada");
          const hasPrevExitAfterEntry =
            prevEntry !== undefined &&
            prevEvents.some(
              (p) =>
                p.tipo === "salida" &&
                p.timestampLocal.getTime() > prevEntry.timestampLocal.getTime()
            );
          if (
            prevEntry &&
            !hasPrevExitAfterEntry &&
            ev.timestampLocal.getTime() - prevEntry.timestampLocal.getTime() <=
              18 * 3600_000
          ) {
            dayKey = prevDayKey;
          }
        }
      }

      if (startDateKey && dayKey < startDateKey) continue;
      if (endDateKey && dayKey > endDateKey) continue;

      const list = dayMap.get(dayKey) ?? [];
      list.push(ev);
      dayMap.set(dayKey, list);
    }

    let workedMinutes = 0;
    let daysComplete = 0;
    let daysRequireCorrection = 0;
    let hasInProgressToday = false;
    let tardies = 0;
    const weekMinutesMap = new Map<string, number>();

    for (const [dayKey, dayEvents] of dayMap.entries()) {
      const daily = evaluateDailyWork(
        dayKey,
        dayEvents,
        schedule,
        timeZone,
        todayKey
      );
      if (daily.status === "completo") {
        daysComplete += 1;
        workedMinutes += daily.workedMinutes;
        const weekKey = getIsoWeekMondayKey(dayKey);
        weekMinutesMap.set(
          weekKey,
          (weekMinutesMap.get(weekKey) ?? 0) + daily.workedMinutes
        );
      } else if (daily.status === "en_curso") {
        hasInProgressToday = true;
      } else if (daily.status === "requiere_correccion") {
        daysRequireCorrection += 1;
      }
      if (daily.isTardy) tardies += 1;
    }

    let ordinaryHours = 0;
    let doubleOvertimeHours = 0;
    let tripleOvertimeHours = 0;
    let worstStatus: WeeklyEmployeeCompliance["weeklyStatus"] = "normal";

    for (const wMinutes of weekMinutesMap.values()) {
      const wHours = round2(wMinutes / 60);
      const breakdown = computeLftWeeklyOvertime(wHours, maxHours);
      ordinaryHours = round2(ordinaryHours + breakdown.ordinaryHours);
      doubleOvertimeHours = round2(
        doubleOvertimeHours + breakdown.doubleOvertimeHours
      );
      tripleOvertimeHours = round2(
        tripleOvertimeHours + breakdown.tripleOvertimeHours
      );

      const wStatus: WeeklyEmployeeCompliance["weeklyStatus"] =
        wHours > maxHours
          ? "excedido"
          : wHours >= maxHours * 0.9
            ? "alerta_preventiva"
            : "normal";

      if (wStatus === "excedido") {
        worstStatus = "excedido";
      } else if (
        wStatus === "alerta_preventiva" &&
        worstStatus === "normal"
      ) {
        worstStatus = "alerta_preventiva";
      }
    }

    const workedHours = round2(workedMinutes / 60);

    return {
      empleadoId: emp.id,
      codigoInterno: emp.codigoInterno ?? "-",
      nombreCompleto: emp.nombreCompleto,
      puesto: emp.puesto ?? "-",
      tipoJornada,
      workedMinutes,
      workedHours,
      ordinaryHours,
      doubleOvertimeHours,
      tripleOvertimeHours,
      maxHours,
      daysComplete,
      daysRequireCorrection,
      hasInProgressToday,
      tardies,
      weeklyStatus: worstStatus,
      alertaJornada: worstStatus === "normal" ? 0 : 1,
    };
  });
}

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildWeeklyComplianceCsv(
  rows: WeeklyEmployeeCompliance[],
  periodLabel: string
): string {
  const header = [
    "Periodo",
    "Código",
    "Colaborador",
    "Puesto",
    "Tipo Jornada",
    "Horas Ordinarias",
    "Horas Extras Dobles",
    "Horas Extras Triples",
    "Total Horas",
    "Límite Semanal (h)",
    "Días Completos",
    "Requiere Corrección",
    "Retardos",
    "Alerta Jornada",
  ];

  const jornadaLabels: Record<JornadaType, string> = {
    diurna: "Diurna",
    mixta: "Mixta",
    nocturna: "Nocturna",
  };

  const lines = [
    header.map(escapeCsvCell).join(","),
    ...rows.map((r) =>
      [
        periodLabel,
        r.codigoInterno,
        r.nombreCompleto,
        r.puesto,
        jornadaLabels[r.tipoJornada] ?? "Diurna",
        r.ordinaryHours.toFixed(2),
        r.doubleOvertimeHours.toFixed(2),
        r.tripleOvertimeHours.toFixed(2),
        r.workedHours.toFixed(2),
        r.maxHours,
        r.daysComplete,
        r.daysRequireCorrection,
        r.tardies,
        r.alertaJornada,
      ]
        .map(escapeCsvCell)
        .join(",")
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export interface CheckInDetailCsvRow {
  timestampLocalIso: string;
  codigoInterno: string | null;
  empleadoNombre: string | null;
  sucursalNombre: string;
  dispositivoNombre: string;
  dispositivoTipo: string;
  tipo: string;
  estado: string;
  latitud: string | null;
  longitud: string | null;
  precisionGps: number | null;
  incidenciaUbicacion: string | null;
  incidenciaEstado: string | null;
  incidenciaMotivo: string | null;
  googleMapsUrl: string | null;
}

export function buildCheckInsDetailCsv(
  rows: CheckInDetailCsvRow[],
  timeZone: string
): string {
  const header = [
    "Fecha y Hora",
    "Código",
    "Colaborador",
    "Sucursal",
    "Terminal",
    "Modalidad",
    "Movimiento",
    "Estado",
    "Latitud",
    "Longitud",
    "Precisión GPS (m)",
    "Incidencia GPS",
    "Estado Incidencia",
    "Motivo Resolución",
    "Google Maps",
  ];

  const lines = [
    header.map(escapeCsvCell).join(","),
    ...rows.map((r) => {
      const formattedDate = new Date(r.timestampLocalIso).toLocaleString("es-MX", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const modalidad =
        r.dispositivoTipo === "dispositivo_personal_movil"
          ? "Móvil Personal"
          : "Quiosco Sucursal";

      return [
        formattedDate,
        r.codigoInterno ?? "-",
        r.empleadoNombre ?? "Persona no identificada",
        r.sucursalNombre,
        r.dispositivoNombre,
        modalidad,
        r.tipo,
        r.estado,
        r.latitud ?? "",
        r.longitud ?? "",
        r.precisionGps !== null ? Math.round(r.precisionGps) : "",
        r.incidenciaUbicacion ?? "",
        r.incidenciaEstado ?? "",
        r.incidenciaMotivo ?? "",
        r.googleMapsUrl ?? "",
      ]
        .map(escapeCsvCell)
        .join(",");
    }),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export function buildUnifiedAttendanceCsv(
  complianceRows: WeeklyEmployeeCompliance[],
  detailRows: CheckInDetailCsvRow[],
  periodLabel: string,
  timeZone: string,
  options?: { includeSummary?: boolean; includeDetail?: boolean }
): string {
  const includeSummary = options?.includeSummary !== false;
  const includeDetail = options?.includeDetail !== false;

  if (includeSummary && !includeDetail) {
    return buildWeeklyComplianceCsv(complianceRows, periodLabel);
  }
  if (!includeSummary && includeDetail) {
    return buildCheckInsDetailCsv(detailRows, timeZone);
  }

  const summaryCsv = buildWeeklyComplianceCsv(
    complianceRows,
    periodLabel
  ).replace(/^\uFEFF/, "");
  const detailCsv = buildCheckInsDetailCsv(detailRows, timeZone).replace(
    /^\uFEFF/,
    ""
  );
  return `\uFEFF${summaryCsv}\r\n\r\n${detailCsv}`;
}
