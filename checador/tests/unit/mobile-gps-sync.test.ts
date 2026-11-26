import { describe, expect, it } from "vitest";
import { evaluateGeolocationResult } from "@/lib/pwa-gps/geolocation";
import { buildPersonalMobileDeviceName } from "@/services/admin/devices";
import {
  buildGoogleMapsUrl,
  classifyGpsIncidence,
  filterEmployeesForDevice,
  type SyncEmployeeRow,
} from "@/services/sync/gps-incidence";

describe("módulo móvil personal 1:1 y GPS no bloqueante", () => {
  it("no genera incidencia en kiosco_sucursal sin coordenadas GPS", () => {
    const res = classifyGpsIncidence({
      deviceType: "kiosco_sucursal",
      latitud: null,
      longitud: null,
      precisionGps: null,
    });
    expect(res.incidenciaUbicacion).toBeNull();
    expect(res.incidenciaEstado).toBeNull();
  });

  it("clasifica ausencia de GPS en móvil personal como sin_gps o ubicacion_pendiente con incidencia abierta", () => {
    const denied = classifyGpsIncidence({
      deviceType: "dispositivo_personal_movil",
      latitud: null,
      longitud: null,
      precisionGps: null,
      clientIncidence: "sin_gps",
    });
    expect(denied.incidenciaUbicacion).toBe("sin_gps");
    expect(denied.incidenciaEstado).toBe("abierta");

    const pending = classifyGpsIncidence({
      deviceType: "dispositivo_personal_movil",
      latitud: null,
      longitud: null,
      precisionGps: null,
      clientIncidence: "ubicacion_pendiente",
    });
    expect(pending.incidenciaUbicacion).toBe("ubicacion_pendiente");
    expect(pending.incidenciaEstado).toBe("abierta");
  });

  it("marca precision_baja cuando precisionGps supera 100 m y acepta coordenadas válidas <= 100 m", () => {
    const low = classifyGpsIncidence({
      deviceType: "dispositivo_personal_movil",
      latitud: 20.6767,
      longitud: -103.3475,
      precisionGps: 145,
    });
    expect(low.latitud).toBe("20.6767000");
    expect(low.longitud).toBe("-103.3475000");
    expect(low.incidenciaUbicacion).toBe("precision_baja");
    expect(low.incidenciaEstado).toBe("abierta");

    const good = classifyGpsIncidence({
      deviceType: "dispositivo_personal_movil",
      latitud: 20.6767,
      longitud: -103.3475,
      precisionGps: 18.4,
    });
    expect(good.incidenciaUbicacion).toBeNull();
    expect(good.incidenciaEstado).toBeNull();
  });

  it("abre incidencia ante ubicación simulada o desfase de reloj > 120 s", () => {
    const mock = classifyGpsIncidence({
      deviceType: "dispositivo_personal_movil",
      latitud: 20.6767,
      longitud: -103.3475,
      precisionGps: 12,
      isMockLocation: true,
    });
    expect(mock.isMockLocation).toBe(true);
    expect(mock.incidenciaEstado).toBe("abierta");

    const skew = classifyGpsIncidence({
      deviceType: "dispositivo_personal_movil",
      latitud: 20.6767,
      longitud: -103.3475,
      precisionGps: 12,
      desfaseRelojSeg: 240,
    });
    expect(skew.incidenciaEstado).toBe("abierta");
  });

  it("no abre incidencia operativa cuando el intento biométrico fue rechazado", () => {
    const rejected = classifyGpsIncidence({
      deviceType: "dispositivo_personal_movil",
      estado: "rechazado_desconocido",
      latitud: null,
      longitud: null,
      precisionGps: null,
    });
    expect(rejected.incidenciaUbicacion).toBeNull();
    expect(rejected.incidenciaEstado).toBeNull();
  });

  it("construye enlaces válidos de Google Maps y descarta coordenadas inválidas", () => {
    expect(buildGoogleMapsUrl("20.6767000", "-103.3475000")).toBe(
      "https://www.google.com/maps?q=20.6767,-103.3475"
    );
    expect(buildGoogleMapsUrl(null, "-103.3475")).toBeNull();
    expect(buildGoogleMapsUrl(999, -103.3475)).toBeNull();
  });

  it("aplica minimización 1:1 en sync/employees y purga vector si el empleado causa baja", () => {
    const roster: SyncEmployeeRow[] = [
      {
        id: "emp-1",
        nombreCompleto: "Carlos Ruta",
        codigoInterno: "001",
        puesto: "Vendedor",
        horarioId: null,
        activo: true,
      },
      {
        id: "emp-2",
        nombreCompleto: "Ana CEDIS",
        codigoInterno: "002",
        puesto: "Almacén",
        horarioId: null,
        activo: true,
      },
      {
        id: "emp-3",
        nombreCompleto: "Luis Baja",
        codigoInterno: "003",
        puesto: "Chofer",
        horarioId: null,
        activo: false,
      },
    ];

    const mobileActive = filterEmployeesForDevice(
      { tipo: "dispositivo_personal_movil", empleadoId: "emp-1" },
      roster
    );
    expect(mobileActive.activeEmployees.map((e) => e.id)).toEqual(["emp-1"]);
    expect(mobileActive.deletedIds).toEqual([]);
    expect(mobileActive.isAssignedActive).toBe(true);

    const mobileInactive = filterEmployeesForDevice(
      { tipo: "dispositivo_personal_movil", empleadoId: "emp-3" },
      roster
    );
    expect(mobileInactive.activeEmployees).toEqual([]);
    expect(mobileInactive.deletedIds).toEqual(["emp-3"]);
    expect(mobileInactive.isAssignedActive).toBe(false);
  });

  it("traduce errores de Geolocation API sin bloquear al colaborador", () => {
    const denied = evaluateGeolocationResult({ ok: false, errorCode: 1 });
    expect(denied.permissionDenied).toBe(true);
    expect(denied.incidenciaUbicacion).toBe("sin_gps");

    const timeout = evaluateGeolocationResult({ ok: false, errorCode: 3 });
    expect(timeout.permissionDenied).toBe(false);
    expect(timeout.incidenciaUbicacion).toBe("ubicacion_pendiente");

    const accurate = evaluateGeolocationResult({
      ok: true,
      latitude: 20.67,
      longitude: -103.34,
      accuracy: 25,
    });
    expect(accurate.incidenciaUbicacion).toBeNull();
  });

  it("genera el nombre automático para dispositivo personal móvil con primer nombre y 4 dígitos", () => {
    expect(buildPersonalMobileDeviceName("José Ángel Ramírez", "4821")).toBe(
      "dispositivo_jose_4821"
    );
    expect(buildPersonalMobileDeviceName("María López", "1099")).toBe(
      "dispositivo_maria_1099"
    );
    expect(buildPersonalMobileDeviceName("   ")).toMatch(
      /^dispositivo_colaborador_\d{4}$/
    );
  });
});
