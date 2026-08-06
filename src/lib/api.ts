import type {
  AdminModel,
  AdminUser,
  APIKeyBatchResult,
  APIKey,
  APISession,
  JWTGrant,
  ListResponse,
  ModelPrice,
  Overview,
  PlaygroundChatRequest,
  ProviderConnectivityTestRequest,
  ProviderConnectivityTestResult,
  ProviderQuotaResponse,
  ProviderSnapshot,
  ProviderUsageResponse,
  ProviderUsage,
  RateLimit,
  RateLimitUsage,
  RequestLog,
  TrafficBucket,
} from "./types";
import { API_BASE_URL } from "./env";

const API_BASE = API_BASE_URL;

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | undefined>;
};

export class APIError extends Error {
  readonly status: number;
  readonly component?: string;

  constructor(message: string, status: number, component?: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.component = component;
  }
}

export function isTelemetryError(error: unknown) {
  return error instanceof APIError && error.component === "telemetry";
}

function apiURL(path: string, query?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = apiURL(path, options.query);
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; component?: string };
    throw new APIError(payload.error ?? `Request failed: ${response.status}`, response.status, payload.component);
  }
  return response.json() as Promise<T>;
}

async function requestStream(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(apiURL(path), {
    method: "POST",
    credentials: "include",
    signal,
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; component?: string };
    throw new APIError(payload.error ?? `Request failed: ${response.status}`, response.status, payload.component);
  }
  if (!response.body) {
    throw new Error("Streaming response is unavailable");
  }
  return response;
}

export const api = {
  login: (body: { username: string; password: string }) =>
    request<{ user: AdminUser }>("/admin/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<{ user: AdminUser }>("/admin/auth/me"),
  logout: () => request<{ status: string }>("/admin/auth/logout", { method: "POST" }),
  overview: (query?: Record<string, string | number | boolean | undefined>) =>
    request<Overview>("/admin/overview", { query }),
  apiKeys: (query?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<APIKey>>("/admin/api-keys", { query }),
  apiKey: (id: string) => request<APIKey>(`/admin/api-keys/${id}`),
  createAPIKey: (body: Partial<APIKey>) =>
    request<APIKey & { key: string }>("/admin/api-keys", { method: "POST", body: JSON.stringify(body) }),
  updateAPIKey: (id: string, body: Partial<APIKey>) =>
    request<APIKey>(`/admin/api-keys/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteAPIKey: (id: string) => request<APIKey>(`/admin/api-keys/${id}`, { method: "DELETE" }),
  batchAPIKeys: (body: { action: "delete" | "inactive"; ids?: string[]; issuer_jti?: string }) =>
    request<APIKeyBatchResult>("/admin/api-keys/batch", { method: "POST", body: JSON.stringify(body) }),
  jwtGrants: (query?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<JWTGrant>>("/admin/jwt-grants", { query }),
  jwtGrant: (jti: string) => request<JWTGrant>(`/admin/jwt-grants/${jti}`),
  createJWTGrant: (body: { name: string; description?: string; issue_quota: number; request_quota: number; token_quota: number; allowed_models: string[]; rate_limits?: RateLimit[] }) =>
    request<JWTGrant & { jwt: string }>("/admin/jwt-grants", { method: "POST", body: JSON.stringify(body) }),
  updateJWTGrant: (jti: string, body: Record<string, unknown>) =>
    request<JWTGrant>(`/admin/jwt-grants/${jti}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteJWTGrant: (jti: string, query?: { delete_api_keys?: boolean }) =>
    request<JWTGrant>(`/admin/jwt-grants/${jti}`, { method: "DELETE", query }),
  apiKeyUsage: (id: string) =>
    request<{
      key: APIKey;
      summary: TrafficBucket;
      recent_traffic: TrafficBucket[];
      active_devices: number;
      rate_limit_usage: RateLimitUsage[];
      degraded_components?: string[];
    }>(`/admin/api-keys/${id}/usage`),
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
  models: () => request<ListResponse<AdminModel>>("/admin/models"),
  model: (protocol: string, publicModel: string) =>
    request<AdminModel>("/admin/models/detail", { query: { protocol, public_model: publicModel } }),
  providers: () => request<ProviderSnapshot>("/admin/providers"),
  testProviderConnectivity: (body: ProviderConnectivityTestRequest) =>
    request<ProviderConnectivityTestResult>("/admin/providers/test", { method: "POST", body: JSON.stringify(body) }),
  playgroundChat: (body: PlaygroundChatRequest, signal?: AbortSignal) =>
    requestStream("/admin/playground/chat", body, signal),
  providerUsage: (query?: Record<string, string | number | boolean | undefined>) =>
    request<ProviderUsageResponse>("/admin/providers/usage", { query }),
  providerQuota: () => request<ProviderQuotaResponse>("/admin/providers/quota"),
  users: () => request<ListResponse<AdminUser>>("/admin/users"),
  createUser: (body: { username: string; password: string; status?: string }) =>
    request<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: Partial<AdminUser> & { password?: string }) =>
    request<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteUser: (id: string) => request<AdminUser>(`/admin/users/${id}`, { method: "DELETE" }),
};
