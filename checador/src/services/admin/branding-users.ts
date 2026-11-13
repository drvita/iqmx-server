import { and, count, desc, eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { RolCodigo } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { hashAuditPinServer } from "@/lib/security/audit-pin";

export async function getOrganizationOverview(orgId: string) {
  const db = getDb();
  const [org] = await db
    .select()
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org) return null;

  const [empCount] = await db
    .select({ value: count() })
    .from(schema.empleados)
    .where(and(eq(schema.empleados.orgId, orgId), eq(schema.empleados.activo, true)));

  const [sucCount] = await db
    .select({ value: count() })
    .from(schema.sucursales)
    .where(and(eq(schema.sucursales.orgId, orgId), eq(schema.sucursales.activo, true)));

  const [devCount] = await db
    .select({ value: count() })
    .from(schema.dispositivos)
    .where(and(eq(schema.dispositivos.orgId, orgId), eq(schema.dispositivos.activo, true)));

  return {
    org,
    usage: {
      empleados: empCount?.value ?? 0,
      sucursales: sucCount?.value ?? 0,
      dispositivos: devCount?.value ?? 0,
    },
  };
}

export async function updateBranding(
  orgId: string,
  actorUserId: string,
  input: {
    logoUrl?: string | null;
    colorPrimario: string;
    colorSecundario: string;
    mensajeBienvenida: string;
    horasSemanalesMax: number;
    pinAuditoria?: string;
  }
) {
  const db = getDb();
  const now = new Date();
  const updateSet: Record<string, unknown> = {
    logoUrl: input.logoUrl?.trim() || null,
    colorPrimario: input.colorPrimario,
    colorSecundario: input.colorSecundario,
    mensajeBienvenida: input.mensajeBienvenida.trim(),
    horasSemanalesMax: input.horasSemanalesMax.toFixed(1),
    brandingUpdatedAt: now,
    updatedAt: now,
  };
  if (input.pinAuditoria && /^\d{6}$/.test(input.pinAuditoria.trim())) {
    updateSet.pinAuditoriaHash = hashAuditPinServer(orgId, input.pinAuditoria);
  }

  const [updated] = await db
    .update(schema.organizaciones)
    .set(updateSet)
    .where(eq(schema.organizaciones.id, orgId))
    .returning();

  if (updated) {
    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "BRANDING_ACTUALIZADO",
      entidad: "organizaciones",
      entidadId: orgId,
      detalle: {
        colorPrimario: input.colorPrimario,
        horasSemanalesMax: input.horasSemanalesMax,
        pinAuditoriaActualizado: Boolean(input.pinAuditoria),
      },
    });
  }

  return updated ?? null;
}

export async function listOrgUsers(orgId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      email: schema.usuarios.email,
      activo: schema.usuarios.activo,
      rolCodigo: schema.roles.codigo,
      ultimoLoginAt: schema.usuarios.ultimoLoginAt,
      createdAt: schema.usuarios.createdAt,
    })
    .from(schema.usuarios)
    .innerJoin(schema.roles, eq(schema.usuarios.rolId, schema.roles.id))
    .where(eq(schema.usuarios.orgId, orgId))
    .orderBy(desc(schema.usuarios.createdAt));
}

export async function createOrgUser(
  orgId: string,
  actorUserId: string,
  input: {
    nombre: string;
    email: string;
    password: string;
    rolCodigo: RolCodigo;
  }
) {
  const db = getDb();
  const [org] = await db
    .select({ extraRolesEnabled: schema.organizaciones.extraRolesEnabled })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org) throw new Error("Organización no encontrada.");

  if (
    !org.extraRolesEnabled &&
    (input.rolCodigo === "SUPERVISOR_SUCURSAL" ||
      input.rolCodigo === "AUDITOR_NOMINA")
  ) {
    throw new Error(
      "PLAN_FEATURE_EXTRA_ROLES: Tu plan actual solo incluye ORG_ADMIN y RH_ASSISTANT."
    );
  }

  const [role] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.codigo, input.rolCodigo))
    .limit(1);

  if (!role) throw new Error("Rol no encontrado.");

  const normalizedEmail = input.email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: schema.usuarios.id })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.email, normalizedEmail))
    .limit(1);

  if (existing) {
    throw new Error("El correo ya está registrado.");
  }

  const [created] = await db
    .insert(schema.usuarios)
    .values({
      orgId,
      rolId: role.id,
      nombre: input.nombre.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(input.password),
      mustChangePassword: true,
    })
    .returning({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      email: schema.usuarios.email,
    });

  if (created) {
    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "USUARIO_CREADO",
      entidad: "usuarios",
      entidadId: created.id,
      detalle: { rolCodigo: input.rolCodigo },
    });
  }

  return created;
}

export async function updateOrgUser(
  orgId: string,
  actorUserId: string,
  actorRol: RolCodigo,
  targetUserId: string,
  input: {
    nombre: string;
    email: string;
    password?: string;
    rolCodigo: RolCodigo;
  }
) {
  const db = getDb();
  const [target] = await db
    .select({
      id: schema.usuarios.id,
      email: schema.usuarios.email,
      rolCodigo: schema.roles.codigo,
    })
    .from(schema.usuarios)
    .innerJoin(schema.roles, eq(schema.usuarios.rolId, schema.roles.id))
    .where(and(eq(schema.usuarios.id, targetUserId), eq(schema.usuarios.orgId, orgId)))
    .limit(1);

  if (!target) throw new Error("Usuario no encontrado.");

  if (target.rolCodigo === "ORG_ADMIN" && actorRol !== "ORG_ADMIN") {
    throw new Error(
      "Solo el administrador principal puede editar la cuenta principal."
    );
  }

  const nextRolCodigo: RolCodigo =
    target.rolCodigo === "ORG_ADMIN" ? "ORG_ADMIN" : input.rolCodigo;

  const [org] = await db
    .select({ extraRolesEnabled: schema.organizaciones.extraRolesEnabled })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org) throw new Error("Organización no encontrada.");

  if (
    !org.extraRolesEnabled &&
    (nextRolCodigo === "SUPERVISOR_SUCURSAL" ||
      nextRolCodigo === "AUDITOR_NOMINA")
  ) {
    throw new Error(
      "Tu plan actual solo incluye Administrador y Asistente de RH."
    );
  }

  const [role] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.codigo, nextRolCodigo))
    .limit(1);

  if (!role) throw new Error("Rol no encontrado.");

  const normalizedEmail = input.email.trim().toLowerCase();
  if (normalizedEmail !== target.email) {
    const [dup] = await db
      .select({ id: schema.usuarios.id })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.email, normalizedEmail))
      .limit(1);
    if (dup) throw new Error("El correo ya está registrado.");
  }

  const patch: Record<string, unknown> = {
    nombre: input.nombre.trim(),
    email: normalizedEmail,
    rolId: role.id,
    updatedAt: new Date(),
  };
  if (input.password && input.password.trim().length >= 8) {
    patch.passwordHash = hashPassword(input.password.trim());
  }

  const [updated] = await db
    .update(schema.usuarios)
    .set(patch)
    .where(and(eq(schema.usuarios.id, targetUserId), eq(schema.usuarios.orgId, orgId)))
    .returning({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      email: schema.usuarios.email,
    });

  if (updated) {
    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "USUARIO_ACTUALIZADO",
      entidad: "usuarios",
      entidadId: targetUserId,
      detalle: { rolCodigo: nextRolCodigo },
    });
  }

  return updated ?? null;
}

export async function toggleOrgUserActive(
  orgId: string,
  actorUserId: string,
  actorRol: RolCodigo,
  targetUserId: string,
  activo: boolean
) {
  const db = getDb();
  const [target] = await db
    .select({
      id: schema.usuarios.id,
      rolCodigo: schema.roles.codigo,
    })
    .from(schema.usuarios)
    .innerJoin(schema.roles, eq(schema.usuarios.rolId, schema.roles.id))
    .where(and(eq(schema.usuarios.id, targetUserId), eq(schema.usuarios.orgId, orgId)))
    .limit(1);

  if (!target) throw new Error("Usuario no encontrado.");
  if (target.rolCodigo === "ORG_ADMIN") {
    throw new Error("La cuenta principal no se puede desactivar.");
  }
  if (target.id === actorUserId) {
    throw new Error("No puedes desactivar tu propia cuenta.");
  }
  if (actorRol !== "ORG_ADMIN" && actorRol !== "RH_ASSISTANT") {
    throw new Error("Sin permisos para modificar asistentes.");
  }

  const [updated] = await db
    .update(schema.usuarios)
    .set({ activo, updatedAt: new Date() })
    .where(and(eq(schema.usuarios.id, targetUserId), eq(schema.usuarios.orgId, orgId)))
    .returning();

  if (updated) {
    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: activo ? "USUARIO_REACTIVADO" : "USUARIO_DESACTIVADO",
      entidad: "usuarios",
      entidadId: targetUserId,
      detalle: { activo },
    });
  }

  return updated ?? null;
}

