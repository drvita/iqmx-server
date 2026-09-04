import { notFound } from "next/navigation";
import { BookingsClient } from "@/components/bookings/bookings-client";
import { isAgendaEnabled } from "@/server/agenda/flag";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const session = await getSessionOrNull();
  if (!session || !(await isAgendaEnabled(session.organizationId))) {
    notFound();
  }
  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-[17px] font-bold tracking-tight">Citas</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <BookingsClient />
      </div>
    </div>
  );
}
