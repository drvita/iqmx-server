import crypto from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/password";
import { getDb, schema } from "@/lib/db";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ExternalTenantStatus =
  | "active"
  | "trial"
  | "suspended"
  | "cancelled"
  | "activo"
  | "prueba"
  | "suspendido"
  | "cancelado";

export function normalizeOrgStatus(
  status?: ExternalTenantStatus
): "activo" | "prueba" | "suspendido" | "cancelado" {
  switch (status) {
    case "trial":
    case "prueba":
      return "prueba";
    case "suspended":
    case "suspendido":
      return "suspendido";
    case "cancelled":
    case "cancelado":
      return "cancelado";
    case "active":
    case "activo":
    default:
      return "activo";
  }
}

export interface ProvisionTenantFeaturesInput {
  nombre?: string;
  razonSocial?: string | null;
  rfc?: string | null;
  zonaHoraria?: string;
  planCodigo?: string;
  maxEmpleados?: number;
  maxDispositivos?: number;
  maxSucursales?: number;
  cloudEvidencesEnabled?: boolean;
  extraRolesEnabled?: boolean;
  horasSemanalesMax?: number;
}

export interface ProvisionTenantInput {
  externalCustomerId: string;
  companyName: string;
  razonSocial?: string;
  rfc?: string;
  zonaHoraria?: string;
  ownerEmail: string;
  ownerName: string;
  password?: string;
  status?: ExternalTenantStatus;
  features?: ProvisionTenantFeaturesInput;
}

export async function resolveTenantId(
  idOrExternal: string
): Promise<string | null> {
  const db = getDb();
  if (UUID_REGEX.test(idOrExternal)) {
    const byId = await db
      .select({ id: schema.organizaciones.id })
      .from(schema.organizaciones)
      .where(eq(schema.organizaciones.id, idOrExternal))
      .limit(1);
    if (byId[0]?.id) return byId[0].id;
  }

  const byExternal = await db
    .select({ id: schema.organizaciones.id })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.externalCustomerId, idOrExternal))
    .limit(1);

  return byExternal[0]?.id ?? null;
}