export async function deleteOrgUser(
  orgId: string,
  actorUserId: string,
  actorRol: RolCodigo,
  targetUserId: string
) {
  const db = getDb();
  const [target] = await db
    .select({
      id: schema.usuarios.id,
      nombre: schema.usuarios.nombre,
      rolCodigo: schema.roles.codigo,
    })
    .from(schema.usuarios)
    .innerJoin(schema.roles, eq(schema.usuarios.rolId, schema.roles.id))
    .where(and(eq(schema.usuarios.id, targetUserId), eq(schema.usuarios.orgId, orgId)))
    .limit(1);

  if (!target) throw new Error("Usuario no encontrado.");
  if (target.rolCodigo === "ORG_ADMIN") {
    throw new Error("La cuenta principal no se puede eliminar.");
  }
  if (target.id === actorUserId) {
    throw new Error("No puedes eliminar tu propia cuenta.");
  }
  if (actorRol !== "ORG_ADMIN" && actorRol !== "RH_ASSISTANT") {
    throw new Error("Sin permisos para eliminar asistentes.");
  }

  const [deleted] = await db
    .delete(schema.usuarios)
    .where(and(eq(schema.usuarios.id, targetUserId), eq(schema.usuarios.orgId, orgId)))
    .returning();

  if (deleted) {
    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "USUARIO_ELIMINADO",
      entidad: "usuarios",
      entidadId: targetUserId,
      detalle: { nombre: target.nombre },
    });
  }

  return deleted ?? null;
}

export async function getUserMustChangePassword(
  orgId: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const [user] = await db
    .select({ mustChangePassword: schema.usuarios.mustChangePassword })
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.id, userId), eq(schema.usuarios.orgId, orgId)))
    .limit(1);

  return Boolean(user?.mustChangePassword);
}

export async function setInitialPassword(
  orgId: string,
  userId: string,
  newPassword: string
) {
  const db = getDb();
  const [user] = await db
    .select({
      id: schema.usuarios.id,
      mustChangePassword: schema.usuarios.mustChangePassword,
    })
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.id, userId), eq(schema.usuarios.orgId, orgId)))
    .limit(1);

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }
  if (!user.mustChangePassword) {
    throw new Error("La contraseña inicial ya fue configurada.");
  }

  await db
    .update(schema.usuarios)
    .set({
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.usuarios.id, userId), eq(schema.usuarios.orgId, orgId)));

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: userId,
    accion: "USUARIO_PASSWORD_INICIAL",
    entidad: "usuarios",
    entidadId: userId,
  });
}

export async function changeOwnPassword(
  orgId: string,
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const db = getDb();
  const [user] = await db
    .select({
      id: schema.usuarios.id,
      passwordHash: schema.usuarios.passwordHash,
    })
    .from(schema.usuarios)
    .where(and(eq(schema.usuarios.id, userId), eq(schema.usuarios.orgId, orgId)))
    .limit(1);

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    throw new Error("La contraseña actual es incorrecta.");
  }

  if (verifyPassword(newPassword, user.passwordHash)) {
    throw new Error("La nueva contraseña debe ser distinta a la actual.");
  }

  await db
    .update(schema.usuarios)
    .set({
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.usuarios.id, userId), eq(schema.usuarios.orgId, orgId)));

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: userId,
    accion: "USUARIO_PASSWORD_ACTUALIZADO",
    entidad: "usuarios",
    entidadId: userId,
  });
}
