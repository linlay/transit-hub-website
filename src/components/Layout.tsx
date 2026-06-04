import {
  Activity,
  BadgeDollarSign,
  Cable,
  Gauge,
  KeyRound,
  LogOut,
  RadioTower,
  ServerCog,
  Users,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

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

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      await queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <RadioTower size={20} />
          </div>
          <div>
            <strong>Transit Hub</strong>
            <span>Admin Console</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="icon-text sidebar-logout" onClick={() => logout.mutate()} type="button">
            <LogOut size={16} />
            {me.data?.user.username ?? "Admin"} · Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className="topbar-page">{currentPageLabel(location.pathname)}</span>
        </header>
        <Outlet />
      </main>
    </div>
  );
}