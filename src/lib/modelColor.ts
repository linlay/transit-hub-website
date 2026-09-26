/** Stable across ranking changes, date ranges, page visits and reloads. */
export function modelColor(model: string): string {
  let hash = 2166136261;
  for (let index = 0; index < model.length; index++) {
    hash = Math.imul(hash ^ model.charCodeAt(index), 16777619);
  }
  const hue = (hash >>> 0) % 360;
  return `hsl(${hue} 68% 52%)`;
}
