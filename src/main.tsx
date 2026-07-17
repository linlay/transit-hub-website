import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { api } from "./lib/api";
import { APP_BASE_URL } from "./lib/env";
import { I18nProvider, useI18n } from "./lib/i18n";
import { ThemeProvider } from "./lib/theme";
import { APIKeyDetail } from "./pages/APIKeyDetail";
import { APIKeys } from "./pages/APIKeys";
import { Dashboard } from "./pages/Dashboard";
import { JWTGrants } from "./pages/JWTGrants";
import { Login } from "./pages/Login";
import { ModelDetail } from "./pages/ModelDetail";
import { Models } from "./pages/Models";
import { Pricing } from "./pages/Pricing";
import { Playground } from "./pages/Playground";
import { Providers } from "./pages/Providers";
import { Sessions } from "./pages/Sessions";
import { Traffic } from "./pages/Traffic";
import { Users } from "./pages/Users";
import "./styles.css";

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
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  if (me.isLoading) return <div className="boot">{t("Loading Transit Hub...")}</div>;
  if (me.isError) return <Navigate to="/login" replace />;
  return <Layout />;
}

function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={APP_BASE_URL}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/models" element={<Models />} />
                <Route path="/models/:protocol/:modelId" element={<ModelDetail />} />
                <Route path="/api-keys" element={<APIKeys />} />
                <Route path="/api-keys/:id" element={<APIKeyDetail />} />
                <Route path="/jwt-grants" element={<JWTGrants />} />
                <Route path="/sessions" element={<Sessions />} />
                <Route path="/traffic" element={<Traffic />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/providers" element={<Providers />} />
                <Route path="/playground" element={<Playground />} />
                <Route path="/provider-tests" element={<Navigate to="/playground" replace />} />
                <Route path="/users" element={<Users />} />
              </Route>
            </Routes>
          </BrowserRouter>
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
