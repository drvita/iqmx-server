import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session, req: Request) => {
  const url = new URL(req.url);
  const assistantId = url.searchParams.get("assistantId");

  const db = getDb();
  const conditions = [scoped(schema.kbEntry.organizationId, session.organizationId)];
  if (assistantId) {
    conditions.push(eq(schema.kbEntry.assistantId, assistantId));
  }

  const entries = await db
    .select()
    .from(schema.kbEntry)
    .where(and(...conditions))
    .orderBy(asc(schema.kbEntry.createdAt));
  return Response.json({ entries });
});

const createBase = {
  assistantId: z.string().min(1).optional().nullable(),
};

const createSchema = z.discriminatedUnion("kind", [
  z.object({
    ...createBase,
    kind: z.literal("qa"),
    question: z.string().trim().min(1).max(500),
    answer: z.string().trim().min(1).max(4000),
  }),
  z.object({
    ...createBase,
    kind: z.literal("block"),
    content: z.string().trim().min(1).max(8000),
  }),
]);

export const POST = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const inserted = await db
    .insert(schema.kbEntry)
    .values({
      id: newId("kbEntry"),
      organizationId: session.organizationId,
      assistantId: body.data.assistantId ?? null,
      kind: body.data.kind,
      question: body.data.kind === "qa" ? body.data.question : null,
      answer: body.data.kind === "qa" ? body.data.answer : null,
      content: body.data.kind === "block" ? body.data.content : null,
    })
    .returning();
  if (!inserted[0]) return apiError(500, "internal", "No se pudo crear");
  return Response.json({ entry: inserted[0] }, { status: 201 });
});

const updateSchema = z.object({
  id: z.string().min(1, "id es requerido"),
  kind: z.enum(["qa", "block"]).optional(),
  question: z.string().trim().min(1).max(500).optional().nullable(),
  answer: z.string().trim().min(1).max(4000).optional().nullable(),
  content: z.string().trim().min(1).max(8000).optional().nullable(),
});

export const PUT = withAuth(async (session, req: Request) => {
  const body = await parseBody(req, updateSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const updated = await db
    .update(schema.kbEntry)
    .set({
      ...(body.data.kind ? { kind: body.data.kind } : {}),
      ...(body.data.question !== undefined ? { question: body.data.question } : {}),
      ...(body.data.answer !== undefined ? { answer: body.data.answer } : {}),
      ...(body.data.content !== undefined ? { content: body.data.content } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        scoped(schema.kbEntry.organizationId, session.organizationId),
        eq(schema.kbEntry.id, body.data.id)
      )
    )
    .returning();

  if (!updated[0]) return apiError(404, "not_found", "Entrada no encontrada");
  return Response.json({ entry: updated[0] });
});

export const DELETE = withAuth(async (session, req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return apiError(400, "bad_request", "Falta el id de la entrada");

  const db = getDb();
  await db
    .delete(schema.kbEntry)
    .where(
      and(
        scoped(schema.kbEntry.organizationId, session.organizationId),
        eq(schema.kbEntry.id, id)
      )
    );

  return Response.json({ ok: true });
});
