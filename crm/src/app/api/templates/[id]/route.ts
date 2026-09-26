import { apiError, withAuth } from "@/lib/api";
import {
  deleteTemplate,
  TemplateError,
  templateErrorStatus,
} from "@/server/whatsapp/templates";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/templates/[id]
 * Elimina una plantilla tanto en Meta Cloud API como en la base de datos local del CRM.
 */
export const DELETE = withAuth(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    if (!id || !id.trim()) {
      return apiError(422, "invalid", "ID de plantilla requerido");
    }

    try {
      await deleteTemplate(session.organizationId, id.trim());
      return Response.json({ ok: true, deleted: true });
    } catch (err) {
      if (err instanceof TemplateError) {
        return apiError(templateErrorStatus(err), err.code, err.message);
      }
      throw err;
    }
  }
);
