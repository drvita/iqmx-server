import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const DUPLICATE_SIMILARITY_THRESHOLD = 0.78;

export interface CreateEmployeeInput {
  nombreCompleto: string;
  codigoInterno?: string;
  puesto?: string;
  departamento?: string;
  sucursalId?: string | null;
  horarioId?: string | null;
  consentimientoBiometrico: boolean;
  vectors?: number[][];
}

function toPgVectorLiteral(vec: readonly number[]): string {
  return `[${vec.map((v) => Number(v).toFixed(6)).join(",")}]`;
}

export async function listEmployees(orgId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.empleados.id,
      codigoInterno: schema.empleados.codigoInterno,
      nombreCompleto: schema.empleados.nombreCompleto,
      puesto: schema.empleados.puesto,
      departamento: schema.empleados.departamento,
      sucursalId: schema.empleados.sucursalId,
      horarioId: schema.empleados.horarioId,
      consentimientoBiometrico: schema.empleados.consentimientoBiometrico,
      activo: schema.empleados.activo,
      syncVersion: schema.empleados.syncVersion,
      createdAt: schema.empleados.createdAt,
      vectoresCount: sql<number>`(
        SELECT count(*)::int
        FROM checador.empleado_vectores ev
        WHERE ev.empleado_id = ${schema.empleados.id}
          AND ev.org_id = ${orgId}
          AND ev.activo = true
      )`,
    })
    .from(schema.empleados)
    .where(eq(schema.empleados.orgId, orgId))
    .orderBy(desc(schema.empleados.createdAt));

  return rows;
}

export async function findDuplicateFaceInOrg(
  orgId: string,
  embedding: readonly number[],
  excludeEmpleadoId?: string
): Promise<{ empleadoId: string; nombreCompleto: string; similarity: number } | null> {
  if (embedding.length !== 512) {
    throw new Error("El vector facial debe tener exactamente 512 dimensiones.");
  }

  const db = getDb();
  const vecLiteral = toPgVectorLiteral(embedding);

  const conditions = [
    eq(schema.empleadoVectores.orgId, orgId),
    eq(schema.empleadoVectores.activo, true),
    eq(schema.empleados.activo, true),
  ];
  if (excludeEmpleadoId) {
    conditions.push(ne(schema.empleadoVectores.empleadoId, excludeEmpleadoId));
  }

  const matches = await db
    .select({
      empleadoId: schema.empleadoVectores.empleadoId,
      nombreCompleto: schema.empleados.nombreCompleto,
      similarity: sql<number>`1 - (${schema.empleadoVectores.embedding} <=> ${vecLiteral}::vector)`,
    })
    .from(schema.empleadoVectores)
    .innerJoin(
      schema.empleados,
      eq(schema.empleadoVectores.empleadoId, schema.empleados.id)
    )
    .where(and(...conditions))
    .orderBy(sql`${schema.empleadoVectores.embedding} <=> ${vecLiteral}::vector`)
    .limit(1);

  const best = matches[0];
  if (best && Number(best.similarity) >= DUPLICATE_SIMILARITY_THRESHOLD) {
    return {
      empleadoId: best.empleadoId,
      nombreCompleto: best.nombreCompleto,
      similarity: Number(best.similarity),
    };
  }
  return null;
}

export async function createEmployeeWithVectors(
  orgId: string,
  actorUserId: string,
  input: CreateEmployeeInput
) {
  const db = getDb();
  const vectors = input.vectors ?? [];

  if (vectors.length > 0 && !input.consentimientoBiometrico) {
    throw new Error(
      "CONSENT_REQUIRED: Se requiere consentimiento biométrico LFPDPPP antes de guardar vectores."
    );
  }
  if (vectors.length > 3) {
    throw new Error("Se permiten máximo 3 vectores por empleado.");
  }

  const [org] = await db
    .select({ maxEmpleados: schema.organizaciones.maxEmpleados })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org) throw new Error("Organización no encontrada.");

  const [cnt] = await db
    .select({ value: count() })
    .from(schema.empleados)
    .where(and(eq(schema.empleados.orgId, orgId), eq(schema.empleados.activo, true)));

  if ((cnt?.value ?? 0) >= org.maxEmpleados) {
    throw new Error(
      `PLAN_LIMIT_EMPLOYEES: Alcanzaste el límite de ${org.maxEmpleados} empleados de tu plan.`
    );
  }

  for (const vec of vectors) {
    const dup = await findDuplicateFaceInOrg(orgId, vec);
    if (dup) {
      throw new Error(
        `DUPLICATE_FACE: Este rostro coincide (${(dup.similarity * 100).toFixed(1)}%) con el empleado "${dup.nombreCompleto}".`
      );
    }
  }

  const created = await db.transaction(async (tx) => {
    const [emp] = await tx
      .insert(schema.empleados)
      .values({
        orgId,
        sucursalId: input.sucursalId || null,
        horarioId: input.horarioId || null,
        codigoInterno: input.codigoInterno?.trim() || null,
        nombreCompleto: input.nombreCompleto.trim(),
        puesto: input.puesto?.trim() || null,
        departamento: input.departamento?.trim() || null,
        consentimientoBiometrico: input.consentimientoBiometrico,
        consentimientoAt: input.consentimientoBiometrico ? new Date() : null,
        syncVersion: 1,
      })
      .returning();

    if (!emp) throw new Error("No se pudo crear el empleado.");

    if (vectors.length > 0) {
      await tx.insert(schema.empleadoVectores).values(
        vectors.map((vec) => ({
          orgId,
          empleadoId: emp.id,
          modeloVersion: "buffalo_s_v1",
          embedding: vec,
        }))
      );
    }

    await tx.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "EMPLEADO_CREADO",
      entidad: "empleados",
      entidadId: emp.id,
      detalle: {
        nombreCompleto: emp.nombreCompleto,
        vectoresGuardados: vectors.length,
      },
    });

    return emp;
  });

  return created;
}

