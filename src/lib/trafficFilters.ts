export function trafficTimeRange(range: string, from: string, to: string, offset: number, now: number) {
  const day = 86_400_000;
  const shift = offset * 60_000;
  const today = Math.floor((now + shift) / day) * day - shift;
  let start = today;
  let end = now;
  if (range === "yesterday") { start -= day; end = today; }
  if (range === "7d") start -= 6 * day;
  if (range === "30d") start -= 29 * day;
  if (range === "custom") {
    const parse = (date: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
      const parsed = Date.parse(`${date}T00:00:00Z`);
      return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date ? parsed - shift : NaN;
    };
    start = parse(from); end = parse(to) + day;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString() };
}

export function trafficSelections(raw: string | null): string[] {
  try {
    const values: unknown = JSON.parse(raw || "[]");
    return Array.isArray(values) ? [...new Set(values.filter((value): value is string => typeof value === "string"))].slice(0, 100) : [];
  } catch { return []; }
}
