import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import {
  setSessionCookie,
  signSessionToken,
  type RolCodigo,
} from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(1, "Contraseña requerida"),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json(
      { ok: false, error: "JSON malformado." },
      { status: 400 }
    );
  }

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Ingresa correo y contraseña válidos." },
      { status: 422 }
    );
  }

  const db = getDb();
  const normalizedEmail = parsed.data.email.toLowerCase();

  const rows = await db
    .select({
      userId: schema.usuarios.id,
      orgId: schema.usuarios.orgId,
      nombre: schema.usuarios.nombre,
      email: schema.usuarios.email,
      passwordHash: schema.usuarios.passwordHash,
      activo: schema.usuarios.activo,
      rolCodigo: schema.roles.codigo,
      orgEstado: schema.organizaciones.estado,
    })
    .from(schema.usuarios)
    .innerJoin(schema.roles, eq(schema.usuarios.rolId, schema.roles.id))
    .innerJoin(
      schema.organizaciones,
      eq(schema.usuarios.orgId, schema.organizaciones.id)
    )
    .where(eq(schema.usuarios.email, normalizedEmail))
    .limit(1);

  const user = rows[0];
  if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
    return Response.json(
      { ok: false, error: "Credenciales incorrectas." },
      { status: 401 }
    );
  }

  if (!user.activo) {
    return Response.json(
      { ok: false, error: "Tu usuario está desactivado." },
      { status: 403 }
    );
  }

  if (user.orgEstado === "suspendido" || user.orgEstado === "cancelado") {
    return Response.json(
      {
        ok: false,
        error: "La cuenta de tu organización está suspendida o cancelada.",
      },
      { status: 403 }
    );
  }

  const token = signSessionToken({
    userId: user.userId,
    orgId: user.orgId,
    rol: user.rolCodigo as RolCodigo,
    nombre: user.nombre,
    email: user.email,
  });

  await setSessionCookie(token);
  await db
    .update(schema.usuarios)
    .set({ ultimoLoginAt: new Date() })
    .where(eq(schema.usuarios.id, user.userId));

  return Response.json({
    ok: true,
    user: {
      id: user.userId,
      orgId: user.orgId,
      nombre: user.nombre,
      email: user.email,
      rol: user.rolCodigo,
    },
  });
}
