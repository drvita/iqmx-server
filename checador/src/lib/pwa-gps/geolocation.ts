import type { GpsIncidenceType } from "@/services/sync/gps-incidence";

export interface CapturedLocation {
  latitud: number | null;
  longitud: number | null;
  precisionGps: number | null;
  isMockLocation: boolean;
  incidenciaUbicacion: GpsIncidenceType | null;
  permissionDenied: boolean;
  message: string | null;
}

export const GPS_ACCURACY_WARN_METERS = 100;

/**
 * Función pura que traduce el resultado o error de Geolocation API en una
 * estructura no bloqueante con su incidencia correspondiente.
 */
export function evaluateGeolocationResult(input: {
  ok: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  errorCode?: number; // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
}): CapturedLocation {
  if (
    input.ok &&
    typeof input.latitude === "number" &&
    Number.isFinite(input.latitude) &&
    typeof input.longitude === "number" &&
    Number.isFinite(input.longitude)
  ) {
    const accuracy =
      typeof input.accuracy === "number" && Number.isFinite(input.accuracy)
        ? input.accuracy
        : null;
    const lowAccuracy = accuracy !== null && accuracy > GPS_ACCURACY_WARN_METERS;
    return {
      latitud: input.latitude,
      longitud: input.longitude,
      precisionGps: accuracy,
      isMockLocation: false,
      incidenciaUbicacion: lowAccuracy ? "precision_baja" : null,
      permissionDenied: false,
      message: lowAccuracy
        ? `Ubicación registrada con precisión aproximada (±${Math.round(accuracy!)} m).`
        : null,
    };
  }

  if (input.errorCode === 1) {
    return {
      latitud: null,
      longitud: null,
      precisionGps: null,
      isMockLocation: false,
      incidenciaUbicacion: "sin_gps",
      permissionDenied: true,
      message:
        "Activa el permiso de ubicación en tu navegador para evitar incidencias en Recursos Humanos.",
    };
  }

  return {
    latitud: null,
    longitud: null,
    precisionGps: null,
    isMockLocation: false,
    incidenciaUbicacion: "ubicacion_pendiente",
    permissionDenied: false,
    message:
      "Señal GPS débil o en espera; el movimiento se guardará para revisión.",
  };
}

/**
 * Captura puntual de ubicación al momento de checar (nunca rastreo continuo).
 * No bloquea el registro si el usuario niega permiso o si hay timeout en interiores.
 */
export function captureCurrentLocation(
  timeoutMs: number = 8000
): Promise<CapturedLocation> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(evaluateGeolocationResult({ ok: false, errorCode: 2 }));
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve(
          evaluateGeolocationResult({
            ok: true,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
        );
      },
      (err) => {
        resolve(
          evaluateGeolocationResult({
            ok: false,
            errorCode: err.code,
          })
        );
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 15_000,
      }
    );
  });
}
