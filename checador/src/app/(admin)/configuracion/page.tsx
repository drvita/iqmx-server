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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
          Configuración
        </h1>
        <p className="text-xs text-slate-500 md:text-sm">
          Personaliza la identidad visual del quiosco y la jornada semanal de tu
          organización.
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
        canEdit={session.rol === "ORG_ADMIN"}
      />
    </div>
  );
}
