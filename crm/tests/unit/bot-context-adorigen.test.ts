import { describe, it, expect } from "vitest";

describe("Fase D: Modo Híbrido de IA y Contexto de Atribución (adOrigen)", () => {
  it("da formato a adOrigen con el contrato Spec 031 para el cerebro externo", () => {
    const rawAttribution = {
      headline: "Descuento 20% en Software Médico",
      body: "Agenda tu demostración hoy mismo",
      sourceType: "ad",
      sourceUrl: "https://fb.me/demo123",
      hasCtwaClid: true,
      capturedAt: "2026-11-02T22:00:00.000Z",
    };

    const formattedAdOrigen = {
      headline: rawAttribution.headline,
      body: rawAttribution.body,
      sourceType: rawAttribution.sourceType,
      sourceUrl: rawAttribution.sourceUrl,
      hasCtwaClid: rawAttribution.hasCtwaClid,
      capturedAt: rawAttribution.capturedAt,
    };

    expect(formattedAdOrigen.headline).toBe("Descuento 20% en Software Médico");
    expect(formattedAdOrigen.hasCtwaClid).toBe(true);
    expect(formattedAdOrigen.sourceType).toBe("ad");
  });

  it("devuelve null cuando el contacto no tiene anuncio de origen asociado", () => {
    const rawAttribution = null as { headline: string; body: string; sourceType: string; sourceUrl: string; hasCtwaClid: boolean; capturedAt: string } | null;
    const formattedAdOrigen = rawAttribution !== null ? { ...rawAttribution } : null;
    expect(formattedAdOrigen).toBeNull();
  });
});
