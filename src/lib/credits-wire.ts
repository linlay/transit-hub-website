// The wire contract uses integer strings. The UI works with checked safe integers;
// never silently round a large balance or a submitted price through Number().
function isAmount(key: string) {
  return key.includes("microcredits") && key !== "microcredits_per_credit";
}

export function encodeCreditsJSON(value: unknown): string {
  return JSON.stringify(value, (key, item) => {
    if (!isAmount(key) || item == null) return item;
    if (typeof item !== "number" || !Number.isSafeInteger(item)) {
      throw new Error(`Invalid Credits amount: ${key}`);
    }
    return String(item);
  });
}

export function decodeCreditsJSON(text: string): unknown {
  return JSON.parse(text, (key, item) => {
    if (!isAmount(key) || item == null) return item;
    if (typeof item !== "string" || !/^-?\d+$/.test(item)) {
      throw new Error(`Invalid Credits contract: ${key}`);
    }
    const value = Number(item);
    if (!Number.isSafeInteger(value)) throw new Error(`Credits amount exceeds UI precision: ${key}`);
    return value;
  });
}
