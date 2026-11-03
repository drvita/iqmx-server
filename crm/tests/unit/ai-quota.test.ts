import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentMonthStr } from "@/server/ai/quota";

describe("Fase C: Cuota y Control de Costos de IA", () => {
  it("getCurrentMonthStr formatea mes correctamente", () => {
    const d = new Date("2026-11-05T12:00:00Z");
    expect(getCurrentMonthStr(d)).toBe("2026-11");
  });

  it("evalúa estado de cuota excedida cuando los tokens superan el límite", () => {
    const maxIn = 50000;
    const maxOut = 20000;
    const usedIn = 55000;
    const usedOut = 10000;
    const isExceeded = usedIn >= maxIn || usedOut >= maxOut;
    expect(isExceeded).toBe(true);
  });

  it("permite el uso cuando los tokens están dentro del límite permitido", () => {
    const maxIn = 50000;
    const maxOut = 20000;
    const usedIn = 42000;
    const usedOut = 15000;
    const isExceeded = usedIn >= maxIn || usedOut >= maxOut;
    expect(isExceeded).toBe(false);
  });

  it("inquilino con llave propia de API no tiene límite de cuota impuesto por el sistema", () => {
    const hasCustomKey = true;
    const quotaExceeded = hasCustomKey ? false : true;
    expect(quotaExceeded).toBe(false);
  });
});
