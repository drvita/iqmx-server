import { redirect } from "next/navigation";
import { BranchesClient } from "@/components/admin/BranchesClient";
import { getSessionOrNull } from "@/lib/auth/session";
import { getOrganizationOverview } from "@/services/admin/branding-users";
import { listBranches } from "@/services/admin/schedules-branches";

export const dynamic = "force-dynamic";

export default async function SucursalesPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const [overview, branches] = await Promise.all([
    getOrganizationOverview(session.orgId),
    listBranches(session.orgId),
  ]);
  if (!overview) redirect("/login");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Sucursales</h1>
        <p className="text-xs text-slate-500">
          Administra las sedes físicas donde operan tus terminales quiosco.
        </p>
      </header>
      <BranchesClient
        branches={branches}
        maxSucursales={overview.org.maxSucursales}
      />
    </div>
  );
}
