import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt } from "@/server/ai/prompts";

describe("buildAgentSystemPrompt - inyección de etapa del lead", () => {
  const baseProfile = {
    id: "agp_test",
    organizationId: "org_test",
    name: "Sofía",
    type: "conversational",
    enabled: true,
    tone: "amable y conciso",
    instructions: "Ayuda a responder dudas.",
    escalationRules: null,
    greeting: "Hola, ¿en qué puedo ayudarte?",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as const;

  const stages = [
    { name: "Nuevo" },
    { name: "Interesado" },
    { name: "Cita Agendada" },
    { name: "Ganado" },
  ];

  it("incluye la etapa actual del lead cuando se proporciona", () => {
    const prompt = buildAgentSystemPrompt({
      profile: baseProfile as any,
      kb: [],
      stages,
      currentStage: "Interesado",
    });

    expect(prompt).toContain(
      "Etapas del pipeline disponibles: Nuevo | Interesado | Cita Agendada | Ganado"
    );
    expect(prompt).toContain("Etapa actual del lead: Interesado");

    // Verifica que la etapa actual aparezca después de las etapas disponibles
    const posEtapas = prompt.indexOf("Etapas del pipeline disponibles:");
    const posEtapaActual = prompt.indexOf("Etapa actual del lead: Interesado");
    expect(posEtapas).toBeGreaterThan(-1);
    expect(posEtapaActual).toBeGreaterThan(posEtapas);
  });

  it("omite la línea de etapa actual cuando currentStage es null o undefined", () => {
    const promptNull = buildAgentSystemPrompt({
      profile: baseProfile as any,
      kb: [],
      stages,
      currentStage: null,
    });

    expect(promptNull).toContain(
      "Etapas del pipeline disponibles: Nuevo | Interesado | Cita Agendada | Ganado"
    );
    expect(promptNull).not.toContain("Etapa actual del lead:");

    const promptUndefined = buildAgentSystemPrompt({
      profile: baseProfile as any,
      kb: [],
      stages,
    });

    expect(promptUndefined).not.toContain("Etapa actual del lead:");
  });
});
