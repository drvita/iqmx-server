"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import {
  changeOwnPassword,
  createOrgUser,
  deleteOrgUser,
  setInitialPassword,
  toggleOrgUserActive,
  updateBranding,
  updateOrgUser,
} from "@/services/admin/branding-users";
import {
  createDeviceWithPin,
  deleteDevice,
  regenerateDevicePin,
  revokeDevice,
  updateDeviceName,
} from "@/services/admin/devices";
import {
  createEmployeeWithVectors,
  toggleEmployeeActive,
  updateEmployeeWithVectors,
} from "@/services/admin/employees";
import {
  createBranch,
  createSchedule,
  deleteBranch,
  deleteSchedule,
  updateBranch,
  updateSchedule,
} from "@/services/admin/schedules-branches";

const ADMIN_WRITE_ROLES = ["ORG_ADMIN", "RH_ASSISTANT"] as const;

export interface ActionResponse<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

const createEmployeeSchema = z.object({
  nombreCompleto: z.string().trim().min(2).max(150),
  codigoInterno: z.string().trim().max(50).optional(),
  puesto: z.string().trim().max(100).optional(),
  departamento: z.string().trim().max(100).optional(),
  sucursalId: z.string().uuid().nullable().optional(),
  horarioId: z.string().uuid().nullable().optional(),
  consentimientoBiometrico: z.boolean(),
  vectors: z.array(z.array(z.number()).length(512)).max(3).optional(),
});

export async function createEmployeeAction(
  raw: z.infer<typeof createEmployeeSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const parsed = createEmployeeSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos del empleado inválidos." };
    }
    const created = await createEmployeeWithVectors(
      session.orgId,
      session.userId,
      parsed.data
    );
    revalidatePath("/empleados");
    revalidatePath("/dashboard");
    return { ok: true, data: created };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear empleado.",
    };
  }
}

export async function toggleEmployeeActiveAction(
  empleadoId: string,
  activo: boolean
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(empleadoId);
    await toggleEmployeeActive(session.orgId, session.userId, id, activo);
    revalidatePath("/empleados");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Error al actualizar empleado.",
    };
  }
}

const createBranchSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  direccion: z.string().trim().max(300).optional(),
  zonaHoraria: z.string().trim().max(60).optional(),
});

export async function createBranchAction(
  raw: z.infer<typeof createBranchSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const parsed = createBranchSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos de sucursal inválidos." };
    }
    const created = await createBranch(
      session.orgId,
      session.userId,
      parsed.data
    );
    revalidatePath("/sucursales");
    revalidatePath("/dispositivos");
    revalidatePath("/dashboard");
    return { ok: true, data: created };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear sucursal.",
    };
  }
}

const createScheduleSchema = z.object({
  nombre: z.string().trim().min(2).max(100),
  horaEntrada: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  horaSalida: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  toleranciaMin: z.number().int().min(0).max(120),
  minutosComida: z.number().int().min(0).max(180),
  diasLaborales: z.array(z.number().int().min(1).max(7)).min(1),
});

export async function createScheduleAction(
  raw: z.infer<typeof createScheduleSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const parsed = createScheduleSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos de horario inválidos." };
    }
    const created = await createSchedule(
      session.orgId,
      session.userId,
      parsed.data
    );
    revalidatePath("/horarios");
    return { ok: true, data: created };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear horario.",
    };
  }
}

const createDeviceSchema = z.object({
  sucursalId: z.string().uuid(),
  nombre: z.string().trim().min(2).max(100),
});

export async function createDeviceAction(
  raw: z.infer<typeof createDeviceSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const parsed = createDeviceSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos de dispositivo inválidos." };
    }
    const created = await createDeviceWithPin(
      session.orgId,
      session.userId,
      parsed.data
    );
    revalidatePath("/dispositivos");
    revalidatePath("/dashboard");
    return { ok: true, data: created };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Error al registrar dispositivo.",
    };
  }
}

export async function regenerateDevicePinAction(
  dispositivoId: string
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(dispositivoId);
    const updated = await regenerateDevicePin(session.orgId, session.userId, id);
    revalidatePath("/dispositivos");
    return { ok: true, data: updated };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al regenerar PIN.",
    };
  }
}

export async function revokeDeviceAction(
  dispositivoId: string
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(dispositivoId);
    await revokeDevice(session.orgId, session.userId, id);
    revalidatePath("/dispositivos");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Error al desvincular dispositivo.",
    };
  }
}

export async function deleteDeviceAction(
  dispositivoId: string
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(dispositivoId);
    await deleteDevice(session.orgId, session.userId, id);
    revalidatePath("/dispositivos");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Error al eliminar dispositivo.",
    };
  }
}

const updateBrandingSchema = z.object({
  logoUrl: z.string().trim().max(500).nullable().optional(),
  colorPrimario: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  colorSecundario: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  mensajeBienvenida: z.string().trim().min(2).max(150),
  horasSemanalesMax: z.number().min(20).max(72),
  pinAuditoria: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El PIN de auditoría debe tener 6 dígitos.")
    .optional(),
});

export async function updateBrandingAction(
  raw: z.infer<typeof updateBrandingSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(["ORG_ADMIN"]);
    const parsed = updateBrandingSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Valores de marca u horas inválidos." };
    }
    await updateBranding(session.orgId, session.userId, parsed.data);
    revalidatePath("/configuracion");
    revalidatePath("/marca");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar configuración.",
    };
  }
}

const createUserSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8),
  rolCodigo: z.enum([
    "ORG_ADMIN",
    "RH_ASSISTANT",
    "SUPERVISOR_SUCURSAL",
    "AUDITOR_NOMINA",
  ]),
});

export async function createOrgUserAction(
  raw: z.infer<typeof createUserSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(["ORG_ADMIN"]);
    const parsed = createUserSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos del asistente inválidos." };
    }
    await createOrgUser(session.orgId, session.userId, parsed.data);
    revalidatePath("/asistentes");
    revalidatePath("/marca");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear asistente.",
    };
  }
}

export async function updateEmployeeAction(
  empleadoId: string,
  raw: z.infer<typeof createEmployeeSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(empleadoId);
    const parsed = createEmployeeSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos del empleado inválidos." };
    }
    const updated = await updateEmployeeWithVectors(
      session.orgId,
      session.userId,
      id,
      parsed.data
    );
    revalidatePath("/empleados");
    revalidatePath("/dashboard");
    return { ok: true, data: updated };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar empleado.",
    };
  }
}

export async function updateBranchAction(
  sucursalId: string,
  raw: z.infer<typeof createBranchSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(sucursalId);
    const parsed = createBranchSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos de sucursal inválidos." };
    }
    const updated = await updateBranch(session.orgId, session.userId, id, parsed.data);
    revalidatePath("/sucursales");
    revalidatePath("/dispositivos");
    revalidatePath("/empleados");
    return { ok: true, data: updated };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar sucursal.",
    };
  }
}

export async function deleteBranchAction(
  sucursalId: string
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(sucursalId);
    await deleteBranch(session.orgId, session.userId, id);
    revalidatePath("/sucursales");
    revalidatePath("/dispositivos");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar sucursal.",
    };
  }
}

export async function updateScheduleAction(
  horarioId: string,
  raw: z.infer<typeof createScheduleSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(horarioId);
    const parsed = createScheduleSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos de horario inválidos." };
    }
    const updated = await updateSchedule(session.orgId, session.userId, id, parsed.data);
    revalidatePath("/horarios");
    revalidatePath("/empleados");
    return { ok: true, data: updated };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar horario.",
    };
  }
}

export async function deleteScheduleAction(
  horarioId: string
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(horarioId);
    await deleteSchedule(session.orgId, session.userId, id);
    revalidatePath("/horarios");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar horario.",
    };
  }
}

export async function updateDeviceNameAction(
  dispositivoId: string,
  nombre: string
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(dispositivoId);
    const parsedNombre = z.string().trim().min(2).max(100).safeParse(nombre);
    if (!parsedNombre.success) {
      return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };
    }
    await updateDeviceName(session.orgId, session.userId, id, parsedNombre.data);
    revalidatePath("/dispositivos");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al renombrar dispositivo.",
    };
  }
}

const updateUserSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().optional(),
  rolCodigo: z.enum([
    "ORG_ADMIN",
    "RH_ASSISTANT",
    "SUPERVISOR_SUCURSAL",
    "AUDITOR_NOMINA",
  ]),
});

export async function updateOrgUserAction(
  targetUserId: string,
  raw: z.infer<typeof updateUserSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession(ADMIN_WRITE_ROLES);
    const id = z.string().uuid().parse(targetUserId);
    const parsed = updateUserSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Datos del usuario inválidos." };
    }
    if (parsed.data.password && parsed.data.password.trim().length > 0 && parsed.data.password.trim().length < 8) {
      return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
    }
    await updateOrgUser(
      session.orgId,
      session.userId,
      session.rol,
      id,
      parsed.data
    );
    revalidatePath("/asistentes");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar usuario.",
    };
  }
}

export async function toggleOrgUserActiveAction(
  targetUserId: string,
  activo: boolean
): Promise<ActionResponse> {
  try {
    const session = await requireSession(["ORG_ADMIN"]);
    const id = z.string().uuid().parse(targetUserId);
    await toggleOrgUserActive(session.orgId, session.userId, session.rol, id, activo);
    revalidatePath("/asistentes");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cambiar estado del asistente.",
    };
  }
}

export async function deleteOrgUserAction(
  targetUserId: string
): Promise<ActionResponse> {
  try {
    const session = await requireSession(["ORG_ADMIN"]);
    const id = z.string().uuid().parse(targetUserId);
    await deleteOrgUser(session.orgId, session.userId, session.rol, id);
    revalidatePath("/asistentes");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar asistente.",
    };
  }
}

const initialPasswordSchema = z.object({
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(128),
});

export async function setInitialPasswordAction(
  raw: z.infer<typeof initialPasswordSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession();
    const parsed = initialPasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Contraseña inválida.",
      };
    }
    await setInitialPassword(session.orgId, session.userId, parsed.data.newPassword);
    revalidatePath("/dashboard");
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "No fue posible actualizar la contraseña.",
    };
  }
}

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual."),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres.").max(128),
});

export async function changeOwnPasswordAction(
  raw: z.infer<typeof changeOwnPasswordSchema>
): Promise<ActionResponse> {
  try {
    const session = await requireSession();
    const parsed = changeOwnPasswordSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Datos de contraseña inválidos.",
      };
    }
    await changeOwnPassword(
      session.orgId,
      session.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "No fue posible cambiar la contraseña.",
    };
  }
}
