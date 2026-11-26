import { describe, expect, it } from "vitest";
import {
  computeAcknowledgmentIntegrityHash,
  verifyAcknowledgmentIntegrityHash,
} from "@/lib/security/integrity-seal";
import {
  isAcknowledgmentWindowOpen,
  isLastScheduledWorkday,
} from "@/services/reports/weekly-acknowledgment";
import {
  isValidResetTokenFormat,
  passwordResetKey,
} from "@/services/auth/password-reset";

describe("Sprint B — Acuse de Conformidad y Recuperación de Contraseña", () => {
  it("detecta el último día laboral según diasLaborales del horario", () => {
    // 2026-11-27 es Viernes (ISO day 5), 2026-11-28 es Sábado (ISO day 6)
    const friday = new Date("2026-11-27T18:00:00-06:00");
    const saturday = new Date("2026-11-28T14:00:00-06:00");
    const thursday = new Date("2026-11-26T18:00:00-06:00");

    // Horario L-V [1,2,3,4,5]
    expect(
      isLastScheduledWorkday([1, 2, 3, 4, 5], friday, "America/Mexico_City")
    ).toBe(true);
    expect(
      isLastScheduledWorkday([1, 2, 3, 4, 5], thursday, "America/Mexico_City")
    ).toBe(false);

    // Horario L-S [1,2,3,4,5,6]
    expect(
      isLastScheduledWorkday([1, 2, 3, 4, 5, 6], friday, "America/Mexico_City")
    ).toBe(false);
    expect(
      isLastScheduledWorkday(
        [1, 2, 3, 4, 5, 6],
        saturday,
        "America/Mexico_City"
      )
    ).toBe(true);

    // Sin horario asignado: fallback viernes o sábado
    expect(isLastScheduledWorkday(null, friday, "America/Mexico_City")).toBe(
      true
    );
    expect(isLastScheduledWorkday([], thursday, "America/Mexico_City")).toBe(
      false
    );
  });

  it("bloquea el envío del acuse en días previos al cierre y lo habilita en el último día laboral", () => {
    const tuesday = new Date("2026-11-24T14:00:00-06:00");
    const friday = new Date("2026-11-27T10:00:00-06:00");

    // Periodo semanal (L-V): martes bloqueado, viernes habilitado todo el día
    const tuesdayWeekly = isAcknowledgmentWindowOpen({
      diasLaborales: [1, 2, 3, 4, 5],
      periodTipo: "semanal",
      endDateKey: "2026-11-29",
      now: tuesday,
      timeZone: "America/Mexico_City",
    });
    expect(tuesdayWeekly.canSubmit).toBe(false);
    expect(tuesdayWeekly.reason).toBeTruthy();

    const fridayWeekly = isAcknowledgmentWindowOpen({
      diasLaborales: [1, 2, 3, 4, 5],
      periodTipo: "semanal",
      endDateKey: "2026-11-29",
      now: friday,
      timeZone: "America/Mexico_City",
    });
    expect(fridayWeekly.canSubmit).toBe(true);
    expect(fridayWeekly.reason).toBeNull();

    // Periodo quincenal: primera semana bloqueada incluso en viernes; semana de cierre habilitada
    const firstWeekFriday = isAcknowledgmentWindowOpen({
      diasLaborales: [1, 2, 3, 4, 5],
      periodTipo: "quincenal",
      endDateKey: "2026-11-30",
      now: new Date("2026-11-20T15:00:00-06:00"),
      timeZone: "America/Mexico_City",
    });
    expect(firstWeekFriday.canSubmit).toBe(false);

    const closingWeekFriday = isAcknowledgmentWindowOpen({
      diasLaborales: [1, 2, 3, 4, 5],
      periodTipo: "quincenal",
      endDateKey: "2026-11-30",
      now: friday,
      timeZone: "America/Mexico_City",
    });
    expect(closingWeekFriday.canSubmit).toBe(true);
  });

  it("genera y verifica el sello SHA-256 del acuse semanal de forma determinista", () => {
    const payload = {
      orgId: "11111111-1111-1111-1111-111111111111",
      empleadoId: "22222222-2222-2222-2222-222222222222",
      periodoClave: "2026-11-23_2026-11-29",
      horasOrdinarias: "46.00",
      horasExtrasDobles: "2.00",
      horasExtrasTriples: "0.00",
      totalHoras: "48.00",
      estado: "aceptado" as const,
      origen: "kiosco_touch" as const,
      timestampIso: "2026-11-27T18:00:00.000Z",
    };

    const hash = computeAcknowledgmentIntegrityHash(payload);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyAcknowledgmentIntegrityHash(payload, hash)).toBe(true);

    // Alterar horas rompe la verificación
    expect(
      verifyAcknowledgmentIntegrityHash(
        { ...payload, totalHoras: "50.00" },
        hash
      )
    ).toBe(false);
  });

  it("valida formato de tokens y llaves Redis para recuperación de contraseña", () => {
    const validToken = "a".repeat(64);
    expect(isValidResetTokenFormat(validToken)).toBe(true);
    expect(isValidResetTokenFormat("token-invalido")).toBe(false);
    expect(passwordResetKey(validToken)).toBe(
      `checador:pwd-reset:${validToken}`
    );
  });
});
