import { createHash, createHmac } from "node:crypto";

/**
 * 037 — Cliente S3-compatible mínimo para almacenamiento en la nube (AWS S3, R2, MinIO).
 * Firma SigV4 nativa con `node:crypto` sin SDK pesado.
 */

export type ConfigBucket = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

const SHA256_VACIO =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function codificarSegmento(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function marcasDeTiempo(ahora: Date): { amzDate: string; dia: string } {
  const amzDate = ahora.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate, dia: amzDate.slice(0, 8) };
}

export function firmarSolicitud(params: {
  cfg: ConfigBucket;
  metodo: "PUT" | "GET" | "DELETE" | "HEAD";
  llave: string;
  hashDelCuerpo: string;
  contentType?: string;
  ahora?: Date;
}): { url: string; headers: Record<string, string> } {
  const { cfg, metodo, llave, hashDelCuerpo, contentType } = params;
  const { amzDate, dia } = marcasDeTiempo(params.ahora ?? new Date());

  const host = new URL(cfg.endpoint).host;
  const ruta =
    "/" +
    codificarSegmento(cfg.bucket) +
    "/" +
    llave.split("/").map(codificarSegmento).join("/");

  const canonicas: Record<string, string> = {
    host,
    "x-amz-content-sha256": hashDelCuerpo,
    "x-amz-date": amzDate,
  };
  if (contentType) canonicas["content-type"] = contentType;

  const nombres = Object.keys(canonicas).sort();
  const bloqueCanonico =
    nombres.map((n) => `${n}:${(canonicas[n] ?? "").trim()}`).join("\n") +
    "\n";
  const firmadas = nombres.join(";");

  const solicitudCanonica = [
    metodo,
    ruta,
    "",
    bloqueCanonico,
    firmadas,
    hashDelCuerpo,
  ].join("\n");

  const alcance = `${dia}/${cfg.region}/s3/aws4_request`;
  const porFirmar = [
    "AWS4-HMAC-SHA256",
    amzDate,
    alcance,
    sha256Hex(solicitudCanonica),
  ].join("\n");

  const kFecha = hmac(`AWS4${cfg.secretAccessKey}`, dia);
  const kRegion = hmac(kFecha, cfg.region);
  const kServicio = hmac(kRegion, "s3");
  const kFirma = hmac(kServicio, "aws4_request");
  const firma = createHmac("sha256", kFirma).update(porFirmar, "utf8").digest("hex");

  return {
    url: `${cfg.endpoint.replace(/\/+$/, "")}${ruta}`,
    headers: {
      ...canonicas,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${alcance}, ` +
        `SignedHeaders=${firmadas}, Signature=${firma}`,
    },
  };
}

export const TIEMPO_LIMITE_MS = 15_000;

export class ErrorDeBucket extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.name = "ErrorDeBucket";
    this.status = status;
  }
}

export async function ponerObjeto(
  cfg: ConfigBucket,
  llave: string,
  cuerpo: Buffer,
  contentType?: string
): Promise<void> {
  const { url, headers } = firmarSolicitud({
    cfg,
    metodo: "PUT",
    llave,
    hashDelCuerpo: sha256Hex(cuerpo),
    contentType,
  });
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: new Uint8Array(cuerpo),
    signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
  });
  if (!res.ok) {
    throw new ErrorDeBucket(
      `PUT ${llave} → ${res.status}: ${(await res.text()).slice(0, 200)}`,
      res.status
    );
  }
}

export async function obtenerObjeto(
  cfg: ConfigBucket,
  llave: string
): Promise<Buffer | null> {
  const { url, headers } = firmarSolicitud({
    cfg,
    metodo: "GET",
    llave,
    hashDelCuerpo: SHA256_VACIO,
  });
  const res = await fetch(url, { method: "GET", headers, signal: AbortSignal.timeout(TIEMPO_LIMITE_MS) });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new ErrorDeBucket(
      `GET ${llave} → ${res.status}: ${(await res.text()).slice(0, 200)}`,
      res.status
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function borrarObjeto(cfg: ConfigBucket, llave: string): Promise<void> {
  const { url, headers } = firmarSolicitud({
    cfg,
    metodo: "DELETE",
    llave,
    hashDelCuerpo: SHA256_VACIO,
  });
  const res = await fetch(url, { method: "DELETE", headers, signal: AbortSignal.timeout(TIEMPO_LIMITE_MS) });
  if (!res.ok && res.status !== 404) {
    throw new ErrorDeBucket(`DELETE ${llave} → ${res.status}`, res.status);
  }
}