export async function provisionTenant(input: ProvisionTenantInput) {
  const db = getDb();
  const normalizedEmail = input.ownerEmail.trim().toLowerCase();

  const existingOrg = await db
    .select({
      id: schema.organizaciones.id,
      externalCustomerId: schema.organizaciones.externalCustomerId,
      nombre: schema.organizaciones.nombre,
      estado: schema.organizaciones.estado,
    })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.externalCustomerId, input.externalCustomerId))
    .limit(1);

  if (existingOrg[0]) {
    return {
      action: "existing" as const,
      organizationId: existingOrg[0].id,
      externalCustomerId: existingOrg[0].externalCustomerId,
      nombre: existingOrg[0].nombre,
      estado: existingOrg[0].estado,
      ownerEmail: normalizedEmail,
      tempPassword: null as string | null,
    };
  }

  const existingUser = await db
    .select({ id: schema.usuarios.id })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.email, normalizedEmail))
    .limit(1);

  if (existingUser[0]) {
    throw new Error(
      `CONFLICT_USER_ALREADY_EXISTS: El correo ${normalizedEmail} ya pertenece a otra organización.`
    );
  }

  const rawPassword =
    input.password ?? crypto.randomBytes(12).toString("base64url");
  const passwordHash = hashPassword(rawPassword);

  const created = await db.transaction(async (tx) => {
    await tx
      .insert(schema.roles)
      .values({
        codigo: "ORG_ADMIN",
        descripcion: "Administrador general de la organización cliente",
      })
      .onConflictDoNothing({ target: schema.roles.codigo });

    const [orgAdminRole] = await tx
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.codigo, "ORG_ADMIN"))
      .limit(1);

    if (!orgAdminRole) {
      throw new Error("Rol ORG_ADMIN no disponible en checador.roles");
    }

    const f = input.features;
    const [org] = await tx
      .insert(schema.organizaciones)
      .values({
        externalCustomerId: input.externalCustomerId,
        nombre: input.companyName,
        razonSocial: input.razonSocial ?? null,
        rfc: input.rfc ?? null,
        zonaHoraria: input.zonaHoraria ?? "America/Mexico_City",
        planCodigo: f?.planCodigo ?? "basico",
        maxEmpleados: f?.maxEmpleados ?? 15,
        maxDispositivos: f?.maxDispositivos ?? 2,
        maxSucursales: f?.maxSucursales ?? 1,
        cloudEvidencesEnabled: f?.cloudEvidencesEnabled ?? false,
        extraRolesEnabled: f?.extraRolesEnabled ?? false,
        horasSemanalesMax: (f?.horasSemanalesMax ?? 48.0).toFixed(1),
        estado: normalizeOrgStatus(input.status),
      })
      .returning();

    if (!org) {
      throw new Error("No se pudo insertar organización");
    }

    const [owner] = await tx
      .insert(schema.usuarios)
      .values({
        orgId: org.id,
        rolId: orgAdminRole.id,
        nombre: input.ownerName,
        email: normalizedEmail,
        passwordHash,
        mustChangePassword: true,
      })
      .returning({ id: schema.usuarios.id, email: schema.usuarios.email });

    const [sucursal] = await tx
      .insert(schema.sucursales)
      .values({
        orgId: org.id,
        nombre: "Matriz",
        zonaHoraria: org.zonaHoraria,
      })
      .returning({ id: schema.sucursales.id });

    const [horario] = await tx
      .insert(schema.horarios)
      .values({
        orgId: org.id,
        nombre: "Jornada Estándar L-V",
        horaEntrada: "09:00:00",
        horaSalida: "18:00:00",
        toleranciaMin: 10,
        minutosComida: 60,
        diasLaborales: [1, 2, 3, 4, 5],
      })
      .returning({ id: schema.horarios.id });

    await tx.insert(schema.auditLogs).values({
      orgId: org.id,
      usuarioId: owner?.id ?? null,
      accion: "TENANT_PROVISIONED",
      entidad: "organizaciones",
      entidadId: org.id,
      detalle: {
        externalCustomerId: org.externalCustomerId,
        sucursalMatrizId: sucursal?.id,
        horarioBaseId: horario?.id,
      },
    });

    return { org, owner };
  });

  return {
    action: "created" as const,
    organizationId: created.org.id,
    externalCustomerId: created.org.externalCustomerId,
    nombre: created.org.nombre,
    estado: created.org.estado,
    ownerEmail: created.owner?.email ?? normalizedEmail,
    tempPassword: input.password ? null : rawPassword,
  };
}

export async function getTenantFeatures(idOrExternal: string) {
  const organizationId = await resolveTenantId(idOrExternal);
  if (!organizationId) return null;

  const db = getDb();
  const [org] = await db
    .select({
      id: schema.organizaciones.id,
      externalCustomerId: schema.organizaciones.externalCustomerId,
      planCodigo: schema.organizaciones.planCodigo,
      maxEmpleados: schema.organizaciones.maxEmpleados,
      maxDispositivos: schema.organizaciones.maxDispositivos,
      maxSucursales: schema.organizaciones.maxSucursales,
      cloudEvidencesEnabled: schema.organizaciones.cloudEvidencesEnabled,
      extraRolesEnabled: schema.organizaciones.extraRolesEnabled,
      horasSemanalesMax: schema.organizaciones.horasSemanalesMax,
      estado: schema.organizaciones.estado,
      updatedAt: schema.organizaciones.updatedAt,
    })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, organizationId))
    .limit(1);

  return org ?? null;
}

