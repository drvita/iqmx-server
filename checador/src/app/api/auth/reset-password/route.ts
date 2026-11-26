import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmPasswordReset } from "@/services/auth/password-reset";

export const dynamic = "force-dynamic";

const resetSchema = z.object({
  token: z.string().trim().min(1),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Solicitud inválida." },
      { status: 400 }
    );
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Datos inválidos para restablecer la contraseña.",
      },
      { status: 422 }
    );
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;

  const result = await confirmPasswordReset({
    token: parsed.data.token,
    newPassword: parsed.data.password,
    ipOrigen: ip,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Tu contraseña ha sido actualizada correctamente.",
  });
}
