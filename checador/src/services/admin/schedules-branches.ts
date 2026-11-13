import { and, count, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export async function listBranches(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.sucursales)
    .where(eq(schema.sucursales.orgId, orgId))
    .orderBy(desc(schema.sucursales.createdAt));
}

export async function createBranch(
  orgId: string,
  actorUserId: string,
  input: { nombre: string; direccion?: string; zonaHoraria?: string }
) {
  const db = getDb();
  const [org] = await db
    .select({ maxSucursales: schema.organizaciones.maxSucursales })
    .from(schema.organizaciones)
    .where(eq(schema.organizaciones.id, orgId))
    .limit(1);

  if (!org) throw new Error("Organización no encontrada.");

  const [cnt] = await db
    .select({ value: count() })
    .from(schema.sucursales)
    .where(and(eq(schema.sucursales.orgId, orgId), eq(schema.sucursales.activo, true)));

  if ((cnt?.value ?? 0) >= org.maxSucursales) {
    throw new Error(
      `PLAN_LIMIT_BRANCHES: Alcanzaste el límite de ${org.maxSucursales} sucursal(es) de tu plan.`
    );
  }

  const [created] = await db
    .insert(schema.sucursales)
    .values({
      orgId,
      nombre: input.nombre.trim(),
      direccion: input.direccion?.trim() || null,
      zonaHoraria: input.zonaHoraria?.trim() || null,
    })
    .returning();

  if (created) {
    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "SUCURSAL_CREADA",
      entidad: "sucursales",
      entidadId: created.id,
      detalle: { nombre: created.nombre },
    });
  }

  return created;
}

export async function updateBranch(
  orgId: string,
  actorUserId: string,
  sucursalId: string,
  input: { nombre: string; direccion?: string; zonaHoraria?: string }
) {
  const db = getDb();
  const [updated] = await db
    .update(schema.sucursales)
    .set({
      nombre: input.nombre.trim(),
      direccion: input.direccion?.trim() || null,
      zonaHoraria: input.zonaHoraria?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.sucursales.id, sucursalId), eq(schema.sucursales.orgId, orgId)))
    .returning();

  if (!updated) throw new Error("Sucursal no encontrada.");

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "SUCURSAL_ACTUALIZADA",
    entidad: "sucursales",
    entidadId: sucursalId,
    detalle: { nombre: updated.nombre },
  });

  return updated;
}

export async function deleteBranch(
  orgId: string,
  actorUserId: string,
  sucursalId: string
) {
  const db = getDb();

  const [empRef] = await db
    .select({ value: count() })
    .from(schema.empleados)
    .where(and(eq(schema.empleados.orgId, orgId), eq(schema.empleados.sucursalId, sucursalId)));

  if ((empRef?.value ?? 0) > 0) {
    throw new Error("No se puede eliminar la sucursal porque tiene empleados asignados.");
  }

  const [devRef] = await db
    .select({ value: count() })
    .from(schema.dispositivos)
    .where(and(eq(schema.dispositivos.orgId, orgId), eq(schema.dispositivos.sucursalId, sucursalId)));

  if ((devRef?.value ?? 0) > 0) {
    throw new Error("No se puede eliminar la sucursal porque tiene dispositivos vinculados.");
  }

  const [deleted] = await db
    .delete(schema.sucursales)
    .where(and(eq(schema.sucursales.id, sucursalId), eq(schema.sucursales.orgId, orgId)))
    .returning();

  if (!deleted) throw new Error("Sucursal no encontrada.");

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "SUCURSAL_ELIMINADA",
    entidad: "sucursales",
    entidadId: sucursalId,
    detalle: { nombre: deleted.nombre },
  });

  return deleted;
}

export async function listSchedules(orgId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.horarios)
    .where(eq(schema.horarios.orgId, orgId))
    .orderBy(desc(schema.horarios.createdAt));
}

export async function createSchedule(
  orgId: string,
  actorUserId: string,
  input: {
    nombre: string;
    horaEntrada: string;
    horaSalida: string;
    toleranciaMin: number;
    minutosComida: number;
    diasLaborales: number[];
  }
) {
  const db = getDb();
  const [created] = await db
    .insert(schema.horarios)
    .values({
      orgId,
      nombre: input.nombre.trim(),
      horaEntrada: input.horaEntrada,
      horaSalida: input.horaSalida,
      toleranciaMin: input.toleranciaMin,
      minutosComida: input.minutosComida,
      diasLaborales: input.diasLaborales,
    })
    .returning();

  if (created) {
    await db.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "HORARIO_CREADO",
      entidad: "horarios",
      entidadId: created.id,
      detalle: { nombre: created.nombre },
    });
  }

  return created;
}

export async function updateSchedule(
  orgId: string,
  actorUserId: string,
  horarioId: string,
  input: {
    nombre: string;
    horaEntrada: string;
    horaSalida: string;
    toleranciaMin: number;
    minutosComida: number;
    diasLaborales: number[];
  }
) {
  const db = getDb();
  const [updated] = await db
    .update(schema.horarios)
    .set({
      nombre: input.nombre.trim(),
      horaEntrada: input.horaEntrada,
      horaSalida: input.horaSalida,
      toleranciaMin: input.toleranciaMin,
      minutosComida: input.minutosComida,
      diasLaborales: input.diasLaborales,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.horarios.id, horarioId), eq(schema.horarios.orgId, orgId)))
    .returning();

  if (!updated) throw new Error("Horario no encontrado.");

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "HORARIO_ACTUALIZADO",
    entidad: "horarios",
    entidadId: horarioId,
    detalle: { nombre: updated.nombre },
  });

  return updated;
}

export async function deleteSchedule(
  orgId: string,
  actorUserId: string,
  horarioId: string
) {
  const db = getDb();

  const [empRef] = await db
    .select({ value: count() })
    .from(schema.empleados)
    .where(and(eq(schema.empleados.orgId, orgId), eq(schema.empleados.horarioId, horarioId)));

  if ((empRef?.value ?? 0) > 0) {
    throw new Error("No se puede eliminar el horario porque tiene empleados asignados.");
  }

  const [deleted] = await db
    .delete(schema.horarios)
    .where(and(eq(schema.horarios.id, horarioId), eq(schema.horarios.orgId, orgId)))
    .returning();

  if (!deleted) throw new Error("Horario no encontrado.");

  await db.insert(schema.auditLogs).values({
    orgId,
    usuarioId: actorUserId,
    accion: "HORARIO_ELIMINADO",
    entidad: "horarios",
    entidadId: horarioId,
    detalle: { nombre: deleted.nombre },
  });

  return deleted;
}
