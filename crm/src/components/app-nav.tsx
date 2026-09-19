"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  FlaskConical,
  Inbox,
  Kanban,
  LogOut,
  PanelLeftClose,
  Pin,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Branding } from "@/lib/branding";
import type { ThemePreference } from "@/lib/theme";
import { cn, initials } from "@/lib/utils";
import { signOut } from "@/lib/auth/client";
import { useEvents } from "@/components/use-events";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo, BrandTile } from "@/components/brand-mark";
import { LogoutModal } from "@/components/logout-modal";
import { APP_VERSION, BUILD_COMMIT, versionLabel } from "@/lib/version";

import type { AppModule } from "@/server/auth/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Inbox;
  badge?: boolean;
  module?: AppModule;
};

const NAV: NavItem[] = [
  { href: "/inbox", label: "Bandeja", icon: Inbox, badge: true, module: "inbox" },
  { href: "/pipeline", label: "Pipeline", icon: Kanban, module: "pipeline" },
  { href: "/contacts", label: "Contactos", icon: Users, module: "contacts" },
  { href: "/agent", label: "Asistentes", icon: Sparkles, module: "asistentes" },
];

/** "Laboratorio" solo existe si esta organización tiene lab_enabled. */
const LAB_ITEM: NavItem = {
  href: "/lab",
  label: "Laboratorio",
  icon: FlaskConical,
  module: "asistentes",
};

/** 015 — "Citas" solo existe si esta instancia encendió la agenda. */
const AGENDA_ITEM: NavItem = {
  href: "/bookings",
  label: "Citas",
  icon: CalendarDays,
  module: "agenda",
};

