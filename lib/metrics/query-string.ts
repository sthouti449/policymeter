import type { Filters } from "./types";

/** Filters -> "?from=...&to=..." for /api/metrics, /api/calls and the CSV link. */
export function filtersToQuery(f: Filters, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams({ from: f.from, to: f.to, includeSimulated: String(f.includeSimulated) });
  if (f.agency) p.set("agency", f.agency);
  if (f.useCase) p.set("useCase", f.useCase);
  if (f.model) p.set("model", f.model);
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  return `?${p.toString()}`;
}

export type Preset = "7d" | "30d" | "mtd";

/** Preset -> inclusive UTC date range ending today. */
export function presetRange(preset: Preset, now = new Date()): { from: string; to: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const to = iso(now);
  if (preset === "mtd") return { from: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))), to };
  const days = preset === "7d" ? 6 : 29; // inclusive of today
  return { from: iso(new Date(now.getTime() - days * 86_400_000)), to };
}
