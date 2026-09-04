import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";

import {
  APP_MODULES,
  type AppModule,
  MODULE_METADATA,
} from "@/lib/auth/permissions-constants";

export { APP_MODULES, type AppModule, MODULE_METADATA };

/** Permisos por defecto cuando no se han personalizado en base de datos. */
const DEFAULT_PERMISSIONS: Record<"admin" | "agent", Record<AppModule, boolean>> = {
  admin: {
    inbox: true,
    pipeline: true,
    agenda: true,
    contacts: true,
    asistentes: true,
    whatsapp: true,
    team: true,
  },
  agent: {
    inbox: true,
    pipeline: true,
    agenda: false,
    contacts: true,
    asistentes: false,
    whatsapp: false,
    team: false,
  },
};

/**
 * Consulta si un rol tiene acceso a un módulo dentro de la organización.
 * El rol 'owner' siempre tiene acceso irrestricto.
 */
export async function hasModuleAccess(
  organizationId: string,
  role: string,
  module: AppModule
): Promise<boolean> {
  if (role === "owner") return true;
  if (role !== "admin" && role !== "agent") return false;

  const db = getDb();
  const rows = await db
    .select({ allowed: schema.rolePermission.allowed })
    .from(schema.rolePermission)
    .where(
      and(
        scoped(schema.rolePermission.organizationId, organizationId),
        eq(schema.rolePermission.role, role),
        eq(schema.rolePermission.module, module)
      )
    )
    .limit(1);

  if (rows[0] !== undefined) {
    return rows[0].allowed;
  }

  return DEFAULT_PERMISSIONS[role]?.[module] ?? false;
}

/**
 * Devuelve la matriz completa de permisos para admin y agent en una organización.
 */
export async function getOrganizationRolePermissions(
  organizationId: string
): Promise<Record<"admin" | "agent", Record<AppModule, boolean>>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.rolePermission)
    .where(scoped(schema.rolePermission.organizationId, organizationId));

  const result: Record<"admin" | "agent", Record<AppModule, boolean>> = {
    admin: { ...DEFAULT_PERMISSIONS.admin },
    agent: { ...DEFAULT_PERMISSIONS.agent },
  };

  for (const row of rows) {
    const role = row.role as "admin" | "agent";
    const mod = row.module as AppModule;
    if (result[role] && APP_MODULES.includes(mod)) {
      result[role][mod] = row.allowed;
    }
  }

  return result;
}

/**
 * Guarda o actualiza el permiso de un módulo para un rol.
 */
export async function setRolePermission(
  organizationId: string,
  role: "admin" | "agent",
  module: AppModule,
  allowed: boolean
): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.rolePermission)
    .values({
      id: newId("rolePermission"),
      organizationId,
      role,
      module,
      allowed,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.rolePermission.organizationId,
        schema.rolePermission.role,
        schema.rolePermission.module,
      ],
      set: {
        allowed,
        updatedAt: new Date(),
      },
    });
}

/**
 * Devuelve los phoneNumberIds a los que tiene acceso un miembro.
 */
export async function getMemberLineAccess(
  organizationId: string,
  memberId: string
): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ phoneNumberId: schema.memberPhoneAccess.phoneNumberId })
    .from(schema.memberPhoneAccess)
    .where(
      and(
        scoped(schema.memberPhoneAccess.organizationId, organizationId),
        eq(schema.memberPhoneAccess.memberId, memberId)
      )
    );
  return rows.map((r) => r.phoneNumberId);
}

/**
 * Valida si un miembro puede ver o responder en una línea telefónica específica.
 * Owner y Admin siempre tienen acceso a todas las líneas.
 */
export async function canMemberAccessLine(
  organizationId: string,
  memberId: string,
  role: string,
  phoneNumberId?: string | null
): Promise<boolean> {
  if (role === "owner" || role === "admin") return true;
  if (!phoneNumberId) return true; // Si no hay línea asignada en legacy, se permite fallback

  const allowedLines = await getMemberLineAccess(organizationId, memberId);
  return allowedLines.includes(phoneNumberId);
}

/**
 * Asigna la lista de líneas telefónicas a un miembro.
 */
export async function setMemberLineAccess(
  organizationId: string,
  memberId: string,
  phoneNumberIds: string[]
): Promise<void> {
  const db = getDb();
  // Limpiar accesos previos
  await db
    .delete(schema.memberPhoneAccess)
    .where(
      and(
        scoped(schema.memberPhoneAccess.organizationId, organizationId),
        eq(schema.memberPhoneAccess.memberId, memberId)
      )
    );

  if (phoneNumberIds.length === 0) return;

  // Insertar nuevos accesos
  await db.insert(schema.memberPhoneAccess).values(
    phoneNumberIds.map((phoneNumberId) => ({
      id: newId("memberPhoneAccess"),
      organizationId,
      memberId,
      phoneNumberId,
      createdAt: new Date(),
    }))
  );
}
