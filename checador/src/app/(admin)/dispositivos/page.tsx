import { redirect } from "next/navigation";
import { DevicesClient } from "@/components/admin/DevicesClient";
import { getSessionOrNull } from "@/lib/auth/session";
import { getOrganizationOverview } from "@/services/admin/branding-users";
import { listDevices } from "@/services/admin/devices";
import { listBranches } from "@/services/admin/schedules-branches";

export const dynamic = "force-dynamic";

export default async function DispositivosPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const [overview, devices, branches] = await Promise.all([
    getOrganizationOverview(session.orgId),
    listDevices(session.orgId),
    listBranches(session.orgId),
  ]);
  if (!overview) redirect("/login");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          Dispositivos Quiosco y Emparejamiento
        </h1>
        <p className="text-xs text-slate-500">
          Genera un PIN o código QR para vincular terminales, desvincula para
          cambiar de dispositivo o elimina las que ya no utilices.
        </p>
      </header>
      <DevicesClient
        devices={devices}
        branches={branches.map((b) => ({ id: b.id, nombre: b.nombre }))}
        maxDispositivos={overview.org.maxDispositivos}
      />
    </div>
  );
}
