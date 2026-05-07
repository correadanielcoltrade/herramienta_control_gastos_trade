import { BarChart3, ClipboardCheck, LogOut, Menu, PackagePlus, PanelLeftClose, PanelLeftOpen, QrCode, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import type { ModuleName } from "../types";
import { useAuth } from "../hooks/useAuth";
import { canAccessModule } from "../utils/access";

type NavItem = {
  to: string;
  label: string;
  icon: typeof BarChart3;
  module: ModuleName;
};

const navigation: NavItem[] = [
  { to: "/", label: "Dashboard", icon: BarChart3, module: "dashboard" },
  { to: "/abastecimiento", label: "Abastecimiento", icon: PackagePlus, module: "supply" },
  { to: "/scan", label: "Recibo de inventario de gastos", icon: QrCode, module: "scan" },
  { to: "/legalizacion", label: "Legalizacion", icon: ClipboardCheck, module: "legalization" },
  { to: "/admin", label: "Admin", icon: Shield, module: "admin" },
];

const DESKTOP_BREAKPOINT = "(min-width: 768px)";

type SidebarContentProps = {
  isCollapsed: boolean;
  onLogout: () => void;
  onNavigate: () => void;
  visibleNavigation: typeof navigation;
  user: ReturnType<typeof useAuth>["user"];
};

function getUserInitials(name?: string | null) {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "US";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SidebarContent({
  isCollapsed,
  onLogout,
  onNavigate,
  visibleNavigation,
  user,
}: SidebarContentProps) {
  const userInitials = getUserInitials(user?.nombre_usuario);

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex items-center gap-3 px-5 py-4 ${
          isCollapsed ? "justify-center md:px-3" : "justify-between md:block"
        }`}
      >
        <div>
          <p className={`text-xs uppercase text-brand-600 ${isCollapsed ? "tracking-[0.2em]" : "tracking-[0.35em]"}`}>
            Supli-Trade
          </p>
          <h1 className={`font-bold text-slate-900 ${isCollapsed ? "text-lg" : "text-2xl"}`}>
            {isCollapsed ? "ST" : "Serial control"}
          </h1>
        </div>
      </div>
      <div className={`flex flex-1 flex-col ${isCollapsed ? "px-2.5 pb-6 xl:px-2.5" : "px-5 pb-5 xl:px-6 xl:pb-7"}`}>
        <nav className={`mt-5 grid ${isCollapsed ? "grid-cols-1 gap-2.5" : "grid-cols-2 gap-3 md:grid-cols-1"} `}>
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={isCollapsed ? item.label : undefined}
                aria-label={item.label}
                className={({ isActive }) =>
                  `flex items-center rounded-2xl text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-600 text-white shadow-button"
                      : "bg-slate-100/70 text-slate-700 hover:bg-slate-200/50"
                  } ${isCollapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-3"}`
                }
              >
                <Icon size={18} />
                {!isCollapsed ? <span>{item.label}</span> : null}
              </NavLink>
            );
          })}
        </nav>
        <div className={`${isCollapsed ? "mt-auto flex flex-col items-center pt-6" : "mt-auto pt-6"}`}>
          {!isCollapsed ? (
            <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 px-4 py-4 text-white shadow-button xl:px-5 xl:py-5">
              <p className="text-sm text-brand-100">{user?.nombre_usuario}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.25em] text-brand-200">{user?.role.name}</p>
              <p className="mt-3 text-sm text-brand-50">{user?.cav?.nombre_cav ?? "Acceso global"}</p>
            </div>
          ) : (
            <div
              className="w-full max-w-[3.9rem] rounded-[26px] border border-brand-200 bg-white px-2 py-3 text-center text-slate-700 shadow-sm"
              title={`${user?.nombre_usuario ?? "Usuario"} | ${user?.role.name ?? ""}`}
              aria-label={user?.nombre_usuario ?? "Usuario"}
            >
              <div className="relative mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 text-sm font-semibold tracking-[0.16em] text-white shadow-button">
                <span>{userInitials}</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-accent-500" />
              </div>
              <p className="mt-2 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-slate-400">Perfil</p>
            </div>
          )}
          {!isCollapsed ? (
            <button
              type="button"
              className="mt-4 w-full rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 hover:border-brand-400"
              onClick={onLogout}
            >
              Salir
            </button>
          ) : (
            <button
              type="button"
              title={`Cerrar sesion de ${user?.nombre_usuario ?? "usuario"}`}
              aria-label="Cerrar sesion"
              className="mt-3 inline-flex h-10 w-full max-w-[3.9rem] items-center justify-center rounded-2xl border border-brand-200 bg-white text-brand-600 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
              onClick={onLogout}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(DESKTOP_BREAKPOINT).matches,
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia(DESKTOP_BREAKPOINT).matches,
  );
  const visibleNavigation = navigation.filter((item) =>
    canAccessModule(user?.role.name, item.module),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);

    const syncLayout = () => {
      const desktop = mediaQuery.matches;
      setIsDesktop(desktop);
      setIsSidebarOpen(desktop);
    };

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);

    return () => {
      mediaQuery.removeEventListener("change", syncLayout);
    };
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((current) => !current);
  };

  const closeSidebarOnMobile = () => {
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  };
  const isSidebarCollapsed = isDesktop && !isSidebarOpen;

  const sidebarToggleLabel = isSidebarOpen ? "Ocultar menu" : "Mostrar menu";
  const SidebarToggleIcon = isSidebarOpen ? PanelLeftClose : PanelLeftOpen;
  const MobileToggleIcon = isSidebarOpen ? X : Menu;

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,_#ffffff_0%,_#f3f0ff_50%,_#fdf2f8_100%)]">
      <button
        type="button"
        aria-controls="app-sidebar"
        aria-expanded={isSidebarOpen}
        aria-label={sidebarToggleLabel}
        className="fixed left-4 top-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/90 text-slate-700 shadow-panel backdrop-blur transition hover:-translate-y-0.5 hover:bg-white md:hidden"
        onClick={toggleSidebar}
      >
        <MobileToggleIcon size={20} />
      </button>

      {!isDesktop && isSidebarOpen ? (
        <button
          type="button"
          aria-label="Cerrar menu lateral"
          className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[1px] md:hidden"
          onClick={closeSidebarOnMobile}
        />
      ) : null}

      <div className="flex min-h-screen w-full xl:px-4 2xl:px-6">
        <aside
          id="app-sidebar"
          className={`fixed inset-y-0 left-0 z-40 w-[min(20rem,calc(100vw-1.5rem))] border-r border-white/60 bg-white/90 backdrop-blur transition-[transform,width] duration-300 md:sticky md:top-0 md:h-screen md:w-auto md:shrink-0 md:overflow-hidden md:border-b-0 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${isSidebarOpen ? "md:basis-80" : "md:basis-20"}`}
        >
          <div className="h-full overflow-y-auto transition-opacity duration-200">
            <SidebarContent
              isCollapsed={isSidebarCollapsed}
              onLogout={logout}
              onNavigate={closeSidebarOnMobile}
              user={user}
              visibleNavigation={visibleNavigation}
            />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 xl:px-10 xl:py-8 2xl:px-14">
          <div className="w-full">
            <div className="mb-5 hidden items-center justify-between gap-3 md:flex">
              <button
                type="button"
                aria-controls="app-sidebar"
                aria-expanded={isSidebarOpen}
                className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/85 px-4 py-2 text-sm font-medium text-brand-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                onClick={toggleSidebar}
              >
                <SidebarToggleIcon size={17} />
                <span>{sidebarToggleLabel}</span>
              </button>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
