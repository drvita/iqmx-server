import { z } from "zod";
import { apiError, parseBody, withAuth } from "@/lib/api";
import {
  APP_MODULES,
  getOrganizationRolePermissions,
  setRolePermission,
  type AppModule,
} from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (session) => {
  const permissions = await getOrganizationRolePermissions(session.organizationId);
  return Response.json({ permissions, modules: APP_MODULES });
});

const putSchema = z.object({
  role: z.enum(["admin", "agent"]),
  module: z.enum(APP_MODULES),
  allowed: z.boolean(),
});

export const PUT = withAuth(async (session, req: Request) => {
  if (session.role !== "owner" && session.role !== "admin") {
    return apiError(403, "forbidden", "Solo el propietario o administradores pueden modificar permisos");
  }

  const body = await parseBody(req, putSchema);
  if (!body.ok) return body.response;

  await setRolePermission(
    session.organizationId,
    body.data.role,
    body.data.module as AppModule,
    body.data.allowed
  );

  return Response.json({ ok: true });
});
