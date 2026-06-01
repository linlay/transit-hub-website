import type {
  AdminUser,
  APIKey,
  APISession,
  ListResponse,
  ModelPrice,
  Overview,
  ProviderSnapshot,
  RequestLog,
  TrafficBucket,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (body: { username: string; password: string }) =>
    request<{ user: AdminUser }>("/admin/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<{ user: AdminUser }>("/admin/auth/me"),
  logout: () => request<{ status: string }>("/admin/auth/logout", { method: "POST" }),
  overview: () => request<Overview>("/admin/overview"),
  apiKeys: (query?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<APIKey>>("/admin/api-keys", { query }),
  apiKey: (id: string) => request<APIKey>(`/admin/api-keys/${id}`),
  createAPIKey: (body: Partial<APIKey>) =>
    request<APIKey & { key: string }>("/admin/api-keys", { method: "POST", body: JSON.stringify(body) }),
  updateAPIKey: (id: string, body: Partial<APIKey>) =>
    request<APIKey>(`/admin/api-keys/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAPIKey: (id: string) => request<APIKey>(`/admin/api-keys/${id}`, { method: "DELETE" }),
  apiKeyUsage: (id: string) => request<{ key: APIKey; summary: TrafficBucket; recent_traffic: TrafficBucket[]; active_devices: number }>(`/admin/api-keys/${id}/usage`),
  apiKeyLogs: (id: string, query?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<RequestLog>>(`/admin/api-keys/${id}/logs`, { query }),
  apiKeySessions: (id: string, query?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<APISession>>(`/admin/api-keys/${id}/sessions`, { query }),
  traffic: (query?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<TrafficBucket>>("/admin/traffic", { query }),
  logs: (query?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<RequestLog>>("/admin/logs", { query }),
  sessions: (query?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<APISession>>("/admin/sessions", { query }),
  prices: () => request<ListResponse<ModelPrice>>("/admin/model-prices"),
  createPrice: (body: Partial<ModelPrice>) =>
    request<ModelPrice>("/admin/model-prices", { method: "POST", body: JSON.stringify(body) }),
  updatePrice: (id: string, body: Partial<ModelPrice>) =>
    request<ModelPrice>(`/admin/model-prices/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePrice: (id: string) => request<{ status: string }>(`/admin/model-prices/${id}`, { method: "DELETE" }),
  providers: () => request<ProviderSnapshot>("/admin/providers"),
  users: () => request<ListResponse<AdminUser>>("/admin/users"),
  createUser: (body: { username: string; password: string; status?: string }) =>
    request<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: Partial<AdminUser> & { password?: string }) =>
    request<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteUser: (id: string) => request<AdminUser>(`/admin/users/${id}`, { method: "DELETE" }),
};
