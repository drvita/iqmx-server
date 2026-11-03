/**
 * Quién puede CONFIGURAR la instancia o ejecutar acciones destructivas:
 * conectar número, IA, eliminar conversaciones/contactos, etc.
 * Roles con permiso: `owner` y `admin`.
 */
export function canConfigure(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
