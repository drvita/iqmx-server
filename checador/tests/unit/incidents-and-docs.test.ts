import { describe, expect, it } from "vitest";
import { validateIncidentResolutionInput } from "@/services/admin/incidents";
import {
  buildCheckInsDetailCsv,
  buildUnifiedAttendanceCsv,
} from "@/services/reports/attendance-compliance";

describe("resolución de incidencias RH y exportación detalle GPS", () => {
  it("valida estado y motivo obligatorio al resolver incidencias", () => {
    expect(
      validateIncidentResolutionInput({
        estado: "invalido",
        motivo: "Motivo válido",
      }).ok
    ).toBe(false);

    expect(
      validateIncidentResolutionInput({
        estado: "justificada",
        motivo: "ok",
      }).ok
    ).toBe(false);

    const valid = validateIncidentResolutionInput({
      estado: "justificada",
      motivo: "  Visita en bodega sin señal GPS  ",
    });
    expect(valid).toEqual({
      ok: true,
      estado: "justificada",
      motivo: "Visita en bodega sin señal GPS",
    });
  });

  it("genera CSV detallado con columnas GPS, incidencias y enlace a Google Maps", () => {
    const csv = buildCheckInsDetailCsv(
      [
        {
          timestampLocalIso: "2026-11-25T14:30:00.000Z",
          codigoInterno: "V-01",
          empleadoNombre: "Carlos Mendoza",
          sucursalNombre: "CEDIS Matriz",
          dispositivoNombre: "Celular Ruta Norte",
          dispositivoTipo: "dispositivo_personal_movil",
          tipo: "entrada",
          estado: "valido",
          latitud: "20.6767000",
          longitud: "-103.3475000",
          precisionGps: 18.4,
          incidenciaUbicacion: null,
          incidenciaEstado: null,
          incidenciaMotivo: null,
          googleMapsUrl: "https://www.google.com/maps?q=20.6767,-103.3475",
        },
        {
          timestampLocalIso: "2026-11-25T15:00:00.000Z",
          codigoInterno: "V-02",
          empleadoNombre: "Laura Pérez",
          sucursalNombre: "CEDIS Matriz",
          dispositivoNombre: "Celular Ruta Sur",
          dispositivoTipo: "dispositivo_personal_movil",
          tipo: "entrada",
          estado: "valido",
          latitud: null,
          longitud: null,
          precisionGps: null,
          incidenciaUbicacion: "sin_gps",
          incidenciaEstado: "justificada",
          incidenciaMotivo: "Permiso pendiente en equipo nuevo",
          googleMapsUrl: null,
        },
      ],
      "America/Mexico_City"
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Latitud,Longitud,Precisión GPS (m),Incidencia GPS,Estado Incidencia,Motivo Resolución,Google Maps");
    expect(csv).toContain("Móvil Personal");
    expect(csv).toContain("https://www.google.com/maps?q=20.6767,-103.3475");
    expect(csv).toContain("sin_gps,justificada,Permiso pendiente en equipo nuevo");
  });

  it("unifica resumen semanal y detalle GPS en un solo CSV con BOM UTF-8", () => {
    const unified = buildUnifiedAttendanceCsv(
      [
        {
          empleadoId: "emp-1",
          codigoInterno: "V-01",
          nombreCompleto: "Carlos Mendoza",
          puesto: "Vendedor",
          workedMinutes: 2400,
          workedHours: 40,
          maxHours: 46,
          daysComplete: 5,
          daysRequireCorrection: 0,
          hasInProgressToday: false,
          tardies: 0,
          weeklyStatus: "normal",
        },
      ],
      [
        {
          timestampLocalIso: "2026-11-25T14:30:00.000Z",
          codigoInterno: "V-01",
          empleadoNombre: "Carlos Mendoza",
          sucursalNombre: "En campo",
          dispositivoNombre: "dispositivo_carlos_4821",
          dispositivoTipo: "dispositivo_personal_movil",
          tipo: "entrada",
          estado: "valido",
          latitud: "20.6767000",
          longitud: "-103.3475000",
          precisionGps: 15,
          incidenciaUbicacion: null,
          incidenciaEstado: null,
          incidenciaMotivo: null,
          googleMapsUrl: "https://www.google.com/maps?q=20.6767,-103.3475",
        },
      ],
      "2026-11-23",
      "America/Mexico_City"
    );

    expect(unified.startsWith("\uFEFFSemana,Código,Colaborador")).toBe(true);
    expect(unified).toContain("Carlos Mendoza");
    expect(unified).toContain("Google Maps");
    expect(unified).toContain("https://www.google.com/maps?q=20.6767,-103.3475");
  });
});
