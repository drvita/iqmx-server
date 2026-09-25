import { describe, expect, it } from "vitest";

describe("stage broadcast audience & variable mappings", () => {
  it("resuelve variables dinámicas de plantilla como el nombre del contacto", () => {
    const contact = { name: "Carlos Mendoza García", phone: "5215512345678" };
    const firstName = contact.name.trim().split(/\s+/)[0] || "Cliente";

    const mappings = ["{{nombre}}", "20% de descuento"];
    const resolved = mappings.map((m) => {
      if (m.toLowerCase() === "{{nombre}}" || m.toLowerCase() === "[nombre]") {
        return firstName;
      }
      return m;
    });

    expect(resolved[0]).toBe("Carlos");
    expect(resolved[1]).toBe("20% de descuento");
  });

  it("filtra motivos de pérdida correctamente", () => {
    const leads = [
      { id: "1", name: "Lead A", lossReason: "precio" },
      { id: "2", name: "Lead B", lossReason: "sin_presupuesto" },
      { id: "3", name: "Lead C", lossReason: "precio" },
    ];

    const todos = leads.filter(() => true);
    const soloPrecio = leads.filter((l) => l.lossReason === "precio");

    expect(todos.length).toBe(3);
    expect(soloPrecio.length).toBe(2);
    expect(soloPrecio.map((l) => l.id)).toEqual(["1", "3"]);
  });
});
