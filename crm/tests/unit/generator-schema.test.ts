import { describe, expect, it } from "vitest";
import { GeneratedScenariosResponse } from "@/server/lab/generator";

describe("GeneratedScenariosResponse Schema Parsing", () => {
  const validScenarioItem = {
    key: "comprador_decidido",
    label: "Comprador decidido",
    description: "Cliente que pregunta por un producto real del catálogo.",
    contactName: "[Prueba] Comprador Decidido",
    script: ["Hola, ¿tienen taladros?", "¿Cuánto cuesta el modelo Bosch?", "Quiero comprar uno."],
  };

  const secondScenarioItem = {
    key: "pregunton_precios",
    label: "Preguntón de precios",
    description: "Cliente indeciso.",
    contactName: "[Prueba] Preguntón",
    script: ["Hola", "¿Tienen martillos?", "Y sierras?"],
  };

  it("parsea correctamente formato esperado: { scenarios: [ ... ] }", () => {
    const raw = {
      scenarios: [validScenarioItem, secondScenarioItem],
    };
    const parsed = GeneratedScenariosResponse.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.scenarios).toHaveLength(2);
    expect(parsed.data.scenarios[0]!.key).toBe("comprador_decidido");
  });

  it("parsea correctamente cuando el LLM responde un array directo: [ ... ]", () => {
    const raw = [validScenarioItem, secondScenarioItem];
    const parsed = GeneratedScenariosResponse.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.scenarios).toHaveLength(2);
    expect(parsed.data.scenarios[0]!.key).toBe("comprador_decidido");
  });

  it("parsea correctamente cuando el LLM responde un diccionario indexado por key (error reportado)", () => {
    const raw = {
      comprador_decidido: {
        label: "Comprador decidido",
        description: "Cliente que pregunta por un producto/servicio real del catálogo.",
        contactName: "[Prueba] Comprador Decidido",
        script: ["Hola, tienen taladros?", "Precio por favor"],
      },
      pregunton_precios: {
        label: "Preguntón de precios",
        description: "Cliente indeciso que pregunta por 3 productos.",
        contactName: "[Prueba] Preguntón",
        script: ["Hola", "Tienen martillos?", "Y sierras?"],
      },
    };
    const parsed = GeneratedScenariosResponse.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.scenarios).toHaveLength(2);
    expect(parsed.data.scenarios[0]!.key).toBe("comprador_decidido");
    expect(parsed.data.scenarios[1]!.key).toBe("pregunton_precios");
  });
});
