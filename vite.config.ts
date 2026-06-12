import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBaseUrl(value: string | undefined): string {
  const raw = (value ?? "/").trim();
  if (!raw || raw === "/") return "/";

  const path = /^https?:\/\//i.test(raw) ? new URL(raw).pathname : raw;
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");

  return withoutTrailingSlash || "/";
}

function normalizeViteBase(value: string | undefined): string {
  const baseUrl = normalizeBaseUrl(value);
  return baseUrl === "/" ? "/" : `${baseUrl}/`;
}

function normalizeApiBaseUrl(value: string | undefined, fallbackBaseUrl: string): string {
  const raw = value?.trim();
  if (!raw) return fallbackBaseUrl === "/" ? "" : fallbackBaseUrl;
  if (/^https?:\/\//i.test(raw)) return "";

  const baseUrl = normalizeBaseUrl(raw);
  return baseUrl === "/" ? "" : baseUrl;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const baseUrl = normalizeBaseUrl(env.VITE_BASE_URL);
  const apiBaseUrl = normalizeApiBaseUrl(env.VITE_API_BASE_URL, baseUrl);
  const stripApiBaseUrl = apiBaseUrl ? new RegExp(`^${escapeRegExp(apiBaseUrl)}`) : null;
  const proxyPath = (path: string) => `${apiBaseUrl}${path}`;
  const rewriteProxyPath = (path: string) => (stripApiBaseUrl ? path.replace(stripApiBaseUrl, "") : path);

  return {
    base: normalizeViteBase(baseUrl),
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        [proxyPath("/admin")]: {
          target: "http://localhost:8080",
          changeOrigin: true,
          rewrite: rewriteProxyPath,
        },
        [proxyPath("/api")]: {
          target: "http://localhost:8080",
          changeOrigin: true,
          rewrite: rewriteProxyPath,
        },
        [proxyPath("/v1")]: {
          target: "http://localhost:8080",
          changeOrigin: true,
          rewrite: rewriteProxyPath,
        },
      },
    },
  };
});
