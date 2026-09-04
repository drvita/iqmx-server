import { notFound } from "next/navigation";
import { AdsClient } from "@/components/settings/ads-client";
import { isAtribucionEnabled } from "@/server/attribution/flag";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdsSettingsPage() {
  const session = await getSessionOrNull();
  if (!session || !(await isAtribucionEnabled(session.organizationId))) {
    notFound();
  }
  return <AdsClient />;
}
