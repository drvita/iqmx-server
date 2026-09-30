/**
 * Catálogo estándar de zonas horarias recomendadas para México, España y Latinoamérica.
 */
export const COMMON_TIMEZONES = [
  // México
  { id: "America/Mexico_City", label: "Ciudad de México / Centro (UTC-6)", country: "México" },
  { id: "America/Monterrey", label: "Monterrey / Noreste (UTC-6)", country: "México" },
  { id: "America/Guadalajara", label: "Guadalajara / Occidente (UTC-6)", country: "México" },
  { id: "America/Cancun", label: "Cancún / Quintana Roo (UTC-5)", country: "México" },
  { id: "America/Tijuana", label: "Tijuana / Baja California (UTC-8)", country: "México" },
  { id: "America/Hermosillo", label: "Hermosillo / Sonora (UTC-7)", country: "México" },
  { id: "America/Chihuahua", label: "Chihuahua / Juárez (UTC-6)", country: "México" },
  { id: "America/Mazatlan", label: "Mazatlán / Pacífico (UTC-7)", country: "México" },
  { id: "America/Merida", label: "Mérida / Yucatán (UTC-6)", country: "México" },

  // España
  { id: "Europe/Madrid", label: "Madrid / Península y Baleares (UTC+1/+2)", country: "España" },
  { id: "Atlantic/Canary", label: "Islas Canarias (UTC+0/+1)", country: "España" },

  // Latinoamérica
  { id: "America/Bogota", label: "Bogotá, Colombia (UTC-5)", country: "Colombia" },
  { id: "America/Lima", label: "Lima, Perú (UTC-5)", country: "Perú" },
  { id: "America/Santiago", label: "Santiago, Chile (UTC-4/-3)", country: "Chile" },
  { id: "America/Argentina/Buenos_Aires", label: "Buenos Aires, Argentina (UTC-3)", country: "Argentina" },
  { id: "America/Montevideo", label: "Montevideo, Uruguay (UTC-3)", country: "Uruguay" },
  { id: "America/Caracas", label: "Caracas, Venezuela (UTC-4)", country: "Venezuela" },
  { id: "America/Guayaquil", label: "Guayaquil / Quito, Ecuador (UTC-5)", country: "Ecuador" },
  { id: "America/La_Paz", label: "La Paz, Bolivia (UTC-4)", country: "Bolivia" },
  { id: "America/Asuncion", label: "Asunción, Paraguay (UTC-4/-3)", country: "Paraguay" },
  { id: "America/Guatemala", label: "Guatemala (UTC-6)", country: "Centroamérica" },
  { id: "America/Costa_Rica", label: "San José, Costa Rica (UTC-6)", country: "Centroamérica" },
  { id: "America/Panama", label: "Panamá (UTC-5)", country: "Centroamérica" },
  { id: "America/El_Salvador", label: "San Salvador, El Salvador (UTC-6)", country: "Centroamérica" },
  { id: "America/Tegucigalpa", label: "Tegucigalpa, Honduras (UTC-6)", country: "Centroamérica" },
  { id: "America/Managua", label: "Managua, Nicaragua (UTC-6)", country: "Centroamérica" },
  { id: "America/Santo_Domingo", label: "Santo Domingo, Rep. Dominicana (UTC-4)", country: "Caribe" },
  { id: "America/Puerto_Rico", label: "San Juan, Puerto Rico (UTC-4)", country: "Caribe" },
  { id: "America/Sao_Paulo", label: "São Paulo, Brasil (UTC-3)", country: "Brasil" },
] as const;

/**
 * Valida si la zona horaria es IANA válida (usando Intl).
 */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Construye el bloque de contexto temporal en español para inyectar al System Prompt.
 */
export function buildTemporalContext(tz: string, now: Date = new Date()): string {
  const safeTz = isValidTimeZone(tz) ? tz : "America/Mexico_City";

  const weekday = new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: safeTz }).format(now);
  const dateStr = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: safeTz,
  }).format(now);

  const time24 = new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: safeTz,
  }).format(now);

  const time12 = new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: safeTz,
  }).format(now);

  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return [
    "CONTEXTO TEMPORAL ACTUAL DEL NEGOCIO:",
    `- Día de la semana: ${capitalizedWeekday}`,
    `- Fecha: ${dateStr}`,
    `- Hora local actual: ${time24} hrs (${time12})`,
    `- Zona horaria: ${safeTz}`,
    "Regla operativa: Usa este momento actual como tu referencia absoluta para evaluar horarios de atención, disponibilidad, si hoy o mañana es día hábil/laboral y cualquier regla de días u horas.",
  ].join("\n");
}
