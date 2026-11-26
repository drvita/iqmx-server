export type DeviceType = "kiosco_sucursal" | "dispositivo_personal_movil";

export type GpsIncidenceType =
  | "sin_gps"
  | "precision_baja"
  | "ubicacion_pendiente"
  | "fuera_geocerca";

export type IncidenceResolutionStatus = "abierta" | "justificada" | "resuelta";

export const GPS_LOW_ACCURACY_THRESHOLD_METERS = 100;

export interface ClassifyGpsInput {
  deviceType: DeviceType;
  estado?: "valido" | "rechazado_spoof" | "rechazado_desconocido";
  latitud: number | null | undefined;
  longitud: number | null | undefined;
  precisionGps: number | null | undefined;
  isMockLocation?: boolean;
  clientIncidence?: GpsIncidenceType | null;
  desfaseRelojSeg?: number | null;
}

export interface ClassifyGpsResult {
  latitud: string | null;
  longitud: string | null;
  precisionGps: number | null;
  isMockLocation: boolean;
  incidenciaUbicacion: GpsIncidenceType | null;
  incidenciaEstado: IncidenceResolutionStatus | null;
}

function isValidLat(lat: unknown): lat is number {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLng(lng: unknown): lng is number {
  return typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/**
 * Clasifica de forma no bloqueante las coordenadas GPS e incidencias de una checada.
 * - En `kiosco_sucursal`, la ausencia de GPS no genera incidencia.
 * - En `dispositivo_personal_movil`, la ausencia de coordenadas marca `sin_gps` o `ubicacion_pendiente`,
 *   y una precisión > 100 m marca `precision_baja`.
 */
export function classifyGpsIncidence(input: ClassifyGpsInput): ClassifyGpsResult {
  const hasValidCoords = isValidLat(input.latitud) && isValidLng(input.longitud);
  const latStr = hasValidCoords ? input.latitud!.toFixed(7) : null;
  const lngStr = hasValidCoords ? input.longitud!.toFixed(7) : null;
  const precision =
    typeof input.precisionGps === "number" &&
    Number.isFinite(input.precisionGps) &&
    input.precisionGps >= 0
      ? input.precisionGps
      : null;
  const isMock = Boolean(input.isMockLocation);

  if (input.estado && input.estado !== "valido") {
    return {
      latitud: latStr,
      longitud: lngStr,
      precisionGps: precision,
      isMockLocation: isMock,
      incidenciaUbicacion: null,
      incidenciaEstado: null,
    };
  }

  let incidenciaUbicacion: GpsIncidenceType | null = null;

  if (input.deviceType === "dispositivo_personal_movil") {
    if (!hasValidCoords) {
      incidenciaUbicacion =
        input.clientIncidence === "ubicacion_pendiente"
          ? "ubicacion_pendiente"
          : "sin_gps";
    } else if (precision !== null && precision > GPS_LOW_ACCURACY_THRESHOLD_METERS) {
      incidenciaUbicacion = "precision_baja";
    } else if (input.clientIncidence === "fuera_geocerca") {
      incidenciaUbicacion = "fuera_geocerca";
    }
  } else if (
    hasValidCoords &&
    precision !== null &&
    precision > GPS_LOW_ACCURACY_THRESHOLD_METERS
  ) {
    incidenciaUbicacion = "precision_baja";
  } else if (input.clientIncidence === "fuera_geocerca") {
    incidenciaUbicacion = "fuera_geocerca";
  }

  const hasClockAnomaly =
    typeof input.desfaseRelojSeg === "number" &&
    Math.abs(input.desfaseRelojSeg) > 120;

  const incidenciaEstado: IncidenceResolutionStatus | null =
    incidenciaUbicacion !== null || isMock || hasClockAnomaly
      ? "abierta"
      : null;

  return {
    latitud: latStr,
    longitud: lngStr,
    precisionGps: precision,
    isMockLocation: isMock,
    incidenciaUbicacion,
    incidenciaEstado,
  };
}

/**
 * Construye el enlace directo a Google Maps si las coordenadas son válidas.
 */
export function buildGoogleMapsUrl(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined
): string | null {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  const latNum = typeof lat === "number" ? lat : Number(lat);
  const lngNum = typeof lng === "number" ? lng : Number(lng);
  if (!isValidLat(latNum) || !isValidLng(lngNum)) {
    return null;
  }
  return `https://www.google.com/maps?q=${latNum},${lngNum}`;
}

export interface SyncEmployeeRow {
  id: string;
  nombreCompleto: string;
  codigoInterno: string | null;
  numeroEmpleado?: string | null;
  puesto: string | null;
  horarioId: string | null;
  activo: boolean;
}

/**
 * Aplica minimización de datos LFPDPPP para dispositivos móviles personales 1:1.
 * Si el colaborador vinculado fue dado de baja o no existe, fuerza su purga vía `deletedIds`.
 */
export function filterEmployeesForDevice<T extends SyncEmployeeRow>(
  device: { tipo: DeviceType; empleadoId: string | null },
  allEmployees: T[]
): { activeEmployees: T[]; deletedIds: string[]; isAssignedActive: boolean } {
  if (device.tipo !== "dispositivo_personal_movil") {
    return {
      activeEmployees: allEmployees.filter((e) => e.activo),
      deletedIds: allEmployees.filter((e) => !e.activo).map((e) => e.id),
      isAssignedActive: true,
    };
  }

  if (!device.empleadoId) {
    return {
      activeEmployees: [],
      deletedIds: [],
      isAssignedActive: false,
    };
  }

  const assigned = allEmployees.find((e) => e.id === device.empleadoId);
  if (!assigned || !assigned.activo) {
    return {
      activeEmployees: [],
      deletedIds: [device.empleadoId],
      isAssignedActive: false,
    };
  }

  return {
    activeEmployees: [assigned],
    deletedIds: [],
    isAssignedActive: true,
  };
}
