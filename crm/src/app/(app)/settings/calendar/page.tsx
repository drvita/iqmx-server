import { notFound } from "next/navigation";
import { AgendaClient } from "@/components/settings/agenda-client";
import { isAgendaEnabled } from "@/server/agenda/flag";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AgendaSettingsPage() {
  const session = await getSessionOrNull();
  if (!session || !(await isAgendaEnabled(session.organizationId))) {
    notFound();
  }
  return <AgendaClient />;
}
