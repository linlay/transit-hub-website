import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  Cable,
  ChevronDown,
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
          <UserMenu username={me.data?.user.username ?? "Admin"} onLogout={() => logout.mutate()} />
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

function UserMenu({ username, onLogout }: { username: string; onLogout: () => void }) {
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
          <button onClick={onLogout} type="button">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}