import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { getConversation, listMessages } from "@/server/inbox/queries";
import { serializeMessage } from "@/server/inbox/ingest";
import { SendError, sendStructured, sendText } from "@/server/inbox/send";
import { getAttributionForConversation } from "@/server/attribution/store";
import type { MessageDto } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const row = await getConversation(session.organizationId, id);
  if (!row) return apiError(404, "not_found", "Conversación no encontrada");

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;

  const [messages, attribution] = await Promise.all([
    listMessages(
      session.organizationId,
      id,
      since && !Number.isNaN(since.getTime()) ? since : undefined
    ),
    !since ? getAttributionForConversation(session.organizationId, id) : null,
  ]);

  const serialized: MessageDto[] = messages.map((r) =>
    serializeMessage(r.message, r.media)
  );

  if (attribution) {
    const raw = (attribution.raw ?? {}) as Record<string, unknown>;
    const adMessage: MessageDto = {
      id: `ad_${attribution.id}`,
      conversationId: id,
      direction: "in",
      type: "ad_referral",
      text: attribution.headline ?? "Anuncio de Meta",
      status: "delivered",
      error: null,
      aiGenerated: false,
      origin: "meta_ad",
      media: null,
      createdAt: attribution.createdAt.toISOString(),
      ad: {
        id: attribution.id,
        headline: attribution.headline,
        body: attribution.body,
        sourceId: attribution.sourceId,
        sourceType: attribution.sourceType,
        sourceUrl: attribution.sourceUrl,
        mediaType: attribution.mediaType,
        imageUrl:
          (raw.image_url as string | undefined) ??
          (raw.thumbnail_url as string | undefined) ??
          null,
        videoUrl: (raw.video_url as string | undefined) ?? null,
      },
    };

    serialized.push(adMessage);
    serialized.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  return Response.json({
    messages: serialized,
  });
});

// 008: además de texto, el body acepta ubicación y contactos (discriminado
// por `type`; sin `type` sigue siendo texto — compat con clientes previos).
const sendSchema = z.union([
  z.object({
    type: z.literal("text").optional(),
    text: z.string().trim().min(1).max(4096),
  }),
  z.object({
    type: z.literal("location"),
    location: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      name: z.string().trim().max(1000).optional(),
      address: z.string().trim().max(1000).optional(),
    }),
  }),
  z.object({
    type: z.literal("contacts"),
    contacts: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(200),
          phone: z.string().trim().min(5).max(30),
        })
      )
      .min(1)
      .max(5),
  }),
]);

const SEND_ERROR_STATUS: Record<SendError["code"], number> = {
  sandbox_violation: 403,
  not_connected: 409,
  reconnect_required: 409,
  window_closed: 409,
  meta_error: 422,
  meta_unavailable: 503,
  upload_failed: 502,
};

export const POST = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, sendSchema);
  if (!body.ok) return body.response;

  try {
    const data = body.data;
    const result =
      "text" in data
        ? await sendText({
            conversationId: id,
            organizationId: session.organizationId,
            text: data.text,
          })
        : data.type === "location"
          ? await sendStructured({
              conversationId: id,
              organizationId: session.organizationId,
              kind: "location",
              location: data.location,
            })
          : await sendStructured({
              conversationId: id,
              organizationId: session.organizationId,
              kind: "contacts",
              contacts: data.contacts,
            });
    return Response.json({ messageId: result.messageId });
  } catch (err) {
    if (err instanceof SendError) {
      return apiError(SEND_ERROR_STATUS[err.code], err.code, err.message);
    }
    throw err;
  }
});
