import { z } from "zod";
import { parseBody } from "@/lib/api";
import { requireBotKeyAndResolveOrg } from "@/server/bot/auth";
import { sendTypingIndicator } from "@/server/whatsapp/typing";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ conversationId: z.string().min(1) });

/**
 * Indicador "escribiendo…" + marcar leído el último inbound.
 * POST /api/bot/typing {conversationId}
 */
export async function POST(req: Request) {
  const auth = await requireBotKeyAndResolveOrg(req);
  if (!auth.ok) return auth.error;
  const body = await parseBody(req, bodySchema);
  if (!body.ok) return body.response;

  const result = await sendTypingIndicator(body.data.conversationId);
  return Response.json(result);
}
