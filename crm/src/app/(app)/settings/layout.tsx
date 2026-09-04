import { SettingsNav } from "@/components/settings/settings-nav";
import { isAgendaEnabled } from "@/server/agenda/flag";
import { isAtribucionEnabled } from "@/server/attribution/flag";
import { isChannelEnabledForOrg } from "@/server/channels/enabled";
import { getSessionOrNull } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionOrNull();
  const orgId = session?.organizationId;

  const [hasAgenda, hasAtribucion, hasMessenger, hasInstagram] = await Promise.all([
    isAgendaEnabled(orgId),
    isAtribucionEnabled(orgId),
    isChannelEnabledForOrg("messenger", orgId),
    isChannelEnabledForOrg("instagram", orgId),
  ]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b px-4 py-3 sm:px-6 sm:py-4">
        <h2 className="text-[17px] font-bold tracking-tight">Configuración</h2>
      </header>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <SettingsNav
          agenda={hasAgenda}
          atribucion={hasAtribucion}
          messenger={hasMessenger}
          instagram={hasInstagram}
        />
        <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
