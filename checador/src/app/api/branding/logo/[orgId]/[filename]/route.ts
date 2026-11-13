import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_FILENAME_REGEX = /^logo-\d+-[0-9a-f]+\.(png|jpg|webp)$/;

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ orgId: string; filename: string }> }
) {
  const { orgId, filename } = await context.params;

  if (!UUID_REGEX.test(orgId) || !SAFE_FILENAME_REGEX.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  const filePath = path.join(process.cwd(), "storage", "logos", orgId, filename);
  const ext = path.extname(filename).slice(1).toLowerCase();
  const contentType = EXT_TO_MIME[ext] ?? "application/octet-stream";

  try {
    const data = await fs.readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
