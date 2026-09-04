import { describe, expect, it } from "vitest";
import {
  APP_MODULES,
  hasModuleAccess,
} from "@/server/auth/permissions";

describe("RBAC y Roles de Usuario", () => {
  it("propietario (owner) siempre tiene acceso a todos los módulos", async () => {
    for (const mod of APP_MODULES) {
      const allowed = await hasModuleAccess("org_test", "owner", mod);
      expect(allowed).toBe(true);
    }
  });

  it("módulos declarados son exactamente los esperados", () => {
    expect(APP_MODULES).toContain("inbox");
    expect(APP_MODULES).toContain("pipeline");
    expect(APP_MODULES).toContain("agenda");
    expect(APP_MODULES).toContain("contacts");
    expect(APP_MODULES).toContain("asistentes");
    expect(APP_MODULES).toContain("whatsapp");
    expect(APP_MODULES).toContain("team");
  });
});
