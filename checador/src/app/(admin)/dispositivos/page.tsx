import { redirect } from "next/navigation";
import { DevicesClient } from "@/components/admin/DevicesClient";
import { getSessionOrNull } from "@/lib/auth/session";
import { getOrganizationOverview } from "@/services/admin/branding-users";
import { listDevices } from "@/services/admin/devices";
import { listEmployees } from "@/services/admin/employees";
import { listBranches } from "@/services/admin/schedules-branches";

export const dynamic = "force-dynamic";

export default async function DispositivosPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const [overview, devices, branches, employees] = await Promise.all([
    getOrganizationOverview(session.orgId),
    listDevices(session.orgId),
    listBranches(session.orgId),
    listEmployees(session.orgId),
  ]);
  if (!overview) redirect("/login");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          Dispositivos Quiosco y Emparejamiento
        </h1>
        <p className="text-xs text-slate-500">
          Genera un PIN o código QR para vincular terminales fijas o móviles
          personales, desvincula para cambiar de equipo o elimina las que ya no
          utilices.
        </p>
      </header>
      <DevicesClient
        devices={devices}
        branches={branches.map((b) => ({ id: b.id, nombre: b.nombre }))}
        employees={employees
          .filter((e) => e.activo)
          .map((e) => ({
            id: e.id,
            nombreCompleto: e.nombreCompleto,
            codigoInterno: e.codigoInterno,
          }))}
        maxDispositivos={overview.org.maxDispositivos}
      />
    </div>
  );
}
