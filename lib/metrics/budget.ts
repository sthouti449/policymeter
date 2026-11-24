import { levelsCrossed } from "@/lib/metering/thresholds";
import type { BudgetRow } from "./types";

interface BudgetCfg {
  warning_threshold: number;
  breach_threshold: number;
  agencies: { code: string; monthly_budget_usd: number }[];
}

const DAY_MS = 86_400_000;

/**
 * Month-end forecast (ARCHITECTURE section 4): month-to-date spend / days elapsed
 * x days in the month. Early in the month a few calls would project wildly, so
 * "days elapsed" never counts below 1.
 */
export function forecastMonthEnd(mtdUsd: number, now: Date): number {
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsed = Math.max(1, (now.getTime() - monthStart) / DAY_MS);
  return (mtdUsd / elapsed) * daysInMonth;
}

/** One row per configured agency (even with no spend), using the same thresholds as the alerts. */
export function computeBudgets(mtd: { agency: string; spend: number }[], cfg: BudgetCfg, now: Date): BudgetRow[] {
  const spendBy = new Map(mtd.map((r) => [r.agency, Number(r.spend)]));
  return cfg.agencies.map((a) => {
    const spend = spendBy.get(a.code) ?? 0;
    const crossed = levelsCrossed(spend, a.monthly_budget_usd, cfg.warning_threshold, cfg.breach_threshold);
    return {
      agency: a.code,
      budgetUsd: a.monthly_budget_usd,
      mtdSpendUsd: spend,
      pct: spend / a.monthly_budget_usd,
      status: crossed.includes("breached") ? "Breached" : crossed.includes("warning") ? "Warning" : "OK",
      forecastMonthEndUsd: forecastMonthEnd(spend, now),
    };
  });
}
