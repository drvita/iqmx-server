import { InboxClient } from "@/components/inbox/inbox-client";
import { CHANNEL_ORDER } from "@/lib/channels";
import { getOrganizationChannels } from "@/server/channels/enabled";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const session = await getSessionOrNull();
  const enabled = await getOrganizationChannels(session?.organizationId);
  const channels = CHANNEL_ORDER.filter((c) => enabled.has(c));

  return <InboxClient channels={channels} />;
}
