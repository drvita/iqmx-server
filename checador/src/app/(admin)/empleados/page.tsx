import { redirect } from "next/navigation";
import { EmployeesClient } from "@/components/admin/EmployeesClient";
import { getSessionOrNull } from "@/lib/auth/session";
import { getOrganizationOverview } from "@/services/admin/branding-users";
import { listEmployees } from "@/services/admin/employees";
import {
  listBranches,
  listSchedules,
} from "@/services/admin/schedules-branches";

export const dynamic = "force-dynamic";

export default async function EmpleadosPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const [overview, employees, branches, schedules] = await Promise.all([
    getOrganizationOverview(session.orgId),
    listEmployees(session.orgId),
    listBranches(session.orgId),
    listSchedules(session.orgId),
  ]);

  if (!overview) redirect("/login");

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
          Colaboradores y Registro Facial
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Registra a tus colaboradores y captura hasta 3 fotos de su rostro para
          que puedan checar su asistencia en el quiosco.
        </p>
      </header>

      <EmployeesClient
        employees={employees}
        branches={branches.map((b) => ({ id: b.id, nombre: b.nombre }))}
        schedules={schedules.map((s) => ({ id: s.id, nombre: s.nombre }))}
        maxEmpleados={overview.org.maxEmpleados}
      />
    </div>
  );
}
