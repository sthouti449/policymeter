/** Money: 4 decimals under $1 (so $0.0004 shows), 2 decimals from $1 up. */
export function formatCost(usd: number): string {
  // A real but tiny cost (one embedding is ~$0.000001) must not read as $0.0000, which looks free.
  if (usd > 0 && usd < 0.00005) return "<$0.0001";
  return `$${Math.abs(usd) < 1 ? usd.toFixed(4) : usd.toFixed(2)}`;
}

/** Axis ticks: trim trailing zeros but keep 2 decimals, so $0.0400 reads $0.04 and $0.0004 stays $0.0004. */
export function formatAxisCost(usd: number): string {
  if (usd === 0) return "$0";
  if (Math.abs(usd) >= 1) return `$${usd.toFixed(2)}`;
  // "0.0400" -> "0.04", "0.0125" stays, "0.2500" -> "0.25" (keep at least 2 decimals).
  return `$${usd.toFixed(4).replace(/(\.\d\d)00$/, "$1").replace(/(\.\d\d\d)0$/, "$1")}`;
}

export const formatInt = (n: number) => Math.round(n).toLocaleString("en-US");

/** 1,284 / 12.9K / 3.4M, for axis ticks and tiles where space is tight. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs < 10_000) return formatInt(n);
  if (abs < 1_000_000) return `${(n / 1000).toFixed(abs < 100_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export const formatMs = (ms: number | null | undefined) =>
  ms == null ? "n/a" : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
