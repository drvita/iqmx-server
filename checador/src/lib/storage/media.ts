import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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

const ALLOWED_DOC_EXTS = new Set(["pdf", "jpg", "jpeg", "png"]);
export const MAX_EMPLOYEE_DOC_BYTES = 5 * 1024 * 1024; // 5 MB

export async function saveEmployeeDocument(
  orgId: string,
  empleadoId: string,
  docId: string,
  ext: string,
  buffer: Buffer
): Promise<string | null> {
  const cleanOrg = sanitizeSegment(orgId);
  const cleanEmp = sanitizeSegment(empleadoId);
  const cleanDoc = sanitizeSegment(docId);
  const cleanExt = sanitizeSegment(ext).toLowerCase();

  if (
    !cleanOrg ||
    !cleanEmp ||
    !cleanDoc ||
    !ALLOWED_DOC_EXTS.has(cleanExt) ||
    buffer.length === 0 ||
    buffer.length > MAX_EMPLOYEE_DOC_BYTES
  ) {
    return null;
  }

  const relativeKey = `${cleanOrg}/docs/${cleanEmp}/${cleanDoc}.${cleanExt}`;
  const targetDir = path.join(getMediaStorageDir(), cleanOrg, "docs", cleanEmp);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, `${cleanDoc}.${cleanExt}`), buffer);
  return relativeKey;
}

export async function readEmployeeDocument(
  orgId: string,
  relativeKey: string
): Promise<Buffer | null> {
  const cleanOrg = sanitizeSegment(orgId);
  const parts = relativeKey.split("/").map(sanitizeSegment).filter(Boolean);
  const [orgSeg, docsSeg, empSeg, fileSeg] = parts;
  if (!orgSeg || docsSeg !== "docs" || !empSeg || !fileSeg || orgSeg !== cleanOrg) {
    return null;
  }
  try {
    const filePath = path.join(getMediaStorageDir(), orgSeg, "docs", empSeg, fileSeg);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

export async function deleteEmployeeDocumentFile(
  orgId: string,
  relativeKey: string
): Promise<void> {
  const cleanOrg = sanitizeSegment(orgId);
  const parts = relativeKey.split("/").map(sanitizeSegment).filter(Boolean);
  const [orgSeg, docsSeg, empSeg, fileSeg] = parts;
  if (!orgSeg || docsSeg !== "docs" || !empSeg || !fileSeg || orgSeg !== cleanOrg) {
    return;
  }
  try {
    const filePath = path.join(getMediaStorageDir(), orgSeg, "docs", empSeg, fileSeg);
    await unlink(filePath);
  } catch {
    // Ignorar si ya no existe en disco
  }
}
