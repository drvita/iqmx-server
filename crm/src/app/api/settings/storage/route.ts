import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import {
  getStorageCredentialsByOrg,
  saveStorageCredentials,
} from "@/server/storage/credentials";
import { ponerObjeto, obtenerObjeto, borrarObjeto } from "@/lib/storage/objetos";

export const dynamic = "force-dynamic";

/** GET /api/settings/storage */
export const GET = withAuth(async (session) => {
  if (!canConfigure(session.role)) {
    return apiError(403, "forbidden", "No tienes permisos para ver el almacenamiento");
  }
  const creds = await getStorageCredentialsByOrg(session.organizationId);
  if (!creds) {
    return Response.json({ configured: false });
  }
  return Response.json({
    configured: true,
    enabled: creds.enabled,
    endpoint: creds.endpoint,
    bucketName: creds.bucketName,
    region: creds.region,
    accessKeyId: creds.accessKeyId,
  });
});

const putSchema = z.object({
  enabled: z.boolean().default(true),
  endpoint: z.string().trim().min(1, "El endpoint es obligatorio"),
  bucketName: z.string().trim().min(1, "El nombre del bucket es obligatorio"),
  region: z.string().trim().default("auto"),
  accessKeyId: z.string().trim().min(1, "Access Key ID es obligatorio"),
  secretAccessKey: z.string().trim().optional(),
});

/** PUT /api/settings/storage */
export const PUT = withAuth(async (session, req: Request) => {
  if (!canConfigure(session.role)) {
    return apiError(403, "forbidden", "Solo administradores o propietarios pueden configurar almacenamiento");
  }
  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  const existing = await getStorageCredentialsByOrg(session.organizationId);
  const secret = body.data.secretAccessKey || existing?.secretAccessKey;
  if (!secret) {
    return apiError(422, "missing_secret", "Se requiere Secret Access Key");
  }

  // Prueba de escritura y lectura inmediata en el bucket antes de guardar
  const cfg = {
    endpoint: body.data.endpoint.replace(/\/+$/, ""),
    bucket: body.data.bucketName,
    region: body.data.region || "us-east-1",
    accessKeyId: body.data.accessKeyId,
    secretAccessKey: secret,
  };

  const testKey = `${session.organizationId}/_healthcheck.txt`;
  try {
    await ponerObjeto(cfg, testKey, Buffer.from("ok"), "text/plain");
    const testRead = await obtenerObjeto(cfg, testKey);
    if (!testRead || testRead.toString() !== "ok") {
      throw new Error("No se pudo leer el archivo de prueba recién subido.");
    }
    await borrarObjeto(cfg, testKey);
  } catch (err) {
    return apiError(
      422,
      "s3_connection_failed",
      `Error conectando al bucket S3: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  await saveStorageCredentials({
    organizationId: session.organizationId,
    enabled: body.data.enabled,
    endpoint: body.data.endpoint,
    bucketName: body.data.bucketName,
    region: body.data.region,
    accessKeyId: body.data.accessKeyId,
    secretAccessKey: body.data.secretAccessKey,
  });

  return Response.json({ ok: true });
});
