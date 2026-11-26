import { describe, expect, it } from "vitest";
import {
  computeCheckInIntegrityHash,
  verifyCheckInIntegrityHash,
} from "@/lib/security/integrity-seal";
import {
  computeWeeklyCompliance,
  resolveEffectiveWeeklyLimit,
  type CheckInEvent,
  type EmployeeScheduleInfo,
} from "@/services/reports/attendance-compliance";
import { generateStpsCompliancePdf } from "@/services/reports/stps-pdf";

const TZ = "America/Mexico_City";

describe("Sprint A: tipos de jornada LFT, sellado SHA-256 y PDF STPS", () => {
  it("resuelve el límite semanal efectivo según tipo de jornada o límite específico del turno", () => {
    const orgLimits = { diurna: 48, mixta: 45, nocturna: 42 };

    expect(
      resolveEffectiveWeeklyLimit(
        {
          horaEntrada: "09:00",
          horaSalida: "18:00",
          toleranciaMin: 10,
          minutosComida: 60,
          tipoJornada: "diurna",
          horasSemanalesLimite: null,
        },
        orgLimits
      )
    ).toEqual({ tipoJornada: "diurna", maxHours: 48 });

    expect(
      resolveEffectiveWeeklyLimit(
        {
          horaEntrada: "14:00",
          horaSalida: "21:30",
          toleranciaMin: 10,
          minutosComida: 30,
          tipoJornada: "mixta",
          horasSemanalesLimite: null,
        },
        orgLimits
      )
    ).toEqual({ tipoJornada: "mixta", maxHours: 45 });

    expect(
      resolveEffectiveWeeklyLimit(
        {
          horaEntrada: "22:00",
          horaSalida: "06:00",
          toleranciaMin: 10,
          minutosComida: 30,
          tipoJornada: "nocturna",
          horasSemanalesLimite: null,
        },
        orgLimits
      )
    ).toEqual({ tipoJornada: "nocturna", maxHours: 42 });

    expect(
      resolveEffectiveWeeklyLimit(
        {
          horaEntrada: "22:00",
          horaSalida: "06:00",
          toleranciaMin: 10,
          minutosComida: 30,
          tipoJornada: "nocturna",
          horasSemanalesLimite: 40,
        },
        orgLimits
      )
    ).toEqual({ tipoJornada: "nocturna", maxHours: 40 });
  });

  it("empareja turnos nocturnos que cruzan medianoche sin marcar requiere corrección", () => {
    const nightSchedule: EmployeeScheduleInfo = {
      horaEntrada: "22:00:00",
      horaSalida: "06:00:00",
      toleranciaMin: 10,
      minutosComida: 30,
      tipoJornada: "nocturna",
      horasSemanalesLimite: null,
    };

    const schedulesById = new Map([["sch-night", nightSchedule]]);
    const employees = [
      {
        id: "emp-n1",
        codigoInterno: "N-01",
        nombreCompleto: "Roberto Velador",
        puesto: "Velador",
        horarioId: "sch-night",
      },
    ];

    // Lunes 22:00 CST = martes 04:00 UTC (2026-11-10T04:00:00Z)
    // Martes 06:00 CST = martes 12:00 UTC (2026-11-10T12:00:00Z) -> 8 horas completas
    const checkIns: CheckInEvent[] = [
      {
        id: "n-in",
        empleadoId: "emp-n1",
        tipo: "entrada",
        estado: "valido",
        timestampLocal: new Date("2026-11-10T04:00:00.000Z"),
      },
      {
        id: "n-out",
        empleadoId: "emp-n1",
        tipo: "salida",
        estado: "valido",
        timestampLocal: new Date("2026-11-10T12:00:00.000Z"),
      },
    ];

    const summary = computeWeeklyCompliance({
      employees,
      checkIns,
      schedulesById,
      horasSemanalesMax: 48,
      orgWeeklyLimits: { diurna: 48, mixta: 45, nocturna: 42 },
      timeZone: TZ,
      todayKey: "2026-11-15",
      startDateKey: "2026-11-09",
      endDateKey: "2026-11-15",
    });

    const row = summary[0]!;
    expect(row.tipoJornada).toBe("nocturna");
    expect(row.maxHours).toBe(42);
    expect(row.daysComplete).toBe(1);
    expect(row.daysRequireCorrection).toBe(0);
    expect(row.workedHours).toBe(8);
  });

  it("genera y verifica sellos criptográficos SHA-256 deterministas y detecta alteraciones", () => {
    const payload = {
      id: "11111111-1111-4111-8111-111111111111",
      orgId: "22222222-2222-4222-8222-222222222222",
      dispositivoId: "33333333-3333-4333-8333-333333333333",
      empleadoId: "44444444-4444-4444-8444-444444444444",
      tipo: "entrada",
      estado: "valido",
      timestampLocalIso: "2026-11-26T14:00:00.000Z",
      timestampServidorIso: "2026-11-26T14:00:02.000Z",
      latitud: "20.6767000",
      longitud: "-103.3475000",
    };

    const hash = computeCheckInIntegrityHash(payload);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyCheckInIntegrityHash(payload, hash)).toBe(true);

    const tampered = { ...payload, timestampLocalIso: "2026-11-26T13:55:00.000Z" };
    expect(verifyCheckInIntegrityHash(tampered, hash)).toBe(false);
  });

  it("genera un PDF oficial STPS válido aún sin RFC o Registro Patronal IMSS", async () => {
    const pdf = await generateStpsCompliancePdf({
      org: {
        nombre: "Ferretería Lugo",
        razonSocial: null,
        rfc: null,
        registroPatronalImss: null,
        zonaHoraria: TZ,
      },
      branchLabel: "Todas las sucursales",
      periodLabel: "2026-11-23 a 2026-11-29",
      issuedAtIso: "2026-11-26T19:00:00.000Z",
      complianceRows: [
        {
          empleadoId: "emp-1",
          codigoInterno: "001",
          nombreCompleto: "Ana López",
          puesto: "Mostrador",
          tipoJornada: "diurna",
          workedMinutes: 2760,
          workedHours: 46,
          ordinaryHours: 46,
          doubleOvertimeHours: 0,
          tripleOvertimeHours: 0,
          maxHours: 46,
          daysComplete: 6,
          daysRequireCorrection: 0,
          hasInProgressToday: false,
          tardies: 0,
          weeklyStatus: "alerta_preventiva",
          alertaJornada: 1,
        },
      ],
      detailRows: [
        {
          timestampLocalIso: "2026-11-26T14:00:00.000Z",
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
          selloIntegridadSha256: null,
        },
      ],
      includeSummary: true,
      includeDetail: true,
    });

    expect(pdf.documentHash).toMatch(/^[a-f0-9]{64}$/);
    const header = new TextDecoder().decode(pdf.bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
    expect(pdf.bytes.length).toBeGreaterThan(1000);
  });
});
