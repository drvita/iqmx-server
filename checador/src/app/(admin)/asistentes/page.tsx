import { redirect } from "next/navigation";
import { AsistentesClient } from "@/components/admin/AsistentesClient";
import { getSessionOrNull } from "@/lib/auth/session";
import {
  getOrganizationOverview,
  listOrgUsers,
} from "@/services/admin/branding-users";

export const dynamic = "force-dynamic";

export default async function AsistentesPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  if (session.rol !== "ORG_ADMIN") redirect("/dashboard");

  const [overview, users] = await Promise.all([
    getOrganizationOverview(session.orgId),
    listOrgUsers(session.orgId),
  ]);
  if (!overview) redirect("/login");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
          Asistentes
        </h1>
        <p className="text-xs text-slate-500 md:text-sm">
          Administra los accesos de asistentes y supervisores de tu
          organización.
        </p>
      </header>
      <AsistentesClient
        users={users}
        currentUserId={session.userId}
        currentUserRole={session.rol}
        extraRolesEnabled={overview.org.extraRolesEnabled}
      />
    </div>
  );
}