export function AppNav({
  branding,
  userName,
  role,
  theme,
  commit,
  agenda = false,
  lab = false,
  permissions,
  open = false,
  onClose,
}: {
  branding: Branding;
  userName: string;
  role: string;
  theme: ThemePreference;
  commit?: string;
  agenda?: boolean;
  lab?: boolean;
  permissions?: Record<AppModule, boolean>;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Estado de colapso y hover
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("crm.sidebar.collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  // Al navegar, si estaba en modo hover, replegarlo
  useEffect(() => {
    setHovered(false);
  }, [pathname]);

  // Si se presiona Escape y está en hover, replegarlo
  useEffect(() => {
    if (!hovered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHovered(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hovered]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("crm.sidebar.collapsed", String(next));
      if (!next) setHovered(false);
      return next;
    });
  };

  const handleMouseEnter = () => {
    if (!collapsed) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHovered(true);
    }, 60);
  };

  const handleMouseLeave = () => {
    if (!collapsed) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHovered(false);
    }, 150);
  };

  // Determinar si la barra debe renderizarse con contenido extendido
  const isExpanded = !collapsed || hovered;

  async function handleConfirmLogout() {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  }

  async function refetchUnread() {
    const res = await fetch("/api/conversations").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as {
      conversations: { unreadCount: number }[];
    };
    setUnread(data.conversations.reduce((a, c) => a + c.unreadCount, 0));
  }

  useEffect(() => {
    void refetchUnread();
  }, []);

  useEvents({
    onMessageNew: () => void refetchUnread(),
    onConversationUpdated: () => void refetchUnread(),
  });

  const sha = commit || BUILD_COMMIT;
  const settingsActive = pathname.startsWith("/settings");

  const baseItems = [...NAV];
  if (lab) baseItems.push(LAB_ITEM);
  const rawItems = agenda
    ? [...baseItems.slice(0, 2), AGENDA_ITEM, ...baseItems.slice(2)]
    : baseItems;

  const items = rawItems.filter((item) => {
    if (!item.module) return true;
    if (role === "owner") return true;
    if (!permissions) return true;
    return permissions[item.module] ?? false;
  });

  return (
    <div
      className={cn(
        "shrink-0",
        // En escritorio (lg+): el wrapper reserva exactamente el espacio en el layout flex
        collapsed ? "lg:w-[4.25rem]" : "lg:w-56",
        "lg:transition-[width] lg:duration-200 lg:ease-in-out"
      )}
    >
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          "flex flex-col border-r bg-subtle pb-3.5 pt-4 transition-[width,box-shadow,transform] duration-200 ease-in-out",
          // Móvil: cajón que se desliza desde la izquierda
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[17rem] max-lg:overflow-y-auto max-lg:px-3",
          open
            ? "max-lg:visible max-lg:translate-x-0 max-lg:shadow-pop"
            : "max-lg:invisible max-lg:-translate-x-full",
          // Escritorio
          "lg:h-full lg:overflow-y-auto lg:overflow-x-hidden",
          collapsed && hovered
            ? "lg:absolute lg:top-0 lg:bottom-0 lg:left-0 lg:z-40 lg:w-56 lg:px-3 lg:shadow-2xl"
            : collapsed
              ? "lg:static lg:w-[4.25rem] lg:px-2"
              : "lg:static lg:w-56 lg:px-3"
        )}
      >
        {/* Marca / Logo y botón de fijación/colapso */}
        <div
          className={cn(
            "mb-4 flex items-center pt-0.5",
            isExpanded ? "justify-between px-2" : "justify-center px-1"
          )}
        >
          {isExpanded ? (
            <>
              <div className="min-w-0 flex-1">
                <BrandLogo branding={branding} />
                <span className="kicker mt-1 block">CRM · WhatsApp</span>
              </div>
              {/* Cierre en móvil */}
              <button
                onClick={onClose}
                aria-label="Cerrar el menú"
                className="-ml-1 mt-0.5 rounded-md p-1.5 text-text-3 hover:bg-accent hover:text-foreground lg:hidden"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              {/* Botón Pin/Collapse en escritorio */}
              <button
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Fijar menú abierto" : "Colapsar menú"}
                title={
                  collapsed
                    ? "Fijar menú abierto"
                    : "Colapsar menú (expandir al pasar el mouse)"
                }
                className="hidden lg:flex rounded-md p-1.5 text-text-3 hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              >
                {collapsed ? (
                  <Pin className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={toggleCollapsed}
                title="Expandir y fijar menú"
                aria-label="Expandir y fijar menú"
                className="group relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent transition-colors cursor-pointer"
              >
                <BrandTile branding={branding} className="h-7 w-7 rounded-[7px] text-[13px]" />
              </button>
            </div>
          )}
        </div>

        {/* Elementos de Navegación */}
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!isExpanded ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-sm text-[13.5px] font-semibold transition-colors",
                  isExpanded
                    ? "gap-[10px] px-2.5 py-2"
                    : "h-10 w-full justify-center px-0",
                  active
                    ? "bg-brand-tint text-brand-text"
                    : "text-text-2 hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    active ? "text-brand" : "text-text-3 group-hover:text-foreground"
                  )}
                  strokeWidth={1.8}
                />
                {isExpanded && <span className="flex-1 truncate">{item.label}</span>}
                {item.badge && unread > 0 && (
                  isExpanded ? (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1.5 text-[10.5px] font-bold text-brand-fg">
                      {unread}
                    </span>
                  ) : (
                    <span
                      className="absolute right-2 top-2 flex h-2 w-2 rounded-full bg-brand"
                      title={`${unread} no leídos`}
                    />
                  )
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Sección Ajustes */}
        {(role === "owner" ||
          role === "admin" ||
          (permissions && (permissions.whatsapp || permissions.team))) && (
          <Link
            href="/settings"
            title={!isExpanded ? "Ajustes" : undefined}
            className={cn(
              "group relative mb-1 flex items-center rounded-sm text-[13.5px] font-semibold transition-colors",
              isExpanded
                ? "gap-[10px] px-2.5 py-2"
                : "h-10 w-full justify-center px-0",
              settingsActive
                ? "bg-brand-tint text-brand-text"
                : "text-text-2 hover:bg-accent hover:text-foreground"
            )}
          >
            <Settings
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                settingsActive ? "text-brand" : "text-text-3 group-hover:text-foreground"
              )}
              strokeWidth={1.8}
            />
            {isExpanded && <span className="flex-1 truncate">Ajustes</span>}
          </Link>
        )}

        {/* Usuario / Tema / Logout */}
        {isExpanded ? (
          <div className="mt-1 flex items-center gap-2 rounded-sm px-2 py-2 hover:bg-accent transition-colors">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-text">
              {initials(userName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{userName}</span>
              <span className="block truncate text-[11px] text-text-3">
                {role === "owner"
                  ? "Propietario"
                  : role === "admin"
                  ? "Administrador"
                  : "Operador"} · En línea
              </span>
            </span>
            <ThemeToggle initial={theme} />
            <button
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="rounded p-1 text-text-3 hover:text-foreground cursor-pointer"
              onClick={() => setShowLogoutModal(true)}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.7} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              onClick={() => setShowLogoutModal(true)}
              title={`${userName} (Cerrar sesión)`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-text hover:ring-2 hover:ring-brand/40 transition-all cursor-pointer"
            >
              {initials(userName)}
            </button>
          </div>
        )}

        {/* Qué versión está corriendo */}
        {isExpanded && (
          <p
            className="mt-2 px-2.5 font-mono text-[10.5px] tracking-[0.06em] text-text-2"
            title={
              sha
                ? `${branding.name} ${APP_VERSION}, construido del commit ${sha}`
                : `${branding.name} ${APP_VERSION}`
            }
          >
            {versionLabel(sha)}
          </p>
        )}

        {/* Modal de confirmación de cierre de sesión */}
        <LogoutModal
          isOpen={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleConfirmLogout}
          userName={userName}
          isLoggingOut={isLoggingOut}
        />
      </aside>
    </div>
  );
}
