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
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET?.trim() || "http://localhost:8080";
  // Match API path segments, so /mcp does not capture the /mcp-access SPA page.
  const proxyPath = (path: string) => `^${escapeRegExp(`${apiBaseUrl}${path}`)}(?:/|\\?|$)`;
  const rewriteProxyPath = (path: string) => (stripApiBaseUrl ? path.replace(stripApiBaseUrl, "") : path);

  return {
    base: "./",
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        [proxyPath("/admin")]: {
          target: devProxyTarget,
          changeOrigin: true,
          rewrite: rewriteProxyPath,
        },
        [proxyPath("/api")]: {
          target: devProxyTarget,
          changeOrigin: true,
          rewrite: rewriteProxyPath,
        },
        ...Object.fromEntries(["/bailian", "/minimax", "/mcp"].map(path => [proxyPath(path), {
          target: devProxyTarget, changeOrigin: true, rewrite: rewriteProxyPath, timeout: 600000, proxyTimeout: 600000,
        }])),
        [proxyPath("/v1")]: {
          target: devProxyTarget,
          changeOrigin: true,
          rewrite: rewriteProxyPath,
        },
      },
    },
  };
});
