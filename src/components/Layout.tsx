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
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
  { to: "/users", label: "Users", icon: Users },
];

export function Layout() {
  const navigate = useNavigate();
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
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">Signed in</span>
            <strong>{me.data?.user.username ?? "Admin"}</strong>
          </div>
          <button className="icon-text" onClick={() => logout.mutate()} type="button">
            <LogOut size={16} />
            Logout
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
