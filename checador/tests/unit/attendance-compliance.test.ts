import { describe, expect, it } from "vitest";
import {
  buildUnifiedAttendanceCsv,
  buildWeeklyComplianceCsv,
  computeLftWeeklyOvertime,
  computeWeeklyCompliance,
  evaluateDailyWork,
  resolveReportDateRange,
  type CheckInEvent,
  type EmployeeScheduleInfo,
} from "@/services/reports/attendance-compliance";

const TZ = "America/Mexico_City";

const SCHEDULE: EmployeeScheduleInfo = {
  horaEntrada: "09:00:00",
  horaSalida: "18:00:00",
  toleranciaMin: 10,
  minutosComida: 60,
};

describe("attendance compliance engine", () => {
  it("computes worked minutes subtracting meal break and flags tardiness beyond tolerance", () => {
    const events: CheckInEvent[] = [
      {
        id: "1",
        empleadoId: "emp-1",
        tipo: "entrada",
        estado: "valido",
        // 09:15 CST = 15:15 UTC
        timestampLocal: new Date("2026-11-10T15:15:00.000Z"),
      },
      {
        id: "2",
        empleadoId: "emp-1",
        tipo: "inicio_comida",
        estado: "valido",
        timestampLocal: new Date("2026-11-10T20:00:00.000Z"),
      },
      {
        id: "3",
        empleadoId: "emp-1",
        tipo: "fin_comida",
        estado: "valido",
        timestampLocal: new Date("2026-11-10T21:00:00.000Z"),
      },
      {
        id: "4",
        empleadoId: "emp-1",
        tipo: "salida",
        estado: "valido",
        timestampLocal: new Date("2026-11-11T00:15:00.000Z"),
      },
    ];

    const res = evaluateDailyWork("2026-11-10", events, SCHEDULE, TZ);
    expect(res.status).toBe("completo");
    expect(res.workedMinutes).toBe(480); // 9h brutos - 1h comida = 8h
    expect(res.isTardy).toBe(true);
    expect(res.tardyMinutes).toBe(5); // 09:15 vs 09:10 tolerancia
  });

  it("marks today's open shift as en_curso and past open shifts as requiere_correccion", () => {
    const openShift: CheckInEvent[] = [
      {
        id: "1",
        empleadoId: "emp-1",
        tipo: "entrada",
        estado: "valido",
        timestampLocal: new Date("2026-11-10T15:00:00.000Z"),
      },
    ];

    const todayOpen = evaluateDailyWork(
      "2026-11-10",
      openShift,
      SCHEDULE,
      TZ,
      "2026-11-10"
    );
    expect(todayOpen.status).toBe("en_curso");
    expect(todayOpen.workedMinutes).toBe(0);

    const pastOpen = evaluateDailyWork(
      "2026-11-10",
      openShift,
      SCHEDULE,
      TZ,
      "2026-11-11"
    );
    expect(pastOpen.status).toBe("requiere_correccion");
    expect(pastOpen.workedMinutes).toBe(0);
    expect(pastOpen.isTardy).toBe(false);
  });

  it("computes weekly 40h compliance statuses and exports UTF-8 BOM CSV", () => {
    const schedulesById = new Map([["sch-1", SCHEDULE]]);
    const employees = [
      {
        id: "emp-1",
        codigoInterno: "001",
        nombreCompleto: "Ana López",
        puesto: "Operaciones",
        horarioId: "sch-1",
      },
    ];

    // 5 días x 8.5h = 42.5h -> excedido sobre límite de 40h + 1 día incompleto
    const checkIns: CheckInEvent[] = [];
    for (let day = 9; day <= 13; day++) {
      const dStr = String(day).padStart(2, "0");
      checkIns.push(
        {
          id: `in-${day}`,
          empleadoId: "emp-1",
          tipo: "entrada",
          estado: "valido",
          timestampLocal: new Date(`2026-11-${dStr}T15:00:00.000Z`),
        },
        {
          id: `out-${day}`,
          empleadoId: "emp-1",
          tipo: "salida",
          estado: "valido",
          timestampLocal: new Date(`2026-11-${dStr}T23:30:00.000Z`),
        }
      );
    }
    // Día 14 sin salida -> requiere corrección
    checkIns.push({
      id: "in-14",
      empleadoId: "emp-1",
      tipo: "entrada",
      estado: "valido",
      timestampLocal: new Date("2026-11-14T15:00:00.000Z"),
    });

    const summary = computeWeeklyCompliance({
      employees,
      checkIns,
      schedulesById,
      horasSemanalesMax: 40,
      timeZone: TZ,
      todayKey: "2026-11-15",
    });

    expect(summary).toHaveLength(1);
    const row = summary[0]!;
    expect(row.workedHours).toBe(42.5);
    expect(row.ordinaryHours).toBe(40);
    expect(row.doubleOvertimeHours).toBe(2.5);
    expect(row.tripleOvertimeHours).toBe(0);
    expect(row.alertaJornada).toBe(1);
    expect(row.daysComplete).toBe(5);
    expect(row.daysRequireCorrection).toBe(1);
    expect(row.weeklyStatus).toBe("excedido");

    const csv = buildWeeklyComplianceCsv(summary, "2026-11-09 a 2026-11-15");
    expect(
      csv.startsWith(
        "\uFEFFPeriodo,Código,Colaborador,Puesto,Tipo Jornada,Horas Ordinarias,Horas Extras Dobles,Horas Extras Triples,Total Horas"
      )
    ).toBe(true);
    expect(csv).toContain("Ana López");
    expect(csv).toContain("Diurna,40.00,2.50,0.00,42.50");
    expect(csv.trimEnd().endsWith(",1")).toBe(true);
  });

  it("desglosa horas ordinarias, extras dobles (<= 9h) y extras triples (> 9h) por semana natural", () => {
    expect(computeLftWeeklyOvertime(38, 46)).toEqual({
      ordinaryHours: 38,
      doubleOvertimeHours: 0,
      tripleOvertimeHours: 0,
    });
    expect(computeLftWeeklyOvertime(52, 46)).toEqual({
      ordinaryHours: 46,
      doubleOvertimeHours: 6,
      tripleOvertimeHours: 0,
    });
    expect(computeLftWeeklyOvertime(58, 46)).toEqual({
      ordinaryHours: 46,
      doubleOvertimeHours: 9,
      tripleOvertimeHours: 3,
    });
  });

  it("acumula extras por semana natural dentro de una quincena sin mezclar semanas", () => {
    const schedulesById = new Map([["sch-1", SCHEDULE]]);
    const employees = [
      {
        id: "emp-1",
        codigoInterno: "001",
        nombreCompleto: "Carlos Ruta",
        puesto: "Chofer",
        horarioId: "sch-1",
      },
    ];

    const checkIns: CheckInEvent[] = [];
    // Semana 1 (lun 2 a vie 6 nov): 5 días x 8h = 40h (en rango, 0 extras)
    for (let day = 2; day <= 6; day++) {
      const dStr = String(day).padStart(2, "0");
      checkIns.push(
        {
          id: `s1-in-${day}`,
          empleadoId: "emp-1",
          tipo: "entrada",
          estado: "valido",
          timestampLocal: new Date(`2026-11-${dStr}T15:00:00.000Z`),
        },
        {
          id: `s1-out-${day}`,
          empleadoId: "emp-1",
          tipo: "salida",
          estado: "valido",
          timestampLocal: new Date(`2026-11-${dStr}T23:00:00.000Z`),
        }
      );
    }
    // Semana 2 (lun 9 a vie 13 nov): 5 días x 10.5h = 52.5h sobre tope 40h => 40 ord + 9 dobles + 3.5 triples
    for (let day = 9; day <= 13; day++) {
      const dStr = String(day).padStart(2, "0");
      checkIns.push(
        {
          id: `s2-in-${day}`,
          empleadoId: "emp-1",
          tipo: "entrada",
          estado: "valido",
          timestampLocal: new Date(`2026-11-${dStr}T14:00:00.000Z`),
        },
        {
          id: `s2-out-${day}`,
          empleadoId: "emp-1",
          tipo: "salida",
          estado: "valido",
          timestampLocal: new Date(`2026-11-${dStr}T00:30:00.000Z`).getTime()
            ? new Date(
                new Date(`2026-11-${dStr}T14:00:00.000Z`).getTime() +
                  10.5 * 3600_000
              )
            : new Date(),
        }
      );
    }

    const summary = computeWeeklyCompliance({
      employees,
      checkIns,
      schedulesById,
      horasSemanalesMax: 40,
      timeZone: TZ,
      todayKey: "2026-11-15",
      startDateKey: "2026-11-01",
      endDateKey: "2026-11-15",
    });

    const row = summary[0]!;
    expect(row.ordinaryHours).toBe(80);
    expect(row.doubleOvertimeHours).toBe(9);
    expect(row.tripleOvertimeHours).toBe(3.5);
    expect(row.workedHours).toBe(92.5);
    expect(row.alertaJornada).toBe(1);
  });

  it("resuelve rangos semanal, catorcenal, quincenal, mensual y personalizado", () => {
    const sem = resolveReportDateRange({
      period: "semanal",
      anchorDate: "2026-11-26",
    });
    expect(sem.startDateKey).toBe("2026-11-23");
    expect(sem.endDateKey).toBe("2026-11-29");
    expect(sem.daysCount).toBe(7);

    const cat = resolveReportDateRange({
      period: "catorcenal",
      anchorDate: "2026-11-09",
    });
    expect(cat.startDateKey).toBe("2026-11-09");
    expect(cat.endDateKey).toBe("2026-11-22");
    expect(cat.daysCount).toBe(14);

    const q1 = resolveReportDateRange({
      period: "quincenal",
      anchorDate: "2026-11-10",
    });
    expect(q1.startDateKey).toBe("2026-11-01");
    expect(q1.endDateKey).toBe("2026-11-15");

    const q2 = resolveReportDateRange({
      period: "quincenal",
      anchorDate: "2026-02-20",
    });
    expect(q2.startDateKey).toBe("2026-02-16");
    expect(q2.endDateKey).toBe("2026-02-28");

    const men = resolveReportDateRange({
      period: "mensual",
      anchorDate: "2026-11-15",
    });
    expect(men.startDateKey).toBe("2026-11-01");
    expect(men.endDateKey).toBe("2026-11-30");

    const per = resolveReportDateRange({
      period: "personalizado",
      startDate: "2026-11-20",
      endDate: "2026-11-05",
    });
    expect(per.startDateKey).toBe("2026-11-05");
    expect(per.endDateKey).toBe("2026-11-20");
  });

  it("permite exportar solo resumen, solo detalle o ambos en buildUnifiedAttendanceCsv", () => {
    const summaryRows = computeWeeklyCompliance({
      employees: [
        {
          id: "emp-1",
          codigoInterno: "001",
          nombreCompleto: "Ana López",
          puesto: "Caja",
          horarioId: null,
        },
      ],
      checkIns: [],
      schedulesById: new Map(),
      horasSemanalesMax: 46,
      timeZone: TZ,
    });
    const detailRows = [
      {
        timestampLocalIso: "2026-11-26T15:00:00.000Z",
        codigoInterno: "001",
        empleadoNombre: "Ana López",
        sucursalNombre: "Matriz",
        dispositivoNombre: "Tablet 1",
        dispositivoTipo: "kiosco_sucursal",
        tipo: "entrada",
        estado: "valido",
        latitud: null,
        longitud: null,
        precisionGps: null,
        incidenciaUbicacion: null,
        incidenciaEstado: null,
        incidenciaMotivo: null,
        googleMapsUrl: null,
      },
    ];

    const onlySummary = buildUnifiedAttendanceCsv(
      summaryRows,
      detailRows,
      "2026-11-23 a 2026-11-29",
      TZ,
      { includeSummary: true, includeDetail: false }
    );
    expect(onlySummary).toContain("Horas Ordinarias");
    expect(onlySummary).not.toContain("Fecha y Hora");

    const onlyDetail = buildUnifiedAttendanceCsv(
      summaryRows,
      detailRows,
      "2026-11-23 a 2026-11-29",
      TZ,
      { includeSummary: false, includeDetail: true }
    );
    expect(onlyDetail).toContain("Fecha y Hora");
    expect(onlyDetail).not.toContain("Horas Ordinarias");
  });

  it("closes the day and computes gross worked minutes when salida exists without fin_comida", () => {
    const events: CheckInEvent[] = [
      {
        id: "1",
        empleadoId: "emp-1",
        tipo: "entrada",
        estado: "valido",
        // 10:24 CST = 16:24 UTC
        timestampLocal: new Date("2026-11-13T16:24:00.000Z"),
      },
      {
        id: "2",
        empleadoId: "emp-1",
        tipo: "inicio_comida",
        estado: "valido",
        // 10:52 CST = 16:52 UTC
        timestampLocal: new Date("2026-11-13T16:52:00.000Z"),
      },
      {
        id: "3",
        empleadoId: "emp-1",
        tipo: "salida",
        estado: "valido",
        // 11:29 CST = 17:29 UTC
        timestampLocal: new Date("2026-11-13T17:29:00.000Z"),
      },
    ];

    const res = evaluateDailyWork("2026-11-13", events, SCHEDULE, TZ, "2026-11-13");
    expect(res.status).toBe("completo");
    expect(res.workedMinutes).toBe(65); // 10:24 -> 11:29 = 1.08 h
  });
});
