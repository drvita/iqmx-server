import { NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/auth/session";
import { readCloudEvidenceJpeg } from "@/lib/storage/media";

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  const session = await getSessionOrNull();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { key } = await context.params;
  const relativeKey = (key ?? []).join("/");
  const buf = await readCloudEvidenceJpeg(session.orgId, relativeKey);
  if (!buf) {
    return NextResponse.json(
      { error: "Evidencia no encontrada" },
      { status: 404 }
    );
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
