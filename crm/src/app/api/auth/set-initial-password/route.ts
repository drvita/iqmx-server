import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { getAuth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/db/ids";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  newPassword: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña no debe exceder 128 caracteres"),
});

export async function POST(req: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return Response.json(
      { ok: false, error: "No autenticado. Inicia sesión para continuar." },
      { status: 401 }
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "Cuerpo de solicitud inválido." },
      { status: 400 }
    );
  }

  const parsed = inputSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message || "Datos inválidos.",
      },
      { status: 422 }
    );
  }

  const db = getDb();
  const userId = session.user.id;
  const hash = await hashPassword(parsed.data.newPassword);

  // Actualizar o crear registro en schema.account
  const existingAccounts = await db
    .select()
    .from(schema.account)
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "credential")
      )
    )
    .limit(1);

  if (existingAccounts[0]) {
    await db
      .update(schema.account)
      .set({ password: hash, updatedAt: new Date() })
      .where(eq(schema.account.id, existingAccounts[0].id));
  } else {
    await db.insert(schema.account).values({
      id: newId("account"),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
    });
  }

  // Buscar organizaciones donde este usuario sea miembro y retirar la bandera mustChangePassword
  const members = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId));

  for (const m of members) {
    const [org] = await db
      .select({ id: schema.organization.id, metadata: schema.organization.metadata })
      .from(schema.organization)
      .where(eq(schema.organization.id, m.organizationId))
      .limit(1);

    if (org && org.metadata) {
      try {
        const meta = JSON.parse(org.metadata);
        meta.mustChangePassword = false;
        delete meta.tempPassword;
        await db
          .update(schema.organization)
          .set({ metadata: JSON.stringify(meta) })
          .where(eq(schema.organization.id, org.id));
      } catch {}
    }
  }

  return Response.json({
    ok: true,
    message: "Tu contraseña definitiva ha sido configurada exitosamente.",
  });
}
