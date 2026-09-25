import { notFound, redirect } from "next/navigation";
import { BookingsClient } from "@/components/bookings/bookings-client";
import { getSessionOrNull } from "@/lib/auth/session";
import { clampListTo, isCalendarView, isIsoDate } from "@/lib/time/calendar";
import { todayInTz } from "@/lib/time/slots";
import { isAgendaEnabled } from "@/server/agenda/flag";
import { getSettings } from "@/server/agenda/settings";

export const dynamic = "force-dynamic";

type Params = { vista?: string; fecha?: string; desde?: string; hasta?: string };

/**
 * 215 — Citas en calendario multi-inquilino.
 * La vista y la fecha viven en la URL para compartir o recargar.
 */
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  if (!(await isAgendaEnabled(session.organizationId))) {
    notFound();
  }

  const settings = await getSettings(session.organizationId);
  const params = await searchParams;
  const view = isCalendarView(params.vista) ? params.vista : null;
  const listFrom = isIsoDate(params.desde) ? params.desde : null;
  const date =
    view === "lista" && listFrom
      ? listFrom
      : isIsoDate(params.fecha)
        ? params.fecha
        : todayInTz(new Date(), settings.timezone);

  return (
    <BookingsClient
      initialView={view}
      initialDate={date}
      initialListTo={
        view === "lista" && isIsoDate(params.hasta)
          ? clampListTo(date, params.hasta)
          : null
      }
      timezone={settings.timezone}
      weeklyHours={settings.weeklyHours}
    />
  );
}
