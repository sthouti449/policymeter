import "server-only";
import { getAgencies } from "@/lib/config";
import { getSupabase } from "@/lib/db/supabase";
import { raiseAlert } from "./alerts";
import { levelsCrossed } from "./thresholds";

const money = (n: number) => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;

/**
 * Month-to-date check for one agency; raises warning (80%) and breached (100%)
 * alerts. Real traffic counts only real rows. The seed script passes
 * includeSimulated = true, and its alerts are flagged simulated.
 */
export async function checkBudget(agency: string, includeSimulated = false): Promise<void> {
  const cfg = getAgencies();
  const entry = cfg.agencies.find((a) => a.code === agency);
  if (!entry) return;

  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const { data, error } = await getSupabase().rpc("month_spend", {
    p_agency: agency, p_since: since.toISOString(), p_include_simulated: includeSimulated,
  });
  if (error) throw new Error(`month_spend failed: ${error.message}`);

  const spend = Number(data ?? 0);
  const period = now.toISOString().slice(0, 7);
  for (const level of levelsCrossed(spend, entry.monthly_budget_usd, cfg.warning_threshold, cfg.breach_threshold)) {
    const pct = Math.round((spend / entry.monthly_budget_usd) * 100);
    await raiseAlert({
      agency, period, level, spendUsd: spend, budgetUsd: entry.monthly_budget_usd, simulated: includeSimulated,
      message: `${agency} has used ${pct}% of its ${period} budget (${money(spend)} of ${money(entry.monthly_budget_usd)}): ${level}.`,
    });
  }
}
