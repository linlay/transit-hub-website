import { API_BASE_URL } from "./env";
import { APIError } from "./api";

export type Row = Record<string, unknown>;
export type ProviderDocument = { name: string; yaml: string; revision: number };
export type Organization = {
  id: string; code: string; name: string; description: string; org_type: "project" | "department";
  source_department_id: string; admin_vacant?:boolean; include_subdepartments?:boolean; status: "active" | "suspended" | "archived"; revision: number;
  weekly_quota_microcredits: string; five_hour_quota_microcredits: string;
  default_member_weekly_cap_microcredits: string; default_member_five_hour_cap_microcredits: string;
  models_mode: "member" | "org"; allowed_models: string[]; alert_thresholds: number[]; webhook_url: string;
};
export async function enterpriseRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method, credentials: "include", headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new APIError(payload.error ?? `Request failed: ${response.status}`, response.status);
  return payload as T;
}
export function credits(value: unknown): string {
  try {
    const n = BigInt(String(value ?? "0")); const negative = n < 0; const a = negative ? -n : n;
    return `${negative ? "−" : ""}${a / 1000000n}.${String(a % 1000000n).padStart(6, "0").replace(/0+$/, "") || "0"}`;
  } catch { return "—"; }
}
export function microcredits(value: string): string {
  if (!/^-?\d+(\.\d{0,6})?$/.test(value)) throw new Error("Supports up to 6 decimal places");
  const negative = value.startsWith("-"); const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  return String((BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"))) * (negative ? -1n : 1n));
}
