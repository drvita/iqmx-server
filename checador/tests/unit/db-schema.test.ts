import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { BASE_ROLES, INITIAL_PYME_ROLE_CODES } from "@/lib/db/seed";
import { getEnv } from "@/lib/env";

describe("esquema Drizzle checador (Fase 1)", () => {
  it("define las 11 tablas requeridas dentro del schema checador", () => {
    const tables = [
      schema.organizaciones,
      schema.sucursales,
      schema.roles,
      schema.usuarios,
      schema.usuarioSucursales,
      schema.horarios,
      schema.empleados,
      schema.empleadoVectores,
      schema.dispositivos,
      schema.checadas,
      schema.auditLogs,
    ];

    const names = tables.map((t) => {
      const cfg = getTableConfig(t);
      expect(cfg.schema).toBe("checador");
      return cfg.name;
    });

    expect(names).toEqual([
      "organizaciones",
      "sucursales",
      "roles",
      "usuarios",
      "usuario_sucursales",
      "horarios",
      "empleados",
      "empleado_vectores",
      "dispositivos",
      "checadas",
      "audit_logs",
    ]);
  });

  it("incluye los roles base ORG_ADMIN y RH_ASSISTANT más roles extensibles", () => {
    expect(INITIAL_PYME_ROLE_CODES).toEqual(["ORG_ADMIN", "RH_ASSISTANT"]);
    expect(BASE_ROLES.map((r) => r.codigo)).toEqual([
      "ORG_ADMIN",
      "RH_ASSISTANT",
      "SUPERVISOR_SUCURSAL",
      "AUDITOR_NOMINA",
    ]);
  });

  it("resuelve getEnv con valores por defecto válidos", () => {
    const env = getEnv();
    expect(env.DATABASE_URL).toContain("search_path%3Dchecador");
    expect(env.REDIS_URL).toContain("redis://");
  });
});
