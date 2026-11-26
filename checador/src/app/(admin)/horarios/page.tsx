import { redirect } from "next/navigation";
import { SchedulesClient } from "@/components/admin/SchedulesClient";
import { getSessionOrNull } from "@/lib/auth/session";
import { getOrganizationOverview } from "@/services/admin/branding-users";
import { listSchedules } from "@/services/admin/schedules-branches";

export const dynamic = "force-dynamic";

export default async function HorariosPage() {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");

  const [schedules, overview] = await Promise.all([
    listSchedules(session.orgId),
    getOrganizationOverview(session.orgId),
  ]);

  const orgWeeklyLimits = {
    diurna: Number(overview?.org.horasSemanalesMax ?? 48),
    mixta: Number(overview?.org.horasSemanalesMixta ?? 45),
    nocturna: Number(overview?.org.horasSemanalesNocturna ?? 42),
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900">
          Horarios y Jornadas Laborales
        </h1>
        <p className="text-xs text-slate-500">
          Define turnos, tipo de jornada (LFT Art. 60), tolerancias y descansos.
        </p>
      </header>
      <SchedulesClient
        schedules={schedules}
        orgWeeklyLimits={orgWeeklyLimits}
      />
    </div>
  );
}
