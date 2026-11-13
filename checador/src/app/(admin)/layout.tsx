import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getSessionOrNull } from "@/lib/auth/session";
import {
  getOrganizationOverview,
  getUserMustChangePassword,
} from "@/services/admin/branding-users";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionOrNull();
  if (!session) {
    redirect("/login");
  }

  const [overview, mustChangePassword] = await Promise.all([
    getOrganizationOverview(session.orgId),
    getUserMustChangePassword(session.orgId, session.userId),
  ]);
  if (!overview) {
    redirect("/login");
  }

  return (
    <AdminShell
      orgName={overview.org.nombre}
      logoUrl={overview.org.logoUrl}
      userName={session.nombre}
      userRole={session.rol}
      planCodigo={overview.org.planCodigo}
      mustChangePassword={mustChangePassword}
    >
      {children}
    </AdminShell>
  );
}
