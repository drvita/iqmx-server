import { z } from "zod";
import { getSessionOrNull } from "@/lib/auth/session";
import { getOrganizationSettings, getDecryptedAiApiKey } from "@/server/settings/service";

export const dynamic = "force-dynamic";

const testSchema = z.object({
  apiKey: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  baseUrl: z.string().trim().url().optional().nullable(),
});

/**
 * POST /api/settings/ai/test
 * Prueba en vivo la conexión con OpenRouter usando la API Key y modelo enviados
 * (o las credenciales actualmente guardadas de la organización).
 */
export async function POST(req: Request) {
  const session = await getSessionOrNull();
  if (!session) {
    return Response.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // cuerpo opcional
  }

  const parsed = testSchema.safeParse(body);
  const data = parsed.success ? parsed.data : {};

  const settings = await getOrganizationSettings(session.organizationId);

  // Usar la clave enviada en el formulario o la clave guardada en la base de datos
  let keyToTest = data.apiKey?.trim();
  if (!keyToTest) {
    keyToTest = getDecryptedAiApiKey(settings) || undefined;
  }

  if (!keyToTest) {
    return Response.json(
      { ok: false, error: "Por favor ingresa una API Key para realizar la prueba." },
      { status: 400 }
    );
  }

  const modelToTest = data.model?.trim() || settings.aiModel || "minimax/minimax-m2.7:free";
  const baseUrlToTest = data.baseUrl?.trim() || settings.aiBaseUrl || "https://openrouter.ai/api";
  const cleanBaseUrl = baseUrlToTest.replace(/\/+$/, "");

  // Paso 1: Validar si la API Key es reconocida por OpenRouter
  try {
    const authRes = await fetch(`${cleanBaseUrl}/v1/auth/key`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${keyToTest}`,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (authRes.status === 401) {
      return Response.json({
        ok: false,
        error: "La API Key ingresada no es válida o ha sido revocada en OpenRouter (HTTP 401). Verifica tu clave en openrouter.ai/keys.",
      });
    }
  } catch (err: any) {
    // Si falla el endpoint de auth por red, continuar con chat/completions
  }

  // Paso 2: Probar llamada al modelo seleccionado
  const chatUrl = `${cleanBaseUrl}/v1/chat/completions`;
  const startTime = Date.now();

  try {
    const res = await fetch(chatUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keyToTest}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://iqissmexico.com",
        "X-Title": "IQISSMexico CRM",
      },
      body: JSON.stringify({
        model: modelToTest,
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const elapsed = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      let errorDetail = `HTTP ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.metadata?.raw) {
          errorDetail = errJson.error.metadata.raw;
        } else if (errJson?.error?.message) {
          errorDetail = errJson.error.message;
        }
      } catch {
        errorDetail = errText.slice(0, 150) || errorDetail;
      }

      if (res.status === 429) {
        return Response.json({
          ok: false,
          error: `Tu API Key es válida, pero el modelo '${modelToTest}' está temporalmente saturado en OpenRouter (Rate Limit 429). Prueba con otro modelo como 'minimax/minimax-m2.7:free', 'liquid/lfm-2.5-2.6b:free' o 'deepseek/deepseek-chat'.`,
        });
      }

      return Response.json({
        ok: false,
        error: `OpenRouter respondió con error para el modelo '${modelToTest}': ${errorDetail}`,
      });
    }

    return Response.json({
      ok: true,
      message: `Conexión exitosa con ${modelToTest} (${elapsed}ms). Tu clave es válida y el modelo está listo para responder.`,
    });
  } catch (err: any) {
    return Response.json({
      ok: false,
      error: `Error de red o timeout conectando a ${chatUrl}: ${err.message || err}`,
    });
  }
}
