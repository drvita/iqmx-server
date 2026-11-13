import { getDb, schema } from "./index";

export const BASE_ROLES = [
  {
    codigo: "ORG_ADMIN",
    descripcion: "Administrador general de la organización cliente",
  },
  {
    codigo: "RH_ASSISTANT",
    descripcion: "Asistente de Recursos Humanos (alta/edición de empleados y reportes)",
  },
  {
    codigo: "SUPERVISOR_SUCURSAL",
    descripcion: "Supervisor operativo asignado a sucursales específicas",
  },
  {
    codigo: "AUDITOR_NOMINA",
    descripcion: "Auditor de nómina con acceso de solo lectura a asistencias y reportes",
  },
] as const;

export const INITIAL_PYME_ROLE_CODES = ["ORG_ADMIN", "RH_ASSISTANT"] as const;

/**
 * Siembra de forma idempotente el catálogo base de roles en `checador.roles`.
 */
export async function seedBaseRoles(): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.roles)
    .values([...BASE_ROLES])
    .onConflictDoNothing({ target: schema.roles.codigo });
}
