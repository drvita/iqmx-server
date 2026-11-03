import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";
import {
  borrarObjeto,
  obtenerObjeto,
  ponerObjeto,
  type ConfigBucket,
} from "@/lib/storage/objetos";
import { getBucketConfigForOrg } from "@/server/storage/credentials";

function comprobarSegmento(s: string): void {
  if (!/^[\w.-]+$/.test(s)) throw new Error(`segmento de ruta inválido: ${s}`);
}

export function llaveDeMedia(organizationId: string, assetId: string): string {
  comprobarSegmento(organizationId);
  comprobarSegmento(assetId);
  return `${organizationId}/${assetId}`;
}

export function rutaEnDisco(organizationId: string, assetId: string): string {
  comprobarSegmento(organizationId);
  comprobarSegmento(assetId);
  return path.join(getEnv().MEDIA_DIR, organizationId, assetId);
}

async function escribirEnDisco(organizationId: string, assetId: string, buf: Buffer): Promise<void> {
  const file = rutaEnDisco(organizationId, assetId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
}

async function leerDeDisco(organizationId: string, assetId: string): Promise<Buffer | null> {
  try {
    return await readFile(rutaEnDisco(organizationId, assetId));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function borrarDeDisco(organizationId: string, assetId: string): Promise<void> {
  try {
    await rm(rutaEnDisco(organizationId, assetId), { force: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/**
 * Guarda el archivo multimedia:
 * Si la organización tiene S3/R2 configurado y activo, intenta escribir en el bucket.
 * Si falla el bucket o no está configurado, GUARDA EN DISCO LOCAL automáticamente.
 */
export async function guardarMedio(
  organizationId: string,
  assetId: string,
  buf: Buffer,
  contentType?: string
): Promise<{ ruta: string; store: "disco" | "bucket" }> {
  const rel = llaveDeMedia(organizationId, assetId);
  const cfg = await getBucketConfigForOrg(organizationId);

  if (cfg) {
    try {
      await ponerObjeto(cfg, rel, buf, contentType);
      return { ruta: rel, store: "bucket" };
    } catch (err) {
      console.warn(
        `[storage] error al subir a bucket S3 para org ${organizationId}: ${err instanceof Error ? err.message : err}. Guardando copia en disco local.`
      );
      await escribirEnDisco(organizationId, assetId, buf);
      return { ruta: rel, store: "disco" };
    }
  }

  await escribirEnDisco(organizationId, assetId, buf);
  return { ruta: rel, store: "disco" };
}

/**
 * Lee el archivo multimedia:
 * Busca primero en disco local o en bucket según esté configurado;
 * si no lo encuentra en el primero, consulta el segundo.
 */
export async function leerMedio(
  organizationId: string,
  assetId: string
): Promise<Buffer | null> {
  const rel = llaveDeMedia(organizationId, assetId);
  const cfg = await getBucketConfigForOrg(organizationId);

  if (cfg) {
    try {
      const b = await obtenerObjeto(cfg, rel);
      if (b) return b;
    } catch (err) {
      console.warn(`[storage] fallo al leer de bucket S3 para org ${organizationId}:`, err);
    }
    // Fallback a disco
    return leerDeDisco(organizationId, assetId);
  }

  const enDisco = await leerDeDisco(organizationId, assetId);
  return enDisco;
}

/** Borra el archivo tanto de disco como del bucket (si aplica). */
export async function borrarMedio(
  organizationId: string,
  assetId: string
): Promise<void> {
  const rel = llaveDeMedia(organizationId, assetId);
  const cfg = await getBucketConfigForOrg(organizationId);

  await borrarDeDisco(organizationId, assetId);
  if (cfg) {
    try {
      await borrarObjeto(cfg, rel);
    } catch (err) {
      console.warn(`[storage] error al borrar de bucket S3 para org ${organizationId}:`, err);
    }
  }
}
