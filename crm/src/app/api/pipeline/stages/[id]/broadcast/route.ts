import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import {
  executeStageBroadcast,
  getStageBroadcastAudience,
} from "@/server/broadcasts/stage";
import { TemplateError, templateErrorStatus } from "@/server/whatsapp/templates";
import type { LossReason } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const broadcastBodySchema = z.object({
  templateId: z.string().min(1),
  lossReason: z
    .enum([
      "precio",
      "no_es_perfil",
      "sin_presupuesto",
      "eligio_otro",
      "nunca_contesto",
      "otro",
      "all",
    ])
    .optional()
    .nullable(),
  variableMappings: z.array(z.string().trim().max(500)).max(10).optional(),
});

/**
 * GET: Obtiene la audiencia estimada de la etapa y los motivos de pérdida disponibles.
 * Query opcional: `?lossReason=precio|all`
 */
export const GET = withAuth(async (session, req: Request, ctx: RouteParams) => {
  const { id: stageId } = await ctx.params;
  const url = new URL(req.url);
  const rawLossReason = url.searchParams.get("lossReason");
  const lossReason =
    rawLossReason && rawLossReason !== "all"
      ? (rawLossReason as LossReason)
      : rawLossReason === "all"
        ? "all"
        : undefined;

  try {
    const audience = await getStageBroadcastAudience(session.organizationId, {
      stageId,
      lossReason,
    });
    return Response.json(audience);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener audiencia";
    if (message === "Etapa no encontrada") {
      return apiError(404, "not_found", message);
    }
    return apiError(500, "internal_error", message);
  }
});

/**
 * POST: Ejecuta el envío masivo por lotes a los prospectos de la etapa.
 */
export const POST = withAuth(async (session, req: Request, ctx: RouteParams) => {
  const { id: stageId } = await ctx.params;
  const body = await parseBody(req, broadcastBodySchema);
  if (!body.ok) return body.response;

  try {
    const result = await executeStageBroadcast({
      organizationId: session.organizationId,
      stageId,
      templateId: body.data.templateId,
      lossReason: body.data.lossReason,
      variableMappings: body.data.variableMappings,
    });
    return Response.json(result);
  } catch (err: unknown) {
    if (err instanceof TemplateError) {
      return apiError(templateErrorStatus(err), err.code, err.message);
    }
    const message = err instanceof Error ? err.message : "Error al ejecutar difusión";
    if (message === "Etapa no encontrada") {
      return apiError(404, "not_found", message);
    }
    return apiError(500, "internal_error", message);
  }
});
