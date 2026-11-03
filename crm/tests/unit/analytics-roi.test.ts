import { describe, it, expect } from "vitest";

describe("Fase E: ROI de Ventas y Asistencia de IA", () => {
  it("clasifica montos y conteos de tratos ganados asistidos vs solo humanos", () => {
    const leads = [
      { id: "lead_1", contactId: "ct_1", amountCents: 50000 },
      { id: "lead_2", contactId: "ct_2", amountCents: 120000 },
      { id: "lead_3", contactId: "ct_3", amountCents: 30000 },
    ];

    const contactsWithAi = new Set(["ct_1", "ct_3"]);

    let wonAiAssistedCount = 0;
    let wonAiAssistedCents = 0;
    let wonHumanOnlyCount = 0;
    let wonHumanOnlyCents = 0;

    for (const l of leads) {
      if (contactsWithAi.has(l.contactId)) {
        wonAiAssistedCount++;
        wonAiAssistedCents += l.amountCents;
      } else {
        wonHumanOnlyCount++;
        wonHumanOnlyCents += l.amountCents;
      }
    }

    expect(wonAiAssistedCount).toBe(2);
    expect(wonAiAssistedCents).toBe(80000);
    expect(wonHumanOnlyCount).toBe(1);
    expect(wonHumanOnlyCents).toBe(120000);
  });
});
