import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getSessionOrNull } from "@/lib/auth/session";
import { normalizeThemePreference, THEME_COOKIE } from "@/lib/theme";
import { getBranding } from "@/server/branding";
import { AppShell } from "@/components/app-shell";
import { resolveBuildCommit } from "@/lib/version";
import { isAgendaEnabled } from "@/server/agenda/flag";
import { isLabEnabledForOrg } from "@/server/settings/limits";
import {
  getOrganizationRolePermissions,
  type AppModule,
} from "@/server/auth/permissions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  if (
    session.organizationStatus === "suspended" ||
    session.organizationStatus === "cancelled"
  ) {
    redirect("/suspended");
  }
  const branding = await getBranding(session.organizationId);
  const authSession = await getAuth().api.getSession({
    headers: await headers(),
  });
  const theme = normalizeThemePreference(
    (await cookies()).get(THEME_COOKIE)?.value
  );

  const orgPermissions = await getOrganizationRolePermissions(
    session.organizationId
  );
  const userPermissions: Record<AppModule, boolean> =
    session.role === "owner"
      ? {
          inbox: true,
          pipeline: true,
          agenda: true,
          contacts: true,
          asistentes: true,
          whatsapp: true,
          team: true,
        }
      : orgPermissions[session.role as "admin" | "agent"] ?? {
          inbox: true,
          pipeline: true,
          agenda: false,
          contacts: true,
          asistentes: false,
          whatsapp: false,
          team: false,
        };

  const [hasAgenda, hasLab, [org]] = await Promise.all([
    isAgendaEnabled(session.organizationId),
    isLabEnabledForOrg(session.organizationId),
    (async () => {
      const { eq } = await import("drizzle-orm");
      const { getDb, schema } = await import("@/lib/db");
      return getDb()
        .select({ metadata: schema.organization.metadata })
        .from(schema.organization)
        .where(eq(schema.organization.id, session.organizationId))
        .limit(1);
    })(),
  ]);

  let mustChangePassword = false;
  if (org?.metadata) {
    try {
      const meta = JSON.parse(org.metadata);
      mustChangePassword = Boolean(meta.mustChangePassword);
    } catch {}
  }

  return (
    <AppShell
      branding={branding}
      userName={authSession?.user.name ?? "Usuario"}
      role={session.role}
      theme={theme}
      commit={resolveBuildCommit()}
      agenda={hasAgenda}
      lab={hasLab}
      permissions={userPermissions}
      mustChangePassword={mustChangePassword}
    >
      {children}
    </AppShell>
  );
}
