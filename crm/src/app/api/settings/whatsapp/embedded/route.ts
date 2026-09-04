import { apiError, withAuth } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/whatsapp/embedded
 * Obsoleto: En IQISSMexico, el onboarding oficial de Embedded Signup y canje de credenciales
 * se realiza exclusivamente desde el Portal de Clientes central de la plataforma Web.
 */
export const POST = withAuth(async (session) => {
  if (session.role !== "owner" && session.role !== "admin") {
    return apiError(403, "forbidden", "Solo propietarios o administradores pueden conectar líneas de WhatsApp");
  }

  return apiError(
    400,
    "deprecated",
    "El onboarding de WhatsApp se gestiona exclusivamente desde el Portal de Clientes de IQISSMexico."
  );
});
