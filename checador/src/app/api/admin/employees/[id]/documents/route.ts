import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionOrNull } from "@/lib/auth/session";
import { MAX_EMPLOYEE_DOC_BYTES } from "@/lib/storage/media";
import {
  createEmployeeDocument,
  listEmployeeDocuments,
} from "@/services/admin/employee-documents";

const WRITE_ROLES = new Set(["ORG_ADMIN", "RH_ASSISTANT"]);

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  const docs = await listEmployeeDocuments(session.orgId, id);
  return NextResponse.json({ ok: true, documents: docs });
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (!WRITE_ROLES.has(session.rol)) {
    return NextResponse.json({ error: "Sin permisos suficientes" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Identificador inválido" }, { status: 400 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Solicitud multipart inválida" }, { status: 400 });
  }

  const file = formData.get("file");
  const tipoDocumento = String(formData.get("tipoDocumento") ?? "otro").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Selecciona un archivo válido" }, { status: 400 });
  }

  if (file.size === 0 || file.size > MAX_EMPLOYEE_DOC_BYTES) {
    return NextResponse.json(
      { error: "El archivo debe pesar máximo 5 MB." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await createEmployeeDocument({
      orgId: session.orgId,
      actorUserId: session.userId,
      empleadoId: id,
      nombreArchivo: file.name || "documento",
      tipoDocumento: tipoDocumento || "otro",
      mimeType: file.type,
      buffer,
    });
    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "No se pudo guardar el documento.",
      },
      { status: 400 }
    );
  }
}
