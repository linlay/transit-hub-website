import { createContext, useCallback, useContext, useEffect, useRef, useState, type DependencyList, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Activity,
  BadgeDollarSign,
  Cable,
  ChevronDown,
  Gauge,
  KeyRound,
  LogOut,
  Moon,
  Monitor,
  RadioTower,
  ServerCog,
  Sun,
  Languages,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useTheme, type ThemePreference } from "../lib/theme";

const nav = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/jwt-grants", label: "JWT Grants", icon: KeyRound },
  { to: "/sessions", label: "Sessions", icon: Cable },
  { to: "/traffic", label: "Traffic", icon: Activity },
  { to: "/pricing", label: "Pricing", icon: BadgeDollarSign },
  { to: "/providers", label: "Providers", icon: ServerCog },
  { to: "/playground", label: "Playground", icon: Activity },
  { to: "/users", label: "Users", icon: Users },
];

function currentPageLabel(pathname: string): string {
  // Exact match first
  const exact = nav.find((item) => item.to === pathname);
  if (exact) return exact.label;
  // Prefix match for detail pages (e.g. /api-keys/xxx → "API Keys")
  const prefix = nav.find((item) => item.to !== "/" && pathname.startsWith(item.to + "/"));
  if (prefix) return prefix.label;
  return "";
}

const PageActionsContext = createContext<Dispatch<SetStateAction<ReactNode>> | null>(null);

export function usePageActions(actions: ReactNode, dependencies: DependencyList) {
  const setPageActions = useContext(PageActionsContext);

  useEffect(() => {
    if (!setPageActions) return;
    setPageActions(actions);
    return () => setPageActions(null);
  }, [setPageActions, ...dependencies]);
}

export function Layout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [pageActions, setPageActions] = useState<ReactNode>(null);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  return (
    <PageActionsContext.Provider value={setPageActions}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <RadioTower size={20} />
            </div>
            <div>
              <strong>{t("Transit Hub")}</strong>
              <span>{t("Admin Console")}</span>
            </div>
          </div>
          <nav>
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                <item.icon size={18} />
                <span>{t(item.label)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <UserMenu username={me.data?.user.username ?? t("Admin")} onLogout={() => logout.mutate()} />
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <span className="topbar-page">{t(currentPageLabel(location.pathname))}</span>
            <div className="topbar-actions">{pageActions}</div>
          </header>
          <Outlet />
        </main>
      </div>
    </PageActionsContext.Provider>
  );
}

function UserMenu({ username, onLogout }: { username: string; onLogout: () => void }) {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open, handleClickOutside]);

  return (
    <div className="sidebar-user-menu" ref={menuRef}>
      <button className="sidebar-user-trigger" onClick={() => setOpen((v) => !v)} type="button">
        <LogOut size={16} />
        <span className="trigger-label">{username}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="sidebar-user-dropdown">
          <label className="sidebar-menu-select">
            <span>
              <Languages size={16} />
              {t("Language")}
            </span>
            <select aria-label={t("Language")} value={locale} onChange={(event) => setLocale(event.target.value === "zh-CN" ? "zh-CN" : "en-US")}>
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <label className="sidebar-menu-select">
            <span>
              {themeIcon(theme)}
              {t("Theme")}
            </span>
            <select aria-label={t("Theme")} value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
              <option value="system">{t("System")}</option>
              <option value="light">{t("Light")}</option>
              <option value="dark">{t("Dark")}</option>
            </select>
          </label>
          <button onClick={onLogout} type="button">
            <LogOut size={16} />
            {t("Logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function themeIcon(theme: ThemePreference) {
  if (theme === "light") return <Sun size={15} />;
  if (theme === "dark") return <Moon size={15} />;
  return <Monitor size={15} />;
}
