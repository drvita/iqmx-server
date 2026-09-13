import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  purchaseCustomData,
  toConversionActivityRow,
} from "@/server/attribution/conversions";

/**
 * 016 — Las piezas puras del reporte de conversiones y dos guardarraíles que
 * se leen del código fuente porque afirman AUSENCIA (que algo no se llama),
 * y eso no se observa desde fuera.
 */

describe("purchaseCustomData", () => {
  it("convierte centavos a unidades de la moneda", () => {
    // La base protege el dinero en centavos enteros; Meta espera unidades.
    expect(purchaseCustomData({ amountCents: 45050, currency: "MXN" })).toEqual({
      lead_stage: "won",
      value: 450.5,
      currency: "MXN",
    });
  });

  it("sin monto, asigna value: 1 y la divisa requerida por Meta para evitar rechazo", () => {
    // Meta exige divisa y valor para Purchase.
    // Si no se definió monto, asigna value: 1 por defecto.
    expect(purchaseCustomData({ amountCents: null, currency: "MXN" })).toEqual({
      lead_stage: "won",
      currency: "MXN",
      value: 1,
    });
    expect(purchaseCustomData({ amountCents: 0, currency: "MXN" })).toEqual({
      lead_stage: "won",
      currency: "MXN",
      value: 1,
    });
  });

  it("un monto negativo asigna el valor por defecto de 1", () => {
    expect(purchaseCustomData({ amountCents: -100, currency: "MXN" })).toEqual({
      lead_stage: "won",
      currency: "MXN",
      value: 1,
    });
  });

  it("sin moneda capturada, utiliza DEFAULT_CURRENCY para evitar rechazo de Meta", () => {
    expect(purchaseCustomData({ amountCents: 12300, currency: null })).toEqual({
      lead_stage: "won",
      value: 123,
      currency: "MXN",
    });
  });
});

describe("toConversionActivityRow", () => {
  const base = {
    id: "cve_1",
    conversationId: "cv_1",
    eventName: "QualifiedLead",
    error: null,
    fbTraceId: "Aki1",
    contactName: "Marina",
    adHeadline: "Kit de verano",
    createdAt: new Date("2026-08-28T10:00:00.000Z"),
  };

  it("muestra el momento del ENVÍO cuando lo hubo", () => {
    const row = toConversionActivityRow({
      ...base,
      status: "sent",
      sentAt: new Date("2026-08-28T10:05:00.000Z"),
    });
    expect(row.at).toBe("2026-08-28T10:05:00.000Z");
    expect(row.adHeadline).toBe("Kit de verano");
  });

  it("y el de creación cuando no salió", () => {
    const row = toConversionActivityRow({
      ...base,
      status: "skipped",
      sentAt: null,
      error: "sin ctwa_clid",
    });
    expect(row.at).toBe("2026-08-28T10:00:00.000Z");
    // El motivo se conserva tal cual: es la respuesta a "¿por qué este lead no
    // aparece en Meta?".
    expect(row.error).toBe("sin ctwa_clid");
  });
});

describe("guardarraíles del reporte", () => {
  const source = readFileSync("src/server/attribution/conversions.ts", "utf8");

  it("una conversación de prueba jamás puede producir un evento", () => {
    // Mismo guardrail que el sender: el Laboratorio no toca el mundo real.
    expect(source).toContain("eq(schema.conversation.isTest, false)");
  });

  it("el dedup es el UNIQUE de la base, no un chequeo previo", () => {
    // A Meta no se le puede des-enviar una compra: dos movimientos simultáneos
    // del mismo lead tienen que chocar en la base, no en un `if`.
    expect(source).toContain("onConflictDoNothing");
  });

  it("la emisión cuelga de la puerta única de etapas", () => {
    const gate = readFileSync("src/server/leads/stage-history.ts", "utf8");
    expect(gate).toContain("reportStageChange");
    // Y ocurre DESPUÉS del commit: una llamada de red dentro de la transacción
    // la mantendría abierta mientras Meta piensa.
    const txEnd = gate.indexOf("  });");
    expect(gate.indexOf("reportStageChange(", txEnd)).toBeGreaterThan(txEnd);
  });

  it("el reintento manual exige que el evento esté en failed", () => {
    // Solo los eventos fallidos se pueden reintentar (no enviados ni omitidos)
    expect(source).toContain('event.status !== "failed"');
    expect(source).toContain("retryConversion");
  });
});
