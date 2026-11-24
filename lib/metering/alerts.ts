import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";

export interface AlertInput {
  agency: string; // 'GLOBAL' for the global daily cap
  period: string; // 'YYYY-MM' for budgets, 'YYYY-MM-DD' for daily caps
  level: "warning" | "breached" | "daily_cap";
  spendUsd: number;
  budgetUsd: number;
  message: string;
  simulated?: boolean;
}

/** Teams and Slack incoming webhooks both accept {"text": "..."}. 5 s timeout. */
async function postWebhook(url: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Insert an alert once per (agency, period, level, simulated). Returns true only
 * when this call created it, so the webhook fires once and never repeats.
 */
export async function raiseAlert(a: AlertInput): Promise<boolean> {
  const db = getSupabase();
  const { data, error } = await db
    .from("alerts")
    .upsert(
      {
        agency: a.agency, period: a.period, level: a.level,
        spend_usd: a.spendUsd, budget_usd: a.budgetUsd, message: a.message,
        simulated: a.simulated ?? false,
      },
      { onConflict: "agency,period,level,simulated", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`alert insert failed: ${error.message}`);
  if (!data?.length) return false; // already existed

  const url = getEnv().env.ALERT_WEBHOOK_URL;
  if (url && !a.simulated) {
    const ok = await postWebhook(url, a.message);
    await db.from("alerts").update({ webhook_ok: ok }).eq("id", data[0].id);
  }
  return true;
}
