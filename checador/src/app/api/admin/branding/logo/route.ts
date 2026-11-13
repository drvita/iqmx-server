import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getSessionOrNull } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const session = await getSessionOrNull();
  if (!session || session.rol !== "ORG_ADMIN") {
    return Response.json(
      { ok: false, error: "Solo el administrador principal puede subir el logo." },
      { status: session ? 403 : 401 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json(
        { ok: false, error: "Debes seleccionar una imagen válida." },
        { status: 400 }
      );
    }

    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      return Response.json(
        { ok: false, error: "Formato no soportado. Usa PNG, JPG o WEBP." },
        { status: 422 }
      );
    }

    if (file.size === 0 || file.size > MAX_LOGO_BYTES) {
      return Response.json(
        { ok: false, error: "La imagen debe pesar máximo 2 MB." },
        { status: 422 }
      );
    }

    const orgDir = path.join(process.cwd(), "storage", "logos", session.orgId);
    await fs.mkdir(orgDir, { recursive: true });

    // Limpiar logos previos de la organización para evitar archivos huérfanos
    const existingFiles = await fs.readdir(orgDir).catch(() => []);
    await Promise.all(
      existingFiles.map((entry) =>
        fs.unlink(path.join(orgDir, entry)).catch(() => undefined)
      )
    );

    const filename = `logo-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(orgDir, filename), buffer);

    const logoPath = `/api/branding/logo/${session.orgId}/${filename}`;
    const now = new Date();
    const db = getDb();

    await db
      .update(schema.organizaciones)
      .set({
        logoUrl: logoPath,
        brandingUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.organizaciones.id, session.orgId));

    await db.insert(schema.auditLogs).values({
      orgId: session.orgId,
      usuarioId: session.userId,
      accion: "BRANDING_LOGO_ACTUALIZADO",
      entidad: "organizaciones",
      entidadId: session.orgId,
      detalle: { logoPath, bytes: file.size, mimeType: file.type },
    });

    return Response.json({ ok: true, logoUrl: logoPath });
  } catch (err) {
    console.error("[checador/branding/logo]", err);
    return Response.json(
      { ok: false, error: "Error interno al guardar el logo." },
      { status: 500 }
    );
  }
}
