import Dexie, { type Table } from "dexie";
import type { CheckInStatus, CheckInType } from "@/lib/pwa-ml/biometric-pipeline";

export const LOCAL_THUMBNAIL_RETENTION_DAYS = 15;
export const SYNCED_META_RETENTION_DAYS = 7;
export const LOCAL_COOLDOWN_MS = 180_000; // 3 minutos
export const SYNC_STALE_WARNING_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Calcula SHA-256("${orgId}:${pin}") en el navegador para validar el PIN
 * de auditoría offline sin almacenar el PIN en texto plano.
 */
export async function hashAuditPinClient(
  orgId: string,
  pin: string
): Promise<string> {
  const data = new TextEncoder().encode(`${orgId}:${pin.trim()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface KioskDeviceConfig {
  id: "current";
  deviceToken: string;
  deviceId: string;
  deviceName: string;
  orgId: string;
  orgNombre: string;
  sucursalId: string;
  sucursalNombre: string;
  plataforma: "android" | "ios" | "web";
  logoUrl: string | null;
  logoBlob: Blob | null;
  colorPrimario: string;
  colorSecundario: string;
  mensajeBienvenida: string;
  cloudEvidencesEnabled: boolean;
  horasSemanalesMax: number;
  auditPinHash: string | null;
  lastValidTimestampMs: number;
  lastSyncAt: string;
}

export interface LocalEmployee {
  id: string;
  nombreCompleto: string;
  codigoInterno: string | null;
  puesto: string | null;
  horarioId: string | null;
  activo: boolean;
}

export interface LocalVector {
  id: string;
  empleadoId: string;
  embedding: number[];
}

export interface LocalAttendanceRecord {
  id: string;
  empleadoId: string | null;
  empleadoNombre: string | null;
  tipo: CheckInType;
  estado: CheckInStatus;
  similitud: number | null;
  livenessScore: number | null;
  evidenciaBlob: Blob | null;
  timestampLocal: number;
  relojAlterado: boolean;
  sincronizado: 0 | 1;
}

class ChecadorKioskDatabase extends Dexie {
  config_dispositivo!: Table<KioskDeviceConfig, "current">;
  empleados_locales!: Table<LocalEmployee, string>;
  vectores_locales!: Table<LocalVector, string>;
  checadas_locales!: Table<LocalAttendanceRecord, string>;

  constructor() {
    super("iqmx_checador_kiosk");
    this.version(1).stores({
      config_dispositivo: "id",
      empleados_locales: "id, activo",
      vectores_locales: "id, empleadoId",
      checadas_locales:
        "id, empleadoId, timestampLocal, sincronizado, estado",
    });
  }
}

let dbInstance: ChecadorKioskDatabase | null = null;

export function getKioskDb(): ChecadorKioskDatabase {
  if (!dbInstance) {
    dbInstance = new ChecadorKioskDatabase();
  }
  return dbInstance;
}

/**
 * Protege contra retroceso manual del reloj del sistema.
 * Permite hasta 60s de deriva normal NTP.
 */
export function detectClockTampering(
  nowMs: number,
  lastValidMs: number
): { tampered: boolean; reason?: string } {
  if (lastValidMs > 0 && nowMs + 60_000 < lastValidMs) {
    return {
      tampered: true,
      reason: "Se detectó un retroceso en el reloj del dispositivo.",
    };
  }
  return { tampered: false };
}

export async function checkLocalCooldown(
  empleadoId: string,
  nowMs: number,
  cooldownMs: number = LOCAL_COOLDOWN_MS
): Promise<{ blocked: boolean; remainingSeconds: number }> {
  const db = getKioskDb();
  const recent = await db.checadas_locales
    .where("empleadoId")
    .equals(empleadoId)
    .toArray();

  let latestValidMs = 0;
  for (const row of recent) {
    if (row.estado === "valido" && row.timestampLocal > latestValidMs) {
      latestValidMs = row.timestampLocal;
    }
  }

  if (latestValidMs > 0 && nowMs - latestValidMs < cooldownMs) {
    const remainingSeconds = Math.ceil(
      (cooldownMs - (nowMs - latestValidMs)) / 1000
    );
    return { blocked: true, remainingSeconds };
  }
  return { blocked: false, remainingSeconds: 0 };
}

/**
 * Purga registros locales vencidos según política LFPDPPP:
 * - Plan básico (`cloudEvidencesEnabled = false`): elimina registros > 15 días.
 * - Plan cloud (`cloudEvidencesEnabled = true`): elimina metadatos sincronizados > 7 días.
 */
export async function purgeExpiredLocalRecords(
  cloudEvidencesEnabled: boolean,
  nowMs: number = Date.now()
): Promise<number> {
  const db = getKioskDb();
  const maxAgeDays = cloudEvidencesEnabled
    ? SYNCED_META_RETENTION_DAYS
    : LOCAL_THUMBNAIL_RETENTION_DAYS;
  const cutoffMs = nowMs - maxAgeDays * 24 * 60 * 60 * 1000;

  const oldRecords = await db.checadas_locales
    .where("timestampLocal")
    .below(cutoffMs)
    .toArray();

  const idsToDelete = oldRecords
    .filter((r) => !cloudEvidencesEnabled || r.sincronizado === 1)
    .map((r) => r.id);

  if (idsToDelete.length > 0) {
    await db.checadas_locales.bulkDelete(idsToDelete);
  }
  return idsToDelete.length;
}

export function isSyncStale24h(
  lastSyncAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!lastSyncAt) return true;
  const parsed = Date.parse(lastSyncAt);
  if (Number.isNaN(parsed)) return true;
  return nowMs - parsed > SYNC_STALE_WARNING_MS;
}

export async function clearKioskLocalData(): Promise<void> {
  const db = getKioskDb();
  await db.transaction(
    "rw",
    [
      db.config_dispositivo,
      db.empleados_locales,
      db.vectores_locales,
      db.checadas_locales,
    ],
    async () => {
      await db.config_dispositivo.clear();
      await db.empleados_locales.clear();
      await db.vectores_locales.clear();
      await db.checadas_locales.clear();
    }
  );
}
