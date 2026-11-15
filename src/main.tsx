import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { QueryFeedback } from "./components/QueryFeedback";
import { ConfirmProvider } from "./components/ConfirmProvider";
import { TooltipProvider } from "./components/TooltipProvider";
import { api, APIError } from "./lib/api";
import { APP_BASE_URL } from "./lib/env";
import { I18nProvider, useI18n } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import "./styles.css";

const APIKeyDetail = React.lazy(() => import("./pages/APIKeyDetail").then(module => ({ default: module.APIKeyDetail })));
const GrantKeys = React.lazy(() => import("./pages/GrantKeys").then(module => ({ default: module.GrantKeys })));
const LegacyGrantKeysRedirect = React.lazy(() => import("./pages/GrantKeys").then(module => ({ default: module.LegacyGrantKeysRedirect })));
const EmployeeKeys = React.lazy(() => import("./pages/EmployeeKeys").then(module => ({ default: module.EmployeeKeys })));
const Dashboard = React.lazy(() => import("./pages/Dashboard").then(module => ({ default: module.Dashboard })));
const Login = React.lazy(() => import("./pages/Login").then(module => ({ default: module.Login })));
const ModelDetail = React.lazy(() => import("./pages/ModelDetail").then(module => ({ default: module.ModelDetail })));
const Models = React.lazy(() => import("./pages/Models").then(module => ({ default: module.Models })));
const Pricing = React.lazy(() => import("./pages/Pricing").then(module => ({ default: module.Pricing })));
const Playground = React.lazy(() => import("./pages/Playground").then(module => ({ default: module.Playground })));
const Channels = React.lazy(() => import("./pages/Channels").then(module => ({ default: module.Channels })));
const Sessions = React.lazy(() => import("./pages/Sessions").then(module => ({ default: module.Sessions })));
const Traffic = React.lazy(() => import("./pages/Traffic").then(module => ({ default: module.Traffic })));
const UsageAudit = React.lazy(() => import("./pages/UsageAudit").then(module => ({ default: module.UsageAudit })));
const ManagedPeople = React.lazy(() => import("./pages/ManagedPeople").then(module => ({ default: module.ManagedPeople })));
const Users = React.lazy(() => import("./pages/Users").then(module => ({ default: module.Users })));
const Organizations = React.lazy(() => import("./pages/Enterprise").then(module => ({ default: module.Organizations })));
const OrganizationDetail = React.lazy(() => import("./pages/Enterprise").then(module => ({ default: module.OrganizationDetail })));
const Directory = React.lazy(() => import("./pages/Directory").then(module => ({ default: module.Directory })));
const Ledger = React.lazy(() => import("./pages/Ledger").then(module => ({ default: module.Ledger })));
const AuditLogs = React.lazy(() => import("./pages/AuditLogs").then(module => ({ default: module.AuditLogs })));
const MCPAccess = React.lazy(() => import("./pages/MCPAccess").then(module => ({ default: module.MCPAccess })));
const RequestTrace = React.lazy(() => import("./pages/RequestTrace").then(module => ({ default: module.RequestTrace })));
const LoginTicket = React.lazy(() => import("./pages/Enterprise").then(module => ({ default: module.LoginTicket })));
const UpstreamPricing = React.lazy(() => import("./pages/UpstreamPricing").then(module => ({ default: module.UpstreamPricing })));
const Routing = React.lazy(() => import("./pages/Enterprise").then(module => ({ default: module.Routing })));
const BudgetAlerts = React.lazy(() => import("./pages/Enterprise").then(module => ({ default: module.BudgetAlerts })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 15_000,
    },
  },
});

function RequireAuth() {
  const { t } = useI18n();
  const location = useLocation();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  if (me.isLoading) return <div className="boot">{t("Loading Transit Hub...")}</div>;
  if (me.error instanceof APIError && me.error.status === 401) return <Navigate to="/login" replace />;
  if (me.isError) return <div className="boot"><QueryFeedback query={me} /></div>;
  const role = me.data?.role ?? "super_admin";
  if (role === "user" && !["/organizations", "/managed-people", "/ledger", "/audit-logs", "/mcp-access", "/budget-alerts"].some(path => location.pathname === path || location.pathname.startsWith(path + "/"))) return <Navigate to={me.data?.managed_orgs?.length === 0 && me.data?.managed_principals?.length ? "/managed-people" : "/organizations"} replace />;
  if (role === "platform_admin" && location.pathname.startsWith("/users")) return <Navigate to="/organizations" replace />;
  return <Layout />;
}

function LoadingScreen() {
  const { t } = useI18n();
  return <div className="boot">{t("Loading...")}</div>;
}

function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ConfirmProvider>
              <BrowserRouter basename={APP_BASE_URL}>
                <React.Suspense fallback={<LoadingScreen />}><Routes>
                  <Route path="/login" element={<Login />} />
<Route path="/login/ticket" element={<LoginTicket />} />
                  <Route element={<RequireAuth />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/models" element={<Models />} />
                    <Route path="/models/:protocol/:modelId" element={<ModelDetail />} />
                    <Route path="/models/:protocol/:modelId/routing" element={<Routing />} />
                    <Route path="/grant-keys" element={<GrantKeys />} />
                    <Route path="/employee-keys" element={<EmployeeKeys />} />
                    <Route path="/employee-keys/:id" element={<APIKeyDetail />} />
                    <Route path="/grant-keys/:id" element={<APIKeyDetail />} />
                    <Route path="/api-keys" element={<LegacyGrantKeysRedirect />} />
                    <Route path="/api-keys/:id" element={<LegacyGrantKeysRedirect />} />
                    <Route path="/jwt-grants" element={<LegacyGrantKeysRedirect />} />
                    <Route path="/sessions" element={<Sessions />} />
                    <Route path="/traffic" element={<Traffic />} />
                    <Route path="/usage-audit" element={<UsageAudit />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/providers" element={<Channels />} />
                    <Route path="/playground" element={<Playground />} />
                    <Route path="/provider-tests" element={<Navigate to="/playground" replace />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/managed-people" element={<ManagedPeople />} />
                    <Route path="/organizations" element={<Organizations />} />
                    <Route path="/organizations/:id" element={<OrganizationDetail />} />
                    <Route path="/directory" element={<Directory />} />
                    <Route path="/ledger" element={<Ledger />} />
                    <Route path="/audit-logs" element={<AuditLogs />} />
                    <Route path="/mcp-access" element={<MCPAccess />} />
                    <Route path="/provider-configuration" element={<Navigate to="/providers?tab=configuration" replace />} />
                    <Route path="/request-trace" element={<RequestTrace />} />
                    <Route path="/upstream-pricing" element={<UpstreamPricing />} />
                    <Route path="/routing" element={<Navigate to="/models" replace />} />
<Route path="/budget-alerts" element={<BudgetAlerts />} />
                  </Route>
                </Routes></React.Suspense>
              </BrowserRouter>
            </ConfirmProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