export async function updateTenantFeatures(
  idOrExternal: string,
  patch: ProvisionTenantFeaturesInput
) {
  const organizationId = await resolveTenantId(idOrExternal);
  if (!organizationId) return null;

  const db = getDb();
  const updates: Partial<typeof schema.organizaciones.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (patch.nombre !== undefined) updates.nombre = patch.nombre;
  if (patch.razonSocial !== undefined) updates.razonSocial = patch.razonSocial;
  if (patch.rfc !== undefined) updates.rfc = patch.rfc;
  if (patch.zonaHoraria !== undefined) updates.zonaHoraria = patch.zonaHoraria;
  if (patch.planCodigo !== undefined) updates.planCodigo = patch.planCodigo;
  if (patch.maxEmpleados !== undefined) updates.maxEmpleados = patch.maxEmpleados;
  if (patch.maxDispositivos !== undefined)
    updates.maxDispositivos = patch.maxDispositivos;
  if (patch.maxSucursales !== undefined)
    updates.maxSucursales = patch.maxSucursales;
  if (patch.cloudEvidencesEnabled !== undefined)
    updates.cloudEvidencesEnabled = patch.cloudEvidencesEnabled;
  if (patch.extraRolesEnabled !== undefined)
    updates.extraRolesEnabled = patch.extraRolesEnabled;
  if (patch.horasSemanalesMax !== undefined)
    updates.horasSemanalesMax = patch.horasSemanalesMax.toFixed(1);

  const [updated] = await db
    .update(schema.organizaciones)
    .set(updates)
    .where(eq(schema.organizaciones.id, organizationId))
    .returning();

  if (updated) {
    await db.insert(schema.auditLogs).values({
      orgId: organizationId,
      accion: "TENANT_FEATURES_UPDATED",
      entidad: "organizaciones",
      entidadId: organizationId,
      detalle: patch,
    });
  }

  return updated ?? null;
}

export async function setTenantStatus(
  idOrExternal: string,
  status: ExternalTenantStatus,
  reason?: string
) {
  const organizationId = await resolveTenantId(idOrExternal);
  if (!organizationId) return null;

  const normalizedStatus = normalizeOrgStatus(status);
  const db = getDb();
  const [updated] = await db
    .update(schema.organizaciones)
    .set({
      estado: normalizedStatus,
      updatedAt: new Date(),
    })
    .where(eq(schema.organizaciones.id, organizationId))
    .returning({
      id: schema.organizaciones.id,
      externalCustomerId: schema.organizaciones.externalCustomerId,
      estado: schema.organizaciones.estado,
      updatedAt: schema.organizaciones.updatedAt,
    });

  if (updated) {
    await db.insert(schema.auditLogs).values({
      orgId: organizationId,
      accion: "TENANT_STATUS_UPDATED",
      entidad: "organizaciones",
      entidadId: organizationId,
      detalle: { estado: normalizedStatus, reason: reason ?? null },
    });
  }

  return updated ?? null;
}

export async function resetOwnerPassword(input: {
  externalCustomerId?: string;
  ownerEmail?: string;
  password: string;
}) {
  const db = getDb();
  const orgId = input.externalCustomerId
    ? await resolveTenantId(input.externalCustomerId)
    : null;

  if (input.externalCustomerId && !orgId && !input.ownerEmail) {
    throw new Error("No se encontró ninguna organización con el identificador proporcionado.");
  }

  const [orgAdminRole] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.codigo, "ORG_ADMIN"))
    .limit(1);

  if (!orgAdminRole) {
    throw new Error("Rol ORG_ADMIN no encontrado.");
  }

  const conditions = [eq(schema.usuarios.rolId, orgAdminRole.id)];
  if (orgId && input.ownerEmail) {
    conditions.push(
      or(
        eq(schema.usuarios.orgId, orgId),
        eq(schema.usuarios.email, input.ownerEmail.trim().toLowerCase())
      )!
    );
  } else if (orgId) {
    conditions.push(eq(schema.usuarios.orgId, orgId));
  } else if (input.ownerEmail) {
    conditions.push(
      eq(schema.usuarios.email, input.ownerEmail.trim().toLowerCase())
    );
  }

  if (conditions.length <= 1) {
    throw new Error("Debe especificar una organización o correo válido.");
  }

  const [owner] = await db
    .select({
      id: schema.usuarios.id,
      orgId: schema.usuarios.orgId,
      email: schema.usuarios.email,
    })
    .from(schema.usuarios)
    .where(and(...conditions))
    .limit(1);

  if (!owner) {
    throw new Error("No se encontró ninguna organización o propietario.");
  }

  const passwordHash = hashPassword(input.password);
  await db
    .update(schema.usuarios)
    .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(schema.usuarios.id, owner.id));

  await db.insert(schema.auditLogs).values({
    orgId: owner.orgId,
    usuarioId: owner.id,
    accion: "OWNER_PASSWORD_RESET",
    entidad: "usuarios",
    entidadId: owner.id,
    detalle: { email: owner.email },
  });

  return {
    ok: true,
    organizationId: owner.orgId,
    ownerEmail: owner.email,
  };
}
