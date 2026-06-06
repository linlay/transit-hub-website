export type APIKey = {
  id: string;
  name: string;
  description: string;
  key_prefix: string;
  source: "admin" | "jwt";
  issuer_jti?: string;
  status: "active" | "disabled";
  expires_at?: string;
  forced_expired: boolean;
  request_quota: number;
  token_quota: number;
  allowed_models: string[];
  used_requests: number;
  used_tokens: number;
  last_used_at?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
};

export type JWTGrant = {
  jti: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  issue_quota: number;
  issued_count: number;
  issue_remaining: number;
  issue_unlimited: boolean;
  request_quota: number;
  token_quota: number;
  allowed_models: string[];
  jwt?: string;
  expires_at?: string;
  last_issued_at?: string;
  created_at: string;
  updated_at: string;
};

export type AdminUser = {
  id: string;
  username: string;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  last_login_at?: string;
};

export type TrafficBucket = {
  bucket: string;
  requests: number;
  request_tokens: number;
  response_tokens: number;
  total_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  cache_total_tokens: number;
  cache_hit_rate: number | null;
  cost_micro: number;
  error_requests: number;
  average_latency_ms: number;
};

export type Overview = {
  total_requests: number;
  total_tokens: number;
  request_tokens: number;
  response_tokens: number;
  total_cost_micro: number;
  error_requests: number;
  average_latency_ms: number;
  active_devices: number;
  api_keys: {
    total: number;
    active: number;
    disabled: number;
    deleted: number;
  };
  recent_traffic: TrafficBucket[];
  risk_keys: Array<{
    id: string;
    name: string;
    key_prefix: string;
    request_remaining: number;
    token_remaining: number;
    request_used_ratio: number;
    token_used_ratio: number;
  }>;
};

export type RequestLog = {
  id: number;
  api_key_id: string;
  api_key_name: string;
  protocol: string;
  public_model: string;
  upstream_model: string;
  provider: string;
  pool: string;
  account: string;
  device_id: string;
  source: string;
  status_code: number;
  latency_ms: number;
  request_tokens: number;
  response_tokens: number;
  total_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  cache_total_tokens: number;
  cache_hit_rate: number | null;
  cost_micro: number;
  estimated: boolean;
  error_type: string;
  created_at: string;
};

export type APISession = {
  api_key_id: string;
  api_key_name: string;
  key_prefix: string;
  device_id: string;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
  active: boolean;
  last_status_code: number;
  request_count: number;
  token_count: number;
};

export type ModelPrice = {
  id: string;
  protocol: string;
  public_model: string;
  input_cost_micro_per_1m_tokens: number;
  input_cache_hit_cost_micro_per_1m_tokens: number | null;
  output_cost_micro_per_1m_tokens: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type ProviderUsage = {
  provider: string;
  requests: number;
  request_tokens: number;
  response_tokens: number;
  total_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  cache_total_tokens: number;
  cache_hit_rate: number | null;
  cost_micro: number;
  error_requests: number;
  average_latency_ms: number;
};

export type ProviderAccountUsage = {
  provider: string;
  pool: string;
  account: string;
  requests: number;
  request_tokens: number;
  response_tokens: number;
  total_tokens: number;
  error_requests: number;
};

export type ProviderSnapshot = {
  providers: Array<{
    name: string;
    protocol: string;
    base_url: string;
    default_pool: string;
    models: Array<{
      public: string;
      upstream: string;
      pool: string;
      override_pool?: string;
      override_valid?: boolean;
    }>;
    pools: Array<{
      name: string;
      accounts: Array<{
        name: string;
        weight: number;
        circuit: Record<string, unknown>;
      }>;
    }>;
  }>;
};

export type ProviderConnectivityTestRequest = {
  provider: string;
  public_model?: string;
  pool?: string;
  account?: string;
};

export type ProviderConnectivityTestResult = {
  ok: boolean;
  provider: string;
  protocol: string;
  public_model: string;
  upstream_model: string;
  pool: string;
  account: string;
  endpoint: string;
  status_code: number;
  latency_ms: number;
  error?: string;
  tested_at: string;
};

export type PlaygroundChatRole = "system" | "user" | "assistant";

export type PlaygroundChatMessage = {
  role: PlaygroundChatRole;
  content: string;
};

export type PlaygroundChatRequest = {
  provider: string;
  public_model: string;
  pool?: string;
  account?: string;
  messages: PlaygroundChatMessage[];
  temperature?: number;
  max_tokens?: number;
};

export type PlaygroundChatMeta = {
  provider: string;
  protocol: string;
  public_model: string;
  upstream_model: string;
  pool: string;
  account: string;
  endpoint: string;
};

export type PlaygroundChatDone = {
  status_code: number;
  latency_ms: number;
};

export type ListResponse<T> = {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
};

export type ProviderUsageResponse = ListResponse<ProviderUsage> & {
  account_items: ProviderAccountUsage[];
};

export type APIKeyBatchResult = {
  action: "delete" | "inactive";
  matched: number;
  updated: number;
};
