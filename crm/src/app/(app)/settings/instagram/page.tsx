import { notFound } from "next/navigation";
import { InstagramClient } from "@/components/settings/instagram-client";
import { isChannelEnabledForOrg } from "@/server/channels/enabled";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InstagramSettingsPage() {
  const session = await getSessionOrNull();
  if (
    !session ||
    !(await isChannelEnabledForOrg("instagram", session.organizationId))
  ) {
    notFound();
  }
  return <InstagramClient />;
}
