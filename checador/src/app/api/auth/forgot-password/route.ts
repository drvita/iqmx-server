import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/services/auth/password-reset";

export const dynamic = "force-dynamic";

const forgotSchema = z.object({
  email: z.string().trim().email("Ingresa un correo electrónico válido."),
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

  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Ingresa un correo electrónico válido." },
      { status: 422 }
    );
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;

  await requestPasswordReset(parsed.data.email, ip);

  return NextResponse.json({
    ok: true,
    message:
      "Si el correo está registrado en el sistema, recibirás un enlace válido por 15 minutos.",
  });
}
