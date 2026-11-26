import type { DeviceType } from "@/services/sync/gps-incidence";

export interface DeviceCreationLimitInput {
  deviceType: DeviceType;
  activeKioskCount: number;
  activePersonalMobileCount: number;
  maxDispositivos: number;
  maxEmpleados: number;
}

export type DeviceCreationLimitResult =
  | { allowed: true }
  | { allowed: false; error: string };

/**
 * Evalúa si la organización puede crear un nuevo dispositivo según su tipo:
 * - Kioscos físicos (`kiosco_sucursal`): se validan contra `maxDispositivos`.
 * - Móviles personales (`dispositivo_personal_movil`): se validan contra `maxEmpleados`.
 */
export function evaluateDeviceCreationLimit(
  params: DeviceCreationLimitInput
): DeviceCreationLimitResult {
  if (params.deviceType === "kiosco_sucursal") {
    if (params.activeKioskCount >= params.maxDispositivos) {
      return {
        allowed: false,
        error: `PLAN_LIMIT_DEVICES: Alcanzaste el límite de ${params.maxDispositivos} dispositivo(s) físico(s) de tu plan.`,
      };
    }
    return { allowed: true };
  }

  if (params.activePersonalMobileCount >= params.maxEmpleados) {
    return {
      allowed: false,
      error: `PLAN_LIMIT_MOBILE_DEVICES: Alcanzaste el límite de ${params.maxEmpleados} dispositivo(s) personal(es) de tu plan.`,
    };
  }

  return { allowed: true };
}

/**
 * Filtra los colaboradores activos disponibles para asignarles un dispositivo móvil personal.
 * Excluye a cualquier colaborador que ya tenga un dispositivo móvil personal activo
 * (vinculado o pendiente de PIN).
 */
export function filterAvailableEmployeesForPersonalMobile<
  T extends { id: string; activo?: boolean },
>(
  employees: readonly T[],
  devices: readonly { activo: boolean; tipo: string; empleadoId: string | null }[]
): T[] {
  const occupiedIds = new Set<string>();
  for (const device of devices) {
    if (
      device.activo === true &&
      device.tipo === "dispositivo_personal_movil" &&
      device.empleadoId
    ) {
      occupiedIds.add(device.empleadoId);
    }
  }

  return employees.filter(
    (emp) => emp.activo !== false && !occupiedIds.has(emp.id)
  );
}
