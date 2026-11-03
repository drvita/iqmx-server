import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import { canConfigure } from "@/lib/auth/roles";
import { publish } from "@/server/events/bus";
import { eliminarConversacion } from "@/server/inbox/eliminar";
import { serializeConversation, getConversation, updateConversation } from "@/server/inbox/queries";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  aiEnabled: z.boolean().optional(),
  reactivate: z.boolean().optional(),
  markRead: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export const PATCH = withAuth(async (session, req: Request, ctx: Params) => {
  const { id } = await ctx.params;
  const body = await parseBody(req, patchSchema);
  if (!body.ok) return body.response;

  const updated = await updateConversation(session.organizationId, id, body.data);
  if (!updated) return apiError(404, "not_found", "Conversación no encontrada");

  const row = await getConversation(session.organizationId, id);
  if (row) {
    const accountName =
      row.conversation.channel === "messenger"
        ? row.messengerPageName
        : row.conversation.channel === "instagram"
          ? row.igUsername
          : row.lineName;
    const dto = serializeConversation(
      row.conversation,
      row.contact,
      null,
      null,
      row.linePhone,
      row.lineName,
      accountName
    );
    publish(session.organizationId, {
      type: "conversation.updated",
      data: { conversation: dto },
    });
    return Response.json({ conversation: dto });
  }
  return Response.json({ conversation: null });
});

const FECHA_DE_CITA = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" });

/**
 * 026 — Elimina la conversación (hilo o contacto entero).
 * `?contacto=1` se lleva además a la persona: contacto, lead y citas pasadas.
 * Requiere rol administrativo (owner o admin).
 */
export const DELETE = withAuth(async (session, req: Request, ctx: Params) => {
  if (!canConfigure(session.role)) {
    return apiError(
      403,
      "forbidden",
      "Solo quien administra el negocio puede eliminar conversaciones"
    );
  }
  const { id } = await ctx.params;
  const alcance =
    new URL(req.url).searchParams.get("contacto") === "1" ? "contacto" : "hilo";

  const resultado = await eliminarConversacion(session.organizationId, id, alcance);
  if (!resultado.ok) {
    if (resultado.motivo === "cita_pendiente") {
      return apiError(
        409,
        "cita_pendiente",
        `Tiene una cita agendada para el ${FECHA_DE_CITA.format(resultado.cuando)}. Cancélala en Citas antes de eliminar.`
      );
    }
    return apiError(404, "not_found", "Conversación no encontrada");
  }

  console.info(
    `[bandeja] ${session.userId} eliminó ${id} (${alcance}) en ${session.organizationId}`
  );

  for (const conversacion of resultado.conversaciones) {
    publish(session.organizationId, {
      type: "conversation.deleted",
      data: {
        conversationId: conversacion.id,
        contactId: resultado.contact.id,
        contactDeleted: alcance === "contacto",
      },
    });
  }

  return Response.json({ ok: true, alcance });
});
