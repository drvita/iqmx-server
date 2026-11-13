import { describe, expect, it } from "vitest";
import {
  buildWeeklyComplianceCsv,
  computeWeeklyCompliance,
  evaluateDailyWork,
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
    expect(row.daysComplete).toBe(5);
    expect(row.daysRequireCorrection).toBe(1);
    expect(row.weeklyStatus).toBe("excedido");

    const csv = buildWeeklyComplianceCsv(summary, "2026-11-09");
    expect(csv.startsWith("\uFEFFSemana,Código,Colaborador")).toBe(true);
    expect(csv).toContain("Ana López");
    expect(csv).toContain("42.50");
    expect(csv).toContain("Jornada excedida");
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
