import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  deleteEmployeeDocumentFile,
  saveEmployeeDocument,
} from "@/lib/storage/media";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

export async function listEmployeeDocuments(orgId: string, empleadoId: string) {
  const db = getDb();
  return db
    .select({
      id: schema.empleadoDocumentos.id,
      empleadoId: schema.empleadoDocumentos.empleadoId,
      nombreArchivo: schema.empleadoDocumentos.nombreArchivo,
      tipoDocumento: schema.empleadoDocumentos.tipoDocumento,
      mimeType: schema.empleadoDocumentos.mimeType,
      tamanoBytes: schema.empleadoDocumentos.tamanoBytes,
      subidoPorNombre: schema.usuarios.nombre,
      createdAt: schema.empleadoDocumentos.createdAt,
    })
    .from(schema.empleadoDocumentos)
    .leftJoin(
      schema.usuarios,
      eq(schema.empleadoDocumentos.subidoPor, schema.usuarios.id)
    )
    .where(
      and(
        eq(schema.empleadoDocumentos.orgId, orgId),
        eq(schema.empleadoDocumentos.empleadoId, empleadoId)
      )
    )
    .orderBy(desc(schema.empleadoDocumentos.createdAt));
}

export async function createEmployeeDocument(params: {
  orgId: string;
  actorUserId: string;
  empleadoId: string;
  nombreArchivo: string;
  tipoDocumento: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const ext = ALLOWED_MIME_TO_EXT[params.mimeType.toLowerCase()];
  if (!ext) {
    throw new Error("Solo se permiten archivos PDF, JPG o PNG.");
  }

  const db = getDb();
  const [emp] = await db
    .select({ id: schema.empleados.id })
    .from(schema.empleados)
    .where(
      and(
        eq(schema.empleados.id, params.empleadoId),
        eq(schema.empleados.orgId, params.orgId)
      )
    )
    .limit(1);

  if (!emp) {
    throw new Error("Colaborador no encontrado en tu organización.");
  }

  const docId = crypto.randomUUID();
  const storageKey = await saveEmployeeDocument(
    params.orgId,
    params.empleadoId,
    docId,
    ext,
    params.buffer
  );
  if (!storageKey) {
    throw new Error("El archivo excede el tamaño máximo permitido (5 MB) o es inválido.");
  }

  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(schema.empleadoDocumentos)
      .values({
        id: docId,
        orgId: params.orgId,
        empleadoId: params.empleadoId,
        nombreArchivo: params.nombreArchivo.slice(0, 200),
        tipoDocumento: params.tipoDocumento.slice(0, 60) || "otro",
        mimeType: params.mimeType,
        tamanoBytes: params.buffer.length,
        storageKey,
        subidoPor: params.actorUserId,
      })
      .returning();

    await tx.insert(schema.auditLogs).values({
      orgId: params.orgId,
      usuarioId: params.actorUserId,
      accion: "DOCUMENTO_EMPLEADO_SUBIDO",
      entidad: "empleado_documentos",
      entidadId: docId,
      detalle: {
        empleadoId: params.empleadoId,
        nombreArchivo: params.nombreArchivo,
        tipoDocumento: params.tipoDocumento,
      },
    });

    return rows;
  });

  return created;
}

export async function getEmployeeDocumentById(
  orgId: string,
  empleadoId: string,
  docId: string
) {
  const db = getDb();
  const [doc] = await db
    .select()
    .from(schema.empleadoDocumentos)
    .where(
      and(
        eq(schema.empleadoDocumentos.id, docId),
        eq(schema.empleadoDocumentos.empleadoId, empleadoId),
        eq(schema.empleadoDocumentos.orgId, orgId)
      )
    )
    .limit(1);

  return doc ?? null;
}

export async function deleteEmployeeDocument(
  orgId: string,
  actorUserId: string,
  empleadoId: string,
  docId: string
) {
  const existing = await getEmployeeDocumentById(orgId, empleadoId, docId);
  if (!existing) return null;

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.empleadoDocumentos)
      .where(
        and(
          eq(schema.empleadoDocumentos.id, docId),
          eq(schema.empleadoDocumentos.orgId, orgId)
        )
      );

    await tx.insert(schema.auditLogs).values({
      orgId,
      usuarioId: actorUserId,
      accion: "DOCUMENTO_EMPLEADO_ELIMINADO",
      entidad: "empleado_documentos",
      entidadId: docId,
      detalle: {
        empleadoId,
        nombreArchivo: existing.nombreArchivo,
      },
    });
  });

  await deleteEmployeeDocumentFile(orgId, existing.storageKey);
  return { id: docId };
}
