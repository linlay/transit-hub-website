import { Activity, BadgeDollarSign, Boxes, Cable, Gauge, KeyRound, ServerCog, ShieldCheck, Users, type LucideIcon } from "lucide-react";

export type AdminRole = "super_admin" | "platform_admin" | "user";
type NavigationItem = { to: string; label: string; icon: LucideIcon; roles?: AdminRole[] };
export type NavigationGroup = { label: string; items: NavigationItem[] };
const administrators: AdminRole[] = ["super_admin", "platform_admin"];

const groups: NavigationGroup[] = [
  { label: "Overview", items: [
    { to: "/", label: "Dashboard", icon: Gauge, roles: administrators },
    { to: "/budget-alerts", label: "Budget alerts", icon: ShieldCheck },
  ] },
  { label: "Organization and access", items: [
    { to: "/organizations", label: "Virtual organizations", icon: Users },
    { to: "/directory", label: "Organization directory", icon: Users, roles: administrators },
    { to: "/employee-keys", label: "Authentication keys", icon: ShieldCheck, roles: administrators },
    { to: "/grant-keys", label: "Authorization keys", icon: KeyRound, roles: administrators },
    { to: "/managed-people", label: "Managed people", icon: Users, roles: ["user"] },
    { to: "/users", label: "Administrators", icon: Users, roles: ["super_admin"] },
  ] },
  { label: "Models and channels", items: [
    { to: "/models", label: "Models", icon: Boxes, roles: administrators },
    { to: "/providers", label: "Channels", icon: ServerCog, roles: administrators },
    { to: "/playground", label: "Playground", icon: Activity, roles: administrators },
  ] },
  { label: "Usage and billing", items: [
    { to: "/traffic", label: "Traffic", icon: Activity, roles: administrators },
    { to: "/sessions", label: "Sessions", icon: Cable, roles: administrators },
    { to: "/ledger", label: "Usage ledger", icon: BadgeDollarSign },
    { to: "/pricing", label: "Pricing", icon: BadgeDollarSign, roles: administrators },
    { to: "/upstream-pricing", label: "Upstream prices", icon: BadgeDollarSign, roles: administrators },
    { to: "/usage-audit", label: "Usage audit", icon: ShieldCheck, roles: administrators },
  ] },
  { label: "Audit and integrations", items: [
    { to: "/request-trace", label: "Request traces", icon: Activity, roles: administrators },
    { to: "/audit-logs", label: "Audit logs", icon: ShieldCheck },
    { to: "/mcp-access", label: "MCP access", icon: Cable },
  ] },
];

export function navigationGroups(role: AdminRole): NavigationGroup[] {
  const visible = groups.map(group => ({ ...group, items: group.items
    .filter(item => !item.roles || item.roles.includes(role))
    .map(item => role === "user" && item.to === "/organizations" ? { ...item, label: "My organizations" } : item),
  })).filter(group => group.items.length > 0);
  if (role === "user") {
    const index = visible.findIndex(group => group.label === "Organization and access");
    if (index > 0) visible.unshift(...visible.splice(index, 1));
  }
  return visible;
}

export function navigationLabel(pathname: string, role: AdminRole): string {
  const items = navigationGroups(role).flatMap(group => group.items);
  return (items.find(item => item.to === pathname) ?? items.find(item => item.to !== "/" && pathname.startsWith(item.to + "/")))?.label ?? "";
}
