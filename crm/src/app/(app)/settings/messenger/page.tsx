import { notFound } from "next/navigation";
import { MessengerClient } from "@/components/settings/messenger-client";
import { isChannelEnabledForOrg } from "@/server/channels/enabled";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function MessengerSettingsPage() {
  const session = await getSessionOrNull();
  if (!session || !(await isChannelEnabledForOrg("messenger", session.organizationId))) {
    notFound();
  }
  return <MessengerClient />;
}
