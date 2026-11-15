export const enterpriseColumnLabels: Record<string, string> = {
  name: "Name", subject: "Employee ID", appointed_at: "Appointed at", ended_at: "Ended at",
  day: "Date", requests: "Requests", tokens: "Tokens", charged_microcredits: "Spend (Credits)",
  upstream_currency: "Upstream currency", upstream_cost_micros: "Upstream cost (micro units)",
  department_path: "Department path", virtual_org_name: "Virtual organization", policy_mode: "Policy mode",
  status: "Status", scope_type: "Budget scope", window: "Window", quota_microcredits: "Quota (Credits)",
  used_microcredits: "Used (Credits)", resets_at: "Resets at", started_at: "Started at", entry_label: "Entry type",
  principal_name: "Principal", principal_id: "Principal ID", public_model: "Public model", provider: "Provider",
  budget_owner_type: "Budget owner", billing_status: "Billing status", principal: "Principal", model: "Model",
  at: "Time", actor_name: "Actor", via: "Source", action: "Action", target_id: "Target ID", reason: "Reason",
  result: "Result", last4: "Last 4 characters", key_id: "Encryption key ID", no: "Attempt", pool: "Account pool",
  account: "Account", error_class: "Error class", duration_ms: "Duration (ms)", outcome: "Outcome",
  upstream_model: "Upstream model", currency: "Currency", pricing_kind: "Pricing kind", effective_from: "Effective from",
  billing: "Pricing rules", priority: "Priority", weight: "Weight", data_region: "Data region",
  enabled: "Status", enabled_accounts: "Enabled accounts", fired_at: "Triggered at", scope_id: "Scope ID", threshold: "Threshold (%)",
  notified_at: "Notified at", notify_error: "Notification error", path: "Department path", department: "Departments",
  owner: "Budget owner",
};

const labels: Record<string, string> = {
  read: "Read access", ops: "Channel operations", config: "Configuration management", principals: "Principal management", directory: "Directory management", "keys:reveal": "Reveal newly created keys",
  active: "Active", inactive: "Inactive", disabled: "Disabled", suspended: "Suspended", archived: "Archived",
  left: "Departed", default: "Follow defaults", custom: "Custom", personal: "Personal", virtual_org: "Virtual organization",
  project: "Project group", department: "Department-based", vo: "Organization", vm: "Member",
  vo_shadow: "Organization (shadow)", vm_shadow: "Member (shadow)", week: "Week", "5h": "5 hours",
  not_charged: "Not charged", upstream_unavailable: "Upstream unavailable", upstream_5xx: "Upstream server error",
  charged: "Charged", free: "Free", unavailable: "Unavailable", adjustment: "Report adjustment", usage: "Usage",
  gap: "Untracked usage", backfill: "Historical backfill", estimated: "Estimated", unknown: "Unknown",
  possible_extra: "Possible extra cost", plan: "Subscription plan", metered: "Metered", untracked: "Untracked usage",
  ok: "Succeeded", error: "Failed", denied: "Denied", previewed: "Previewed", recorded: "Recorded",
  committed: "Committed", retried: "Retried", final_failure: "Final failure", console: "Console", api: "API",
  mcp: "MCP", system: "System", domestic: "Domestic", overseas: "Overseas", unspecified: "Unspecified",
  open: "Circuit open", closed: "Circuit closed", "half-open": "Half-open", tokens: "Per token",
  image: "Per image", characters: "Per character", chat: "Chat", embedding: "Embedding",
  "image-generation": "Image generation", tts: "Speech synthesis", day: "Date", principal: "Principal",
  model: "Model", provider: "Provider", owner: "Budget owner", org: "Organization management", member: "Member",
  tools: "Tools", vision: "Vision", reasoning: "Reasoning", json_schema: "Structured output", streaming: "Streaming",
  "用量": "Usage", "未追踪用量": "Untracked usage", "报表调整": "Report adjustment", "历史回填": "Historical backfill",
};

export function enterpriseValueLabel(value: unknown): string {
  const text = String(value ?? "—");
  return labels[text] ?? text;
}

const enumColumns = new Set(["status", "policy_mode", "scope_type", "window", "entry_label", "budget_owner_type", "billing_status", "via", "result", "outcome", "pricing_kind", "data_region"]);
export function enterpriseCellValue(column: string, value: unknown, t: (key: string) => string): string {
  if (column === "enabled") return t(value === false ? "Disabled" : "Enabled");
  if (enumColumns.has(column)) return t(enterpriseValueLabel(value));
  return typeof value === "object" ? JSON.stringify(value) : String(value ?? "—");
}
