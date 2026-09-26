// Keep the original chart palette; arbitrary hues can cluster around one color.
const MODEL_COLORS = ["#0a84ff", "#7c3aed", "#f97316", "#0891b2", "#db2777", "#d97706", "#4f46e5", "#dc2626"];
const STORAGE_KEY = "transit-hub.model-colors.v1";
let colors: Map<string, string> | undefined;

/** Assign colors in first-seen order, then preserve them across ranges and reloads. */
export function modelColor(model: string): string {
  if (!colors) {
    colors = new Map();
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(saved)) {
        for (const entry of saved) {
          if (Array.isArray(entry) && typeof entry[0] === "string" && MODEL_COLORS.includes(entry[1])) colors.set(entry[0], entry[1]);
        }
      }
    } catch { /* Storage may be unavailable; keep colors stable for this session. */ }
  }
  const existing = colors.get(model);
  if (existing) return existing;
  const color = MODEL_COLORS[colors.size % MODEL_COLORS.length];
  colors.set(model, color);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...colors])); }
  catch { /* The in-memory assignment still works when storage is unavailable. */ }
  return color;
}
