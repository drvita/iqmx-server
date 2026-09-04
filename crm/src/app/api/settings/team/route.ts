import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getAuth, runInternalSignup } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";
import { scoped } from "@/lib/db/tenant";
import {
  getMemberLineAccess,
  setMemberLineAccess,
  getOrganizationRolePermissions,
} from "@/server/auth/permissions";
import { listCredentialsByOrg } from "@/server/whatsapp/credentials";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const db = getDb();
  const [members, lines, permissions, settings] = await Promise.all([
    db
      .select({
        id: schema.member.id,
        userId: schema.member.userId,
        role: schema.member.role,
        createdAt: schema.member.createdAt,
        name: schema.user.name,
        email: schema.user.email,
      })
      .from(schema.member)
      .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
      .where(scoped(schema.member.organizationId, session.organizationId)),
    listCredentialsByOrg(session.organizationId),
    getOrganizationRolePermissions(session.organizationId),
    import("@/server/settings/service").then((m) => m.getOrganizationSettings(session.organizationId)),
  ]);

  // Obtener las líneas asignadas a cada miembro
  const membersWithAccess = await Promise.all(
    members.map(async (m) => {
      const assignedLines =
        m.role === "agent"
          ? await getMemberLineAccess(session.organizationId, m.id)
          : lines.map((l) => l.phoneNumberId); // Owner y Admin tienen acceso a todas
      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        name: m.name,
        email: m.email,
        createdAt: m.createdAt.toISOString(),
        assignedLines,
      };
    })
  );

  return Response.json({
    members: membersWithAccess,
    lines: lines.map((l) => ({
      phoneNumberId: l.phoneNumberId,
      label: l.label || l.verifiedName || l.displayPhoneNumber || l.phoneNumberId,
      displayPhoneNumber: l.displayPhoneNumber,
      isDefault: l.isDefault,
    })),
    permissions,
    maxTeamMembers: settings.maxTeamMembers,
    canAddMember: members.length < settings.maxTeamMembers,
  });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "agent"]).default("agent"),
  assignedLines: z.array(z.string()).optional(),
});

/** Alta de cuenta de equipo (owner o admin): email + contraseña temporal. */
export const POST = withAuth(async (session, req: Request) => {
  if (session.role !== "owner" && session.role !== "admin") {
    return apiError(403, "forbidden", "Solo el propietario o administradores pueden crear cuentas");
  }

  // Validar cuota máxima de integrantes de equipo permitidos por la membresía
  const { assertCanAddTeamMember } = await import("@/server/settings/limits");
  try {
    await assertCanAddTeamMember(session.organizationId);
  } catch (err: any) {
    return apiError(403, "quota_exceeded", err.message);
  }

  const body = await parseBody(req, createSchema);
  if (!body.ok) return body.response;

  const auth = getAuth();
  let newUserId: string;
  try {
    const result = await runInternalSignup(() =>
      auth.api.signUpEmail({
        body: {
          name: body.data.name,
          email: body.data.email,
          password: body.data.password,
        },
      })
    );
    newUserId = result.user.id;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo crear la cuenta";
    if (/exist/i.test(message)) {
      return apiError(409, "duplicate", "Ya existe una cuenta con ese correo");
    }
    return apiError(422, "invalid", message);
  }

  const db = getDb();
  const memberId = newId("member");
  await db
    .insert(schema.member)
    .values({
      id: memberId,
      organizationId: session.organizationId,
      userId: newUserId,
      role: body.data.role,
    })
    .onConflictDoNothing();

  // Asignar líneas telefónicas si es agente
  if (body.data.role === "agent" && body.data.assignedLines) {
    await setMemberLineAccess(
      session.organizationId,
      memberId,
      body.data.assignedLines
    );
  }

  return Response.json({ ok: true, memberId }, { status: 201 });
});

const patchSchema = z.object({
  memberId: z.string().trim().min(1),
  role: z.enum(["admin", "agent"]).optional(),
  assignedLines: z.array(z.string()).optional(),
});

/** Actualiza rol o líneas asignadas a un miembro. */
export const PATCH = withAuth(async (session, req: Request) => {
  if (session.role !== "owner" && session.role !== "admin") {
    return apiError(403, "forbidden", "Solo el propietario o administradores pueden editar miembros");
  }
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  const db = getDb();
  const targetMember = await db
    .select()
    .from(schema.member)
    .where(
      and(
        scoped(schema.member.organizationId, session.organizationId),
        eq(schema.member.id, body.data.memberId)
      )
    )
    .limit(1);

  if (!targetMember[0]) return apiError(404, "not_found", "Miembro no encontrado");
  if (targetMember[0].role === "owner") {
    return apiError(400, "cannot_edit_owner", "No se puede alterar el rol del propietario principal");
  }

  if (body.data.role) {
    await db
      .update(schema.member)
      .set({ role: body.data.role })
      .where(eq(schema.member.id, body.data.memberId));
  }

  if (body.data.assignedLines !== undefined) {
    await setMemberLineAccess(
      session.organizationId,
      body.data.memberId,
      body.data.assignedLines
    );
  }

  return Response.json({ ok: true });
});

/** Elimina un miembro del equipo. */
export const DELETE = withAuth(async (session, req: Request) => {
  if (session.role !== "owner" && session.role !== "admin") {
    return apiError(403, "forbidden", "Solo el propietario o administradores pueden eliminar miembros");
  }
  const url = new URL(req.url);
  const memberId = url.searchParams.get("memberId");
  if (!memberId) return apiError(400, "missing_id", "Se requiere memberId");

  const db = getDb();
  const target = await db
    .select()
    .from(schema.member)
    .where(
      and(
        scoped(schema.member.organizationId, session.organizationId),
        eq(schema.member.id, memberId)
      )
    )
    .limit(1);

  if (!target[0]) return apiError(404, "not_found", "Miembro no encontrado");
  if (target[0].role === "owner") {
    return apiError(400, "cannot_delete_owner", "No se puede eliminar al propietario");
  }

  await db.delete(schema.member).where(eq(schema.member.id, memberId));
  return Response.json({ ok: true });
});
