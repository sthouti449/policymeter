import type { DailyRow } from "./types";

export type DayPoint = { day: string } & Record<string, number | string>;

/** Every date from..to inclusive (YYYY-MM-DD), so days with no spend still appear on the axis. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Wide rows for a stacked chart: { day, VITA: 0.01, DMV: 0, ... }. Every agency
 * is present on every day (zero when idle), so stack order and colors never move.
 */
export function toDailySeries(rows: DailyRow[], from: string, to: string, agencies: string[]): DayPoint[] {
  const byDay = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = byDay.get(r.day) ?? new Map<string, number>();
    m.set(r.agency, (m.get(r.agency) ?? 0) + r.costUsd);
    byDay.set(r.day, m);
  }
  return eachDay(from, to).map((day) => {
    const point: DayPoint = { day };
    for (const a of agencies) point[a] = byDay.get(day)?.get(a) ?? 0;
    return point;
  });
}
