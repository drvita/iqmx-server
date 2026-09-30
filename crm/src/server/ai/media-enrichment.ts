import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { readMediaFile } from "@/server/whatsapp/media";
import { getOrganizationSettings, getDecryptedAiApiKey } from "@/server/settings/service";

export type MediaEnrichmentResult =
  | { ok: true; transcript?: string; description?: string }
  | { ok: false; error: string };

/**
 * Transcribe un archivo de audio/nota de voz usando el modelo STT configurado
 * por la organización (ej: openai/whisper-large-v3-turbo).
 */
export async function enrichAudioMedia(
  organizationId: string,
  assetId: string
): Promise<MediaEnrichmentResult> {
  const db = getDb();
  const [asset] = await db
    .select()
    .from(schema.mediaAsset)
    .where(eq(schema.mediaAsset.id, assetId))
    .limit(1);

  if (!asset || asset.organizationId !== organizationId) {
    return { ok: false, error: "Asset no encontrado o no pertenece a la organización." };
  }

  // Si ya fue transcrito previamente, aprovechamos la persistencia en base de datos
  if (asset.aiTranscript) {
    return { ok: true, transcript: asset.aiTranscript };
  }

  const settings = await getOrganizationSettings(organizationId);
  const sttModel = settings.aiSttModel?.trim();
  if (!sttModel) {
    return { ok: false, error: "no_model_configured" };
  }

  const apiKey = getDecryptedAiApiKey(settings) || process.env.OPENROUTER_API_TOKEN;
  if (!apiKey) {
    return { ok: false, error: "Sin clave de API de IA configurada." };
  }

  const baseUrl = (settings.aiBaseUrl || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api").replace(
    /\/+$/,
    ""
  );

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readMediaFile(organizationId, assetId);
  } catch (err: any) {
    return { ok: false, error: `No se pudo leer el archivo de audio del disco: ${err.message || err}` };
  }

  const mimeType = asset.mimeType || "audio/ogg";
  let extension = "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) extension = "m4a";
  else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) extension = "mp3";
  else if (mimeType.includes("wav")) extension = "wav";

  const fileName = `audio_${assetId}.${extension}`;

  try {
    const formData = new FormData();
    const uint8 = new Uint8Array(fileBuffer);
    const blob = new Blob([uint8], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("model", sttModel);
    formData.append("language", "es");

    const endpoint = `${baseUrl}/v1/audio/transcriptions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[media-enrichment] Error ${res.status} de STT en ${endpoint}: ${errText}`);
      return { ok: false, error: `Error del proveedor STT (${res.status}): ${errText.slice(0, 150)}` };
    }

    const data = (await res.json()) as { text?: string };
    const transcript = (data.text || "").trim();

    if (!transcript) {
      return { ok: false, error: "El proveedor STT no devolvió texto en la transcripción." };
    }

    // Persistir resultado en mediaAsset
    await db
      .update(schema.mediaAsset)
      .set({
        aiTranscript: transcript,
        // Guardamos también en caption para compatibilidad inmediata en UI del inbox
        caption: asset.caption ? `${asset.caption}\n${transcript}` : transcript,
        aiProcessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaAsset.id, assetId));

    return { ok: true, transcript };
  } catch (err: any) {
    const msg = err.name === "AbortError" ? "Timeout al transcribir audio" : err.message || String(err);
    console.warn(`[media-enrichment] Excepción transcribiendo audio asset ${assetId}:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Genera una descripción de la imagen usando el modelo de visión configurado
 * (ej: google/gemini-2.5-flash) mediante OpenAI Chat Completions multimodal.
 */
export async function enrichImageMedia(
  organizationId: string,
  assetId: string
): Promise<MediaEnrichmentResult> {
  const db = getDb();
  const [asset] = await db
    .select()
    .from(schema.mediaAsset)
    .where(eq(schema.mediaAsset.id, assetId))
    .limit(1);

  if (!asset || asset.organizationId !== organizationId) {
    return { ok: false, error: "Asset no encontrado o no pertenece a la organización." };
  }

  // Si ya fue descrita previamente, retornamos el resultado persistido
  if (asset.aiDescription) {
    return { ok: true, description: asset.aiDescription };
  }

  const settings = await getOrganizationSettings(organizationId);
  const visionModel = settings.aiVisionModel?.trim();
  if (!visionModel) {
    return { ok: false, error: "no_model_configured" };
  }

  const apiKey = getDecryptedAiApiKey(settings) || process.env.OPENROUTER_API_TOKEN;
  if (!apiKey) {
    return { ok: false, error: "Sin clave de API de IA configurada." };
  }

  const baseUrl = (settings.aiBaseUrl || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api").replace(
    /\/+$/,
    ""
  );

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readMediaFile(organizationId, assetId);
  } catch (err: any) {
    return { ok: false, error: `No se pudo leer la imagen del disco: ${err.message || err}` };
  }

  const mimeType = asset.mimeType || "image/jpeg";
  const base64Image = fileBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const promptText =
    "Describe concisamente en español los elementos clave de esta imagen para que un asistente de atención al cliente pueda comprender lo que el usuario envió. Si es un comprobante, captura o recibo de pago, extrae los datos principales (monto, fecha, referencia). Sé objetivo y no inventes datos.";

  try {
    const payload = {
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 350,
      temperature: 0.2,
    };

    const endpoint = `${baseUrl}/v1/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[media-enrichment] Error ${res.status} de visión en ${endpoint}: ${errText}`);
      return { ok: false, error: `Error del proveedor de visión (${res.status}): ${errText.slice(0, 150)}` };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const description = (data.choices?.[0]?.message?.content || "").trim();

    if (!description) {
      return { ok: false, error: "El proveedor de visión no generó descripción de la imagen." };
    }

    // Persistir resultado en mediaAsset
    await db
      .update(schema.mediaAsset)
      .set({
        aiDescription: description,
        aiProcessedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.mediaAsset.id, assetId));

    return { ok: true, description };
  } catch (err: any) {
    const msg = err.name === "AbortError" ? "Timeout al analizar imagen" : err.message || String(err);
    console.warn(`[media-enrichment] Excepción analizando imagen asset ${assetId}:`, msg);
    return { ok: false, error: msg };
  }
}
