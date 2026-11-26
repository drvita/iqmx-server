import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionOrNull } from "@/lib/auth/session";
import { readEmployeeDocument } from "@/lib/storage/media";
import {
  deleteEmployeeDocument,
  getEmployeeDocumentById,
} from "@/services/admin/employee-documents";

const WRITE_ROLES = new Set(["ORG_ADMIN", "RH_ASSISTANT"]);

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id, docId } = await context.params;
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(docId).success
  ) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  const doc = await getEmployeeDocumentById(session.orgId, id, docId);
  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  const buf = await readEmployeeDocument(session.orgId, doc.storageKey);
  if (!buf) {
    return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.nombreArchivo)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!WRITE_ROLES.has(session.rol)) {
    return NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
  }

  const { id, docId } = await context.params;
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(docId).success
  ) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  const deleted = await deleteEmployeeDocument(
    session.orgId,
    session.userId,
    id,
    docId
  );
  if (!deleted) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
