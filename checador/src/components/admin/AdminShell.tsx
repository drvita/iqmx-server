"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Clock,
  LayoutDashboard,
  LogOut,
  Settings,
  TabletSmartphone,
  UserCog,
  Users,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { InitialPasswordModal } from "@/components/admin/InitialPasswordModal";

interface AdminShellProps {
  orgName: string;
  logoUrl?: string | null;
  userName: string;
  userRole: string;
  planCodigo: string;
  mustChangePassword?: boolean;
  children: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: "Administrador",
  RH_ASSISTANT: "Asistente de RH",
  SUPERVISOR_SUCURSAL: "Supervisor de Sucursal",
  AUDITOR_NOMINA: "Auditor de Nómina",
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/empleados", label: "Empleados", icon: Users },
  { href: "/horarios", label: "Horarios", icon: Clock },
  { href: "/sucursales", label: "Sucursales", icon: Building2 },
  { href: "/dispositivos", label: "Dispositivos", icon: TabletSmartphone },
  { href: "/asistentes", label: "Asistentes", icon: UserCog },
  { href: "/configuracion", label: "Configuración", icon: Settings },
] as const;

export function AdminShell({
  orgName,
  logoUrl,
  userName,
  userRole,
  mustChangePassword = false,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const roleLabel = ROLE_LABELS[userRole] ?? "Usuario";
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] lg:flex">
      {/* Sidebar PC / Topbar móvil */}
      <aside className="bg-[#1e1b4b] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:justify-between lg:overflow-y-auto">
        <div>
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={orgName}
                  className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-0.5"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-indigo-100">
                  {orgName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold uppercase tracking-wider text-indigo-200">
                  Checador Facial
                </p>
                <p className="truncate text-sm font-bold text-white">{orgName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              title="Cerrar sesión"
              className="rounded-lg p-2 text-indigo-200 hover:bg-white/10 hover:text-white lg:hidden"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex gap-1 overflow-x-auto px-3 py-2.5 lg:flex-col lg:space-y-1 lg:p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition lg:text-sm ${
                    active
                      ? "bg-[#4f46e5] text-white shadow-xs"
                      : "text-indigo-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden border-t border-white/10 p-4 lg:block">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{userName}</p>
              <p className="truncate text-[11px] text-indigo-200">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="rounded-lg p-2 text-indigo-200 hover:bg-white/10 hover:text-white"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <ConfirmModal
        open={logoutOpen}
        title="¿Cerrar sesión?"
        description="Se cerrará tu sesión actual en el panel administrativo. Podrás volver a ingresar en cualquier momento con tus credenciales."
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        busy={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />

      <InitialPasswordModal
        isOpen={mustChangePassword}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
