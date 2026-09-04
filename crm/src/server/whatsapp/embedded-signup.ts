import { graphRequest } from "@/lib/meta/client";
import { getDb, schema } from "@/lib/db";
import { scoped } from "@/lib/db/tenant";
import { and, desc, eq } from "drizzle-orm";
import { saveCredentials } from "@/server/whatsapp/credentials";
import { subscribeAppToWaba, testConnection } from "@/server/whatsapp/connect";

export type EmbeddedExchangeInput = {
  organizationId: string;
  code: string;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  label?: string | null;
};

export type EmbeddedExchangeResult =
  | {
      ok: true;
      wabaId: string;
      phoneNumberId: string;
      displayPhoneNumber: string;
      verifiedName: string | null;
    }
  | { ok: false; error: string; code: string };

/**
 * Realiza el intercambio del código de autorización del Embedded Signup
 * hacia Meta Graph API usando el META_APP_SECRET guardado en el servidor.
 */
export async function exchangeEmbeddedSignupCode(
  input: EmbeddedExchangeInput
): Promise<EmbeddedExchangeResult> {
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    return {
      ok: false,
      code: "missing_app_secret",
      error:
        "Faltan las credenciales de la App de Meta (META_APP_ID o META_APP_SECRET) en el servidor.",
    };
  }

  let accessToken: string;
  try {
    // 1. Intercambiar authorization code por access token
    const tokenUrl = `https://graph.facebook.com/v25.0/oauth/access_token?client_id=${encodeURIComponent(
      appId
    )}&client_secret=${encodeURIComponent(
      appSecret
    )}&code=${encodeURIComponent(input.code)}`;

    const res = await fetch(tokenUrl);
    const data = await res.json();

    if (!res.ok || !data.access_token) {
      console.error("[embedded-signup] error en oauth/access_token:", data);
      return {
        ok: false,
        code: "oauth_failed",
        error: data.error?.message || "Error al intercambiar el código con Meta.",
      };
    }

    accessToken = data.access_token;
  } catch (err) {
    console.error("[embedded-signup] network error intercambiando code:", err);
    return {
      ok: false,
      code: "network_error",
      error: "Error de red al comunicarse con los servidores de Meta.",
    };
  }

  let wabaId = input.wabaId?.trim() || "";
  let phoneNumberId = input.phoneNumberId?.trim() || "";

  // Auto-descubrimiento de WABA ID y Phone Number ID si no llegaron del frontend
  if (!wabaId || !phoneNumberId) {
    try {
      console.log("[embedded-signup] intentando auto-descubrimiento de WABA y Teléfono...");
      // 1. debug_token devuelve los granular_scopes con target_ids (WABA ID)
      const debugRes = await fetch(
        `https://graph.facebook.com/v25.0/debug_token?input_token=${encodeURIComponent(
          accessToken
        )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
      );
      const debugData = await debugRes.json();
      console.log("[embedded-signup] debug_token:", JSON.stringify(debugData));

      if (debugData?.data?.granular_scopes) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const waScope = debugData.data.granular_scopes.find(
          (s: any) => s.scope === "whatsapp_business_management"
        );
        if (waScope?.target_ids?.[0]) {
          wabaId = String(waScope.target_ids[0]);
        }
      }

      // Si aún no se tiene wabaId, consultar cuentas de WhatsApp compartidas
      if (!wabaId) {
        const sharedWabaRes = await fetch(
          `https://graph.facebook.com/v25.0/me/client_whatsapp_business_accounts?access_token=${encodeURIComponent(
            accessToken
          )}`
        );
        const sharedData = await sharedWabaRes.json();
        console.log("[embedded-signup] client_whatsapp_business_accounts:", JSON.stringify(sharedData));
        if (sharedData?.data?.[0]?.id) {
          wabaId = String(sharedData.data[0].id);
        }
      }

      // Con el wabaId, consultar los números de teléfono registrados
      if (wabaId && !phoneNumberId) {
        const phoneRes = await fetch(
          `https://graph.facebook.com/v25.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${encodeURIComponent(
            accessToken
          )}`
        );
        const phoneData = await phoneRes.json();
        console.log("[embedded-signup] phone_numbers:", JSON.stringify(phoneData));
        if (phoneData?.data?.[0]?.id) {
          phoneNumberId = String(phoneData.data[0].id);
        }
      }
    } catch (err) {
      console.warn("[embedded-signup] error en auto-descubrimiento:", err);
    }
  }

  if (!wabaId) {
    return {
      ok: false,
      code: "missing_waba_id",
      error: "No se pudo identificar la cuenta de WhatsApp Business (WABA ID) asociada.",
    };
  }

  if (!phoneNumberId) {
    return {
      ok: false,
      code: "missing_phone_number_id",
      error: "No se pudo identificar el número de teléfono en la cuenta de WhatsApp Business.",
    };
  }

  // 2. Suscribir la WABA a la app de Tech Provider para recibir webhooks
  await subscribeAppToWaba(wabaId, accessToken);

  // 3. Probar la conexión y obtener display_phone_number y verified_name
  const check = await testConnection(phoneNumberId, accessToken);
  if (!check.ok) {
    return {
      ok: false,
      code: check.code,
      error: check.message,
    };
  }

  // 4. Obtener el Asistente IA conversacional por defecto de la organización
  const db = getDb();
  const assistantRows = await db
    .select({ id: schema.agentProfile.id })
    .from(schema.agentProfile)
    .where(
      and(
        scoped(schema.agentProfile.organizationId, input.organizationId),
        eq(schema.agentProfile.type, "conversational")
      )
    )
    .orderBy(desc(schema.agentProfile.isDefault), desc(schema.agentProfile.createdAt))
    .limit(1);

  const defaultAssistantId = assistantRows[0]?.id ?? null;

  // 5. Guardar la credencial en base de datos cifrada con AES-256-GCM
  await saveCredentials({
    organizationId: input.organizationId,
    wabaId,
    phoneNumberId,
    token: accessToken,
    displayPhoneNumber: check.displayPhoneNumber,
    verifiedName: check.verifiedName,
    label: input.label ?? check.verifiedName ?? check.displayPhoneNumber,
    assistantId: defaultAssistantId,
    aiEnabled: true,
    signupMethod: "embedded_signup",
  });

  return {
    ok: true,
    wabaId,
    phoneNumberId,
    displayPhoneNumber: check.displayPhoneNumber,
    verifiedName: check.verifiedName,
  };
}