export async function toggleEmployeeActive(
  orgId: string,
  actorUserId: string,
  empleadoId: string,
  activo: boolean
) {
  const db = getDb();
  const [updated] = await db
    .update(schema.empleados)
    .set({
      activo,
      syncVersion: sql`${schema.empleados.syncVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.empleados.id, empleadoId), eq(schema.empleados.orgId, orgId)))
    .returning();

  if (updated) {
    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: activo ? "EMPLEADO_REACTIVADO" : "EMPLEADO_BAJA",
      entidad: "empleados",
      entidadId: empleadoId,
      detalle: { activo },
    });
  }

  return updated ?? null;
}

export interface UpdateEmployeeInput {
  nombreCompleto: string;
  codigoInterno?: string;
  puesto?: string;
  departamento?: string;
  sucursalId?: string | null;
  horarioId?: string | null;
  consentimientoBiometrico: boolean;
  vectors?: number[][];
}

export async function updateEmployeeWithVectors(
  orgId: string,
  actorUserId: string,
  empleadoId: string,
  input: UpdateEmployeeInput
) {
  const db = getDb();
  const vectors = input.vectors ?? [];

  if (vectors.length > 0 && !input.consentimientoBiometrico) {
    throw new Error(
      "Se requiere consentimiento biométrico LFPDPPP antes de guardar vectores."
    );
  }
  if (vectors.length > 3) {
    throw new Error("Se permiten máximo 3 vectores por empleado.");
  }

  const [existing] = await db
    .select()
    .from(schema.empleados)
    .where(and(eq(schema.empleados.id, empleadoId), eq(schema.empleados.orgId, orgId)))
    .limit(1);

  if (!existing) {
    throw new Error("Empleado no encontrado.");
  }

  for (const vec of vectors) {
    const dup = await findDuplicateFaceInOrg(orgId, vec, empleadoId);
    if (dup) {
      throw new Error(
        `Este rostro coincide (${(dup.similarity * 100).toFixed(1)}%) con el empleado "${dup.nombreCompleto}".`
      );
    }
  }

  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    const [emp] = await tx
      .update(schema.empleados)
      .set({
        sucursalId: input.sucursalId || null,
        horarioId: input.horarioId || null,
        codigoInterno: input.codigoInterno?.trim() || null,
        nombreCompleto: input.nombreCompleto.trim(),
        puesto: input.puesto?.trim() || null,
        departamento: input.departamento?.trim() || null,
        consentimientoBiometrico: input.consentimientoBiometrico,
        consentimientoAt: input.consentimientoBiometrico
          ? existing.consentimientoAt ?? now
          : null,
        syncVersion: sql`${schema.empleados.syncVersion} + 1`,
        updatedAt: now,
      })
      .where(and(eq(schema.empleados.id, empleadoId), eq(schema.empleados.orgId, orgId)))
      .returning();

    if (!emp) throw new Error("No se pudo actualizar el empleado.");

    if (vectors.length > 0) {
      await tx
        .delete(schema.empleadoVectores)
        .where(
          and(
            eq(schema.empleadoVectores.empleadoId, empleadoId),
            eq(schema.empleadoVectores.orgId, orgId)
          )
        );

      await tx.insert(schema.empleadoVectores).values(
        vectors.map((vec) => ({
          orgId,
          empleadoId,
          modeloVersion: "buffalo_s_v1",
          embedding: vec,
        }))
      );
    }

    await tx.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "EMPLEADO_ACTUALIZADO",
      entidad: "empleados",
      entidadId: empleadoId,
      detalle: {
        nombreCompleto: emp.nombreCompleto,
        vectoresReemplazados: vectors.length > 0 ? vectors.length : 0,
      },
    });

    return emp;
  });

  return updated;
}
