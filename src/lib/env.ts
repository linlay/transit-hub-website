export function normalizeBaseUrl(value: string | undefined): string {
  const raw = (value ?? "/").trim();
  if (!raw || raw === "/") return "/";

  const path = /^https?:\/\//i.test(raw) ? new URL(raw).pathname : raw;
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");

  return withoutTrailingSlash || "/";
}

export function normalizeViteBase(value: string | undefined): string {
  const baseUrl = normalizeBaseUrl(value);
  return baseUrl === "/" ? "/" : `${baseUrl}/`;
}

export function normalizeApiBaseUrl(value: string | undefined, fallbackBaseUrl: string): string {
  const raw = value?.trim();
  if (!raw) return fallbackBaseUrl === "/" ? "" : fallbackBaseUrl;

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }

  const baseUrl = normalizeBaseUrl(raw);
  return baseUrl === "/" ? "" : baseUrl;
}

export const APP_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_BASE_URL);
export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL, APP_BASE_URL);
