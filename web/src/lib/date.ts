/**
 * Parsea fechas ISO-8601 devueltas por la API.
 * Si la cadena viene sin sufijo 'Z' ni offset (+/-HH:MM), asume UTC defensivamente.
 */
export function parseApiDate(iso: string): Date {
  const trimmed = iso.trim();
  const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed);
  return new Date(hasZone ? trimmed : `${trimmed}Z`);
}

/**
 * Formatea una fecha UTC de la API a la zona horaria local del navegador (o a una zona explícita futura).
 */
export function formatLocalDateTime(
  iso: string | null | undefined,
  timeZone?: string
): string {
  if (!iso) return '—';
  const date = parseApiDate(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatLocalTime(date: Date, timeZone?: string): string {
  return date.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
}
