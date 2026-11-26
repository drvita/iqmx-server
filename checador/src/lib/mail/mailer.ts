import { getEnv } from "@/lib/env";

export async function sendPasswordResetEmail(params: {
  to: string;
  nombre: string;
  resetUrl: string;
}): Promise<{ delivered: boolean; mode: "mailtrap" | "console_fallback" }> {
  const env = getEnv();
  const token = env.MAILTRAP_API_TOKEN?.trim();

  if (!token) {
    console.info("[Checador Mailer Fallback] Recuperación de contraseña", {
      to: params.to,
      resetUrl: params.resetUrl,
    });
    return { delivered: false, mode: "console_fallback" };
  }

  const subject = "Restablece tu contraseña — Checador Facial IQISS";
  const text = [
    `Hola ${params.nombre},`,
    "",
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta en Checador Facial IQISS.",
    "Usa el siguiente enlace (válido por 15 minutos):",
    params.resetUrl,
    "",
    "Si no realizaste esta solicitud, puedes ignorar este correo de forma segura.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0b1c30; max-width: 520px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1e1b4b; margin-bottom: 12px;">Restablecer contraseña</h2>
      <p style="font-size: 14px; line-height: 1.6;">Hola <strong>${params.nombre}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6;">
        Recibimos una solicitud para restablecer la contraseña de tu acceso al panel administrativo de <strong>Checador Facial IQISS</strong>.
      </p>
      <p style="margin: 24px 0;">
        <a href="${params.resetUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 22px; border-radius: 8px;">
          Crear nueva contraseña
        </a>
      </p>
      <p style="font-size: 12px; color: #47464f; line-height: 1.5;">
        Este enlace expira en <strong>15 minutos</strong> y es de un solo uso.<br/>
        Si no solicitaste este cambio, ignora este mensaje.
      </p>
    </div>
  `;

  try {
    const res = await fetch(env.MAILTRAP_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: {
          email: env.MAIL_FROM_EMAIL,
          name: env.MAIL_FROM_NAME,
        },
        to: [{ email: params.to, name: params.nombre }],
        subject,
        text,
        html,
        category: "password_reset",
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[Checador Mailer Error]", res.status, errBody);
      return { delivered: false, mode: "mailtrap" };
    }
    return { delivered: true, mode: "mailtrap" };
  } catch (err) {
    console.error("[Checador Mailer Exception]", err);
    return { delivered: false, mode: "mailtrap" };
  }
}
