import { redirect } from "next/navigation";
import { ConfiguracionClient } from "@/components/admin/ConfiguracionClient";
import { getSessionOrNull } from "@/lib/auth/session";
import { getOrganizationOverview } from "@/services/admin/branding-users";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const overview = await getOrganizationOverview(session.orgId);
  if (!overview) redirect("/login");

  const isOrgAdmin = session.rol === "ORG_ADMIN";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
          {isOrgAdmin ? "Configuración" : "Mi Cuenta"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {isOrgAdmin
            ? "Personaliza la imagen de tu negocio en el quiosco, la jornada semanal y tu contraseña."
            : "Actualiza la contraseña de tu cuenta de acceso."}
        </p>
      </header>
      <ConfiguracionClient
        org={{
          logoUrl: overview.org.logoUrl,
          colorPrimario: overview.org.colorPrimario,
          colorSecundario: overview.org.colorSecundario,
          mensajeBienvenida: overview.org.mensajeBienvenida ?? "Bienvenido",
          horasSemanalesMax: overview.org.horasSemanalesMax,
          hasAuditPin: Boolean(overview.org.pinAuditoriaHash),
        }}
        canEdit={isOrgAdmin}
      />
    </div>
  );
}
