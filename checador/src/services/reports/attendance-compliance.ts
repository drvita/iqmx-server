export type CheckInEvent = {
  id: string;
  empleadoId: string | null;
  tipo: "entrada" | "salida" | "inicio_comida" | "fin_comida";
  estado: "valido" | "rechazado_spoof" | "rechazado_desconocido";
  timestampLocal: Date;
};

export type EmployeeScheduleInfo = {
  horaEntrada: string; // "HH:MM:SS" or "HH:MM"
  horaSalida: string;
  toleranciaMin: number;
  minutosComida: number;
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

export type WeeklyEmployeeCompliance = {
  empleadoId: string;
  codigoInterno: string;
  nombreCompleto: string;
  puesto: string;
  workedMinutes: number;
  workedHours: number;
  maxHours: number;
  daysComplete: number;
  daysRequireCorrection: number;
  hasInProgressToday: boolean;
  tardies: number;
  weeklyStatus: "normal" | "alerta_preventiva" | "excedido";
};

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
  timeZone: string;
  todayKey?: string;
}): WeeklyEmployeeCompliance[] {
  const {
    employees,
    checkIns,
    schedulesById,
    horasSemanalesMax,
    timeZone,
    todayKey = formatDateKeyInTz(new Date(), timeZone),
  } = params;

  const eventsByEmpDay = new Map<string, Map<string, CheckInEvent[]>>();
  for (const ev of checkIns) {
    if (!ev.empleadoId || ev.estado !== "valido") continue;
    const dayKey = formatDateKeyInTz(ev.timestampLocal, timeZone);
    let dayMap = eventsByEmpDay.get(ev.empleadoId);
    if (!dayMap) {
      dayMap = new Map();
      eventsByEmpDay.set(ev.empleadoId, dayMap);
    }
    const list = dayMap.get(dayKey) ?? [];
    list.push(ev);
    dayMap.set(dayKey, list);
  }

  return employees.map((emp) => {
    const schedule = emp.horarioId
      ? (schedulesById.get(emp.horarioId) ?? null)
      : null;
    const dayMap = eventsByEmpDay.get(emp.id) ?? new Map<string, CheckInEvent[]>();

    let workedMinutes = 0;
    let daysComplete = 0;
    let daysRequireCorrection = 0;
    let hasInProgressToday = false;
    let tardies = 0;

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
      } else if (daily.status === "en_curso") {
        hasInProgressToday = true;
      } else if (daily.status === "requiere_correccion") {
        daysRequireCorrection += 1;
      }
      if (daily.isTardy) tardies += 1;
    }

    const workedHours = Math.round((workedMinutes / 60) * 100) / 100;
    const weeklyStatus =
      workedHours > horasSemanalesMax
        ? "excedido"
        : workedHours >= horasSemanalesMax * 0.9
          ? "alerta_preventiva"
          : "normal";

    return {
      empleadoId: emp.id,
      codigoInterno: emp.codigoInterno ?? "-",
      nombreCompleto: emp.nombreCompleto,
      puesto: emp.puesto ?? "-",
      workedMinutes,
      workedHours,
      maxHours: horasSemanalesMax,
      daysComplete,
      daysRequireCorrection,
      hasInProgressToday,
      tardies,
      weeklyStatus,
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
  weekLabel: string
): string {
  const header = [
    "Semana",
    "Código",
    "Colaborador",
    "Puesto",
    "Horas Trabajadas",
    "Jornada Máxima (h)",
    "Días Completos",
    "Requiere Corrección",
    "Retardos",
    "Estado Semanal",
  ];

  const statusLabels: Record<WeeklyEmployeeCompliance["weeklyStatus"], string> =
    {
      normal: "En rango",
      alerta_preventiva: "Próximo al límite",
      excedido: "Jornada excedida",
    };

  const lines = [
    header.map(escapeCsvCell).join(","),
    ...rows.map((r) =>
      [
        weekLabel,
        r.codigoInterno,
        r.nombreCompleto,
        r.puesto,
        r.workedHours.toFixed(2),
        r.maxHours,
        r.daysComplete,
        r.daysRequireCorrection,
        r.tardies,
        statusLabels[r.weeklyStatus],
      ]
        .map(escapeCsvCell)
        .join(",")
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}
