import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";
import { raiseAlert } from "@/lib/metering/alerts";
import { isCapReached } from "@/lib/metering/thresholds";

// Two caps: 'global' for the policy assistant, 'demo' for the "Ask about this
// demo" widget, so heavy policy use can never lock reviewers out of the widget.
// Both count real calls only (simulated = false) and ignore evals and ingestion;
// the SQL lives in daily_spend().
export type CapScope = "global" | "demo";

export interface CapStatus { blocked: boolean; spentUsd: number; capUsd: number }

export async function checkDailyCap(scope: CapScope): Promise<CapStatus> {
  const { env } = getEnv();
  const capUsd = scope === "demo" ? env.DEMO_DAILY_SPEND_CAP_USD : env.DAILY_SPEND_CAP_USD;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data, error } = await getSupabase().rpc("daily_spend", { p_since: startOfDay.toISOString(), p_scope: scope });
  if (error) throw new Error(`daily_spend failed: ${error.message}`);

  const spentUsd = Number(data ?? 0);
  const blocked = isCapReached(spentUsd, capUsd);
  if (blocked) {
    await raiseAlert({
      agency: scope === "demo" ? "DEMO" : "GLOBAL",
      period: startOfDay.toISOString().slice(0, 10),
      level: "daily_cap",
      spendUsd: spentUsd,
      budgetUsd: capUsd,
      message: `The ${scope} daily spend cap was reached: $${spentUsd.toFixed(4)} of $${capUsd}.`,
    }).catch((e) => console.error("daily cap alert failed:", e instanceof Error ? e.message : e));
  }
  return { blocked, spentUsd, capUsd };
}
