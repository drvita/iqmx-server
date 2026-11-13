import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_DOCKER_MEDIA_DIR = "/data/media";

export function getMediaStorageDir(): string {
  return process.env.MEDIA_STORAGE_DIR?.trim() || DEFAULT_DOCKER_MEDIA_DIR;
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, "");
}

/**
 * Guarda una evidencia JPEG en almacenamiento persistente (`/data/media` en Docker/Coolify).
 * Retorna la llave relativa `<orgId>/<recordId>.jpg`.
 */
export async function saveCloudEvidenceJpeg(
  orgId: string,
  recordId: string,
  base64OrDataUrl: string
): Promise<string | null> {
  const cleanOrg = sanitizeSegment(orgId);
  const cleanId = sanitizeSegment(recordId);
  if (!cleanOrg || !cleanId) return null;

  const rawBase64 = base64OrDataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
  if (!rawBase64) return null;

  const buf = Buffer.from(rawBase64, "base64");
  if (buf.length === 0 || buf.length > 512 * 1024) {
    return null;
  }

  const relativeKey = `${cleanOrg}/${cleanId}.jpg`;
  const targetDir = path.join(getMediaStorageDir(), cleanOrg);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, `${cleanId}.jpg`), buf);
  return relativeKey;
}

export async function readCloudEvidenceJpeg(
  orgId: string,
  relativeKey: string
): Promise<Buffer | null> {
  const cleanOrg = sanitizeSegment(orgId);
  const parts = relativeKey.split("/").map(sanitizeSegment).filter(Boolean);
  const [orgSeg, fileSeg] = parts;
  if (!orgSeg || !fileSeg || orgSeg !== cleanOrg) {
    return null;
  }
  try {
    const filePath = path.join(getMediaStorageDir(), orgSeg, fileSeg);
    return await readFile(filePath);
  } catch {
    return null;
  }
}
