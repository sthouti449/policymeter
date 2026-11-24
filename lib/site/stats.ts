import "server-only";
import { getSupabase } from "@/lib/db/supabase";
import { monthStartUtc } from "@/lib/metrics/filters";

export interface SiteStats {
  documents: number | null; // policy documents loaded
  monthSpendUsd: number | null; // this calendar month, UTC
  hasSimulated: boolean; // true when the spend figure includes simulated rows
  groundedness: number | null; // latest eval run, 1-5
  evalQuestions: number | null;
}

/**
 * Live numbers for the landing page. Each one is fetched on its own, and any
 * failure (no database yet, an empty table) just yields null so the page still renders.
 */
export async function getSiteStats(now = new Date()): Promise<SiteStats> {
  const stats: SiteStats = { documents: null, monthSpendUsd: null, hasSimulated: false, groundedness: null, evalQuestions: null };
  let db: ReturnType<typeof getSupabase>;
  try {
    db = getSupabase();
  } catch {
    return stats;
  }

  await Promise.allSettled([
    (async () => {
      const { count, error } = await db.from("documents").select("id", { count: "exact", head: true }).eq("corpus", "policy");
      if (!error) stats.documents = count ?? 0;
    })(),
    (async () => {
      const to = new Date(now.getTime() + 86_400_000).toISOString();
      const { data, error } = await db.rpc("dashboard_metrics", { p_from: monthStartUtc(now), p_to: to, p_include_simulated: true });
      if (!error && data) {
        stats.monthSpendUsd = Number((data as { kpis: { spend_usd: number } }).kpis.spend_usd ?? 0);
        stats.hasSimulated = (data as { has_simulated?: boolean }).has_simulated === true;
      }
    })(),
    (async () => {
      const { data, error } = await db.from("eval_runs").select("groundedness_avg,questions").order("created_at", { ascending: false }).limit(1);
      if (!error && data?.[0]?.groundedness_avg != null) {
        stats.groundedness = Number(data[0].groundedness_avg);
        stats.evalQuestions = Number(data[0].questions);
      }
    })(),
  ]);
  return stats;
}
