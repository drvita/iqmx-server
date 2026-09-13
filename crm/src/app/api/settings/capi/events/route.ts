import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import {
  atribucionDisabledResponse,
  isAtribucionEnabled,
} from "@/server/attribution/flag";
import {
  listConversionActivity,
  retryConversion,
} from "@/server/attribution/conversions";

export const dynamic = "force-dynamic";

/**
 * 016 — Actividad reciente de conversiones.
 *
 * GET: Responde la única pregunta que importa cuando uno duda de esto: "¿le está
 * llegando algo a Meta y, si no, por qué?". Solo lectura.
 *
 * POST: Permite reintentar manualmente un evento que previamente falló.
 */
export const GET = withAuth(async (session, req: Request) => {
  if (!(await isAtribucionEnabled(session.organizationId))) return atribucionDisabledResponse();
  const raw = new URL(req.url).searchParams.get("limit");
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  // Un límite fuera de rango se recorta, no falla: es un panel, no un contrato
  // de paginación.
  const limit = Number.isFinite(parsed) ? parsed : undefined;
  const events = await listConversionActivity(session.organizationId, limit);
  return Response.json({ events });
});

const retrySchema = z.object({
  eventId: z.string().trim().min(1),
});

export const POST = withAuth(async (session, req: Request) => {
  if (!(await isAtribucionEnabled(session.organizationId))) return atribucionDisabledResponse();

  const body = await parseBody(req, retrySchema);
  if (!body.ok) return body.response;

  const result = await retryConversion(session.organizationId, body.data.eventId);
  if (!result.ok) {
    return apiError(
      400,
      "reintento_fallido",
      result.error ?? "No se pudo reenviar la conversión a Meta"
    );
  }

  return Response.json({
    ok: true,
    status: result.status,
    fbTraceId: result.fbTraceId,
  });
});
