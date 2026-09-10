import { notFound } from "next/navigation";
import { getSessionOrNull } from "@/lib/auth/session";
import { isLabEnabledForOrg } from "@/server/settings/limits";
import { isAgendaEnabled } from "@/server/agenda/flag";
import { LabClient } from "@/components/lab/lab-client";

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const session = await getSessionOrNull();
  if (!session || !(await isLabEnabledForOrg(session.organizationId))) {
    notFound();
  }
  const agendaEnabled = await isAgendaEnabled(session.organizationId);
  return <LabClient agendaEnabled={agendaEnabled} />;
}
