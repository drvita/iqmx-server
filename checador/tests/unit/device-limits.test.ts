import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import {
  evaluateDeviceCreationLimit,
  filterAvailableEmployeesForPersonalMobile,
} from "@/services/admin/device-limits";

describe("límites de dispositivos físicos vs móviles personales", () => {
  it("valida kioscos físicos contra maxDispositivos sin contar móviles personales", () => {
    const allowed = evaluateDeviceCreationLimit({
      deviceType: "kiosco_sucursal",
      activeKioskCount: 1,
      activePersonalMobileCount: 10,
      maxDispositivos: 2,
      maxEmpleados: 15,
    });
    expect(allowed).toEqual({ allowed: true });

    const blocked = evaluateDeviceCreationLimit({
      deviceType: "kiosco_sucursal",
      activeKioskCount: 2,
      activePersonalMobileCount: 0,
      maxDispositivos: 2,
      maxEmpleados: 15,
    });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.error).toContain("PLAN_LIMIT_DEVICES");
      expect(blocked.error).toContain("2");
    }
  });

  it("valida móviles personales contra maxEmpleados sin contar kioscos físicos", () => {
    const allowed = evaluateDeviceCreationLimit({
      deviceType: "dispositivo_personal_movil",
      activeKioskCount: 5,
      activePersonalMobileCount: 14,
      maxDispositivos: 2,
      maxEmpleados: 15,
    });
    expect(allowed).toEqual({ allowed: true });

    const blocked = evaluateDeviceCreationLimit({
      deviceType: "dispositivo_personal_movil",
      activeKioskCount: 0,
      activePersonalMobileCount: 15,
      maxDispositivos: 2,
      maxEmpleados: 15,
    });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.error).toContain("PLAN_LIMIT_MOBILE_DEVICES");
      expect(blocked.error).toContain("15");
    }
  });

  it("filtra colaboradores ya ocupados por móvil personal activo (vinculado o pendiente de PIN)", () => {
    const employees = [
      { id: "emp-1", nombreCompleto: "Ana Ruta", activo: true },
      { id: "emp-2", nombreCompleto: "Luis Campo", activo: true },
      { id: "emp-3", nombreCompleto: "Sofía Libre", activo: true },
      { id: "emp-4", nombreCompleto: "Pedro Baja", activo: false },
    ];
    const devices = [
      {
        activo: true,
        tipo: "dispositivo_personal_movil",
        empleadoId: "emp-1",
      },
      {
        activo: false,
        tipo: "dispositivo_personal_movil",
        empleadoId: "emp-2",
      },
      {
        activo: true,
        tipo: "kiosco_sucursal",
        empleadoId: "emp-3",
      },
    ];

    const available = filterAvailableEmployeesForPersonalMobile(
      employees,
      devices
    );
    expect(available.map((e) => e.id)).toEqual(["emp-2", "emp-3"]);
  });

  it("define el índice único parcial uq_dispositivos_personal_empleado_activo en Drizzle", () => {
    const cfg = getTableConfig(schema.dispositivos);
    const indexNames = cfg.indexes.map((idx) => idx.config.name);
    expect(indexNames).toContain("uq_dispositivos_personal_empleado_activo");
  });
});
