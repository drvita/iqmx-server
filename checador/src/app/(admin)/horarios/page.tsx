import { redirect } from "next/navigation";
import { SchedulesClient } from "@/components/admin/SchedulesClient";
import { getSessionOrNull } from "@/lib/auth/session";
import { listSchedules } from "@/services/admin/schedules-branches";

export const dynamic = "force-dynamic";

export default async function HorariosPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const schedules = await listSchedules(session.orgId);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          Horarios y Jornadas Laborales
        </h1>
        <p className="text-xs text-slate-500">
          Define turnos, tolerancias y descansos alineados a la transición 48h → 40h.
        </p>
      </header>
      <SchedulesClient schedules={schedules} />
    </div>
  );
}
