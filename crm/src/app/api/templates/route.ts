import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import {
  createTemplate,
  serializeTemplate,
  TemplateError,
  templateErrorStatus,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session, req: Request) => {
  const url = new URL(req.url);
  const phoneNumberId = url.searchParams.get("phoneNumberId")?.trim() || null;

  const db = getDb();
  const conditions = [scoped(schema.template.organizationId, session.organizationId)];
  if (phoneNumberId) {
    conditions.push(eq(schema.template.phoneNumberId, phoneNumberId));
  }

  const templates = await db
    .select()
    .from(schema.template)
    .where(and(...conditions))
    .orderBy(desc(schema.template.createdAt));

  return Response.json({ templates: templates.map(serializeTemplate) });
});

const createSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Debes seleccionar la línea de WhatsApp"),
  name: z.string().trim().min(1).max(60),
  language: z.string().trim().min(2).max(10),
  category: z.enum(["UTILITY", "MARKETING"]),
  body: z.string().trim().min(1).max(1024),
});

export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  try {
    const template = await createTemplate(session.organizationId, body.data);
    return Response.json(
      { template: serializeTemplate(template) },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof TemplateError) {
      return apiError(templateErrorStatus(err), err.code, err.message);
    }
    throw err;
  }
});
