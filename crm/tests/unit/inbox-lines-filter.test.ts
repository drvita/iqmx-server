import { describe, expect, it } from "vitest";
import { getLineColor, stringToHue } from "@/components/inbox/line-badge";
import type { ConversationDto, ConversationLineDto } from "@/lib/types";

describe("INBOX: Diferenciación de cuentas de WhatsApp y colores deterministas", () => {
  it("stringToHue genera un matiz determinista (0 a 359) según el texto", () => {
    const hue1 = stringToHue("ice frut");
    const hue2 = stringToHue("ice frut");
    const hue3 = stringToHue("iqiss mexico");

    expect(hue1).toBe(hue2);
    expect(hue1).toBeGreaterThanOrEqual(0);
    expect(hue1).toBeLessThan(360);
    expect(hue1).not.toBe(hue3);
  });

  it("getLineColor devuelve paleta completa para tema claro/oscuro y acentos", () => {
    const colors = getLineColor("ice frut");
    expect(colors).toHaveProperty("hue");
    expect(colors.dot).toContain("hsl(");
    expect(colors.border).toContain("hsl(");
    expect(colors.bg).toContain("hsl(");
    expect(colors.text).toContain("hsl(");
    expect(colors.accentBorder).toContain("hsl(");
  });
});

describe("INBOX: Regla de Roles y Visibilidad del Filtro de Cuentas", () => {
  const lineA: ConversationLineDto = {
    phoneNumberId: "phone_111",
    name: "ice frut",
    displayPhone: "+52 1 55 1111 1111",
    isDefault: true,
  };
  const lineB: ConversationLineDto = {
    phoneNumberId: "phone_222",
    name: "iqiss mexico",
    displayPhone: "+52 1 55 2222 2222",
    isDefault: false,
  };

  it("si la organización solo tiene 1 sola cuenta, NO se debe mostrar el filtro", () => {
    const lines = [lineA];
    const showLineFilter = lines.length > 1;
    expect(showLineFilter).toBe(false);
  });

  it("si un usuario agente solo tiene acceso a 1 sola cuenta, NO se debe mostrar el filtro", () => {
    const allOrgLines = [lineA, lineB];
    const agentAllowedIds = ["phone_111"];
    const agentLines = allOrgLines.filter((l) =>
      agentAllowedIds.includes(l.phoneNumberId)
    );

    expect(agentLines.length).toBe(1);
    const showLineFilter = agentLines.length > 1;
    expect(showLineFilter).toBe(false);
  });

  it("si el usuario tiene acceso a 2 o más cuentas (ej. admin o multi-línea), SÍ se muestra el filtro", () => {
    const lines = [lineA, lineB];
    const showLineFilter = lines.length > 1;
    expect(showLineFilter).toBe(true);
  });
});

describe("INBOX: Lógica de Filtrado de Conversaciones por Línea", () => {
  const mockConv = (id: string, phoneNumberId: string | null): ConversationDto => ({
    id,
    channel: "whatsapp",
    phoneNumberId,
    linePhone: phoneNumberId ? "+52 1 55 0000 0000" : null,
    lineName: phoneNumberId === "phone_111" ? "ice frut" : "iqiss mexico",
    contact: { id: `c_${id}`, name: `Contacto ${id}`, phone: "+52 1 55 1234 5678" },
    stageName: "Nuevo",
    aiEnabled: true,
    handoffAt: null,
    handoffReason: null,
    lastInboundAt: null,
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    windowOpen: true,
    windowRemainingMs: 100000,
    preview: "Hola",
  });

  const conversations: ConversationDto[] = [
    mockConv("conv_1", "phone_111"),
    mockConv("conv_2", "phone_111"),
    mockConv("conv_3", "phone_222"),
  ];

  function filterByLine(
    convs: ConversationDto[],
    lineFilter: string | "all"
  ): ConversationDto[] {
    return lineFilter === "all"
      ? convs
      : convs.filter((c) => c.phoneNumberId === lineFilter);
  }

  it("cuando lineFilter es 'all', devuelve todas las conversaciones", () => {
    const filtered = filterByLine(conversations, "all");
    expect(filtered.length).toBe(3);
  });

  it("cuando lineFilter es 'phone_111', solo devuelve las de 'ice frut'", () => {
    const filtered = filterByLine(conversations, "phone_111");
    expect(filtered.length).toBe(2);
    expect(filtered.every((c) => c.phoneNumberId === "phone_111")).toBe(true);
  });

  it("calcula correctamente el conteo de conversaciones por línea", () => {
    const countLine1 = conversations.filter((c) => c.phoneNumberId === "phone_111").length;
    const countLine2 = conversations.filter((c) => c.phoneNumberId === "phone_222").length;

    expect(countLine1).toBe(2);
    expect(countLine2).toBe(1);
  });
});
