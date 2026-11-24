import "./_env";
import { getAgencies } from "@/lib/config";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";
import { resolveChat, resolveEmbed } from "@/lib/llm/resolve";
import { checkBudget } from "@/lib/metering/budget";
import { computeCost } from "@/lib/metering/cost";
import { generateSeedRows, type TokenSample } from "@/lib/seed/generate";

// Usage: npm run seed                       insert simulated traffic (about 600 rows)
//        npm run seed -- --dry-run          show what would be inserted
//        npm run seed -- --clear            delete ALL simulated rows (and simulated alerts), nothing else
//        options: --requests 280  --seed 20261123  --days 30  --trend DMV  --target 0.92  --max-scale 25
const arg = (n: string, d: number) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? Number(process.argv[i + 1]) : d; };
const sarg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const flag = (n: string) => process.argv.includes(`--${n}`);

const AGENCY_WEIGHTS: Record<string, number> = { VITA: 30, DMV: 20, VDH: 15, VEC: 12, DSS: 13, VDOT: 10 };
const USE_CASE_WEIGHTS: Record<string, number> = { "policy-qa": 60, "registry-help": 20, "procurement-check": 20 };

async function clear() {
  const db = getSupabase();
  const calls = await db.from("llm_calls").delete({ count: "exact" }).eq("simulated", true);
  if (calls.error) throw new Error(calls.error.message);
  const alerts = await db.from("alerts").delete({ count: "exact" }).eq("simulated", true);
  if (alerts.error) throw new Error(alerts.error.message);
  console.log(`Deleted ${calls.count ?? 0} simulated llm_calls rows and ${alerts.count ?? 0} simulated alerts. Real rows were not touched.`);
}

async function realSample(): Promise<TokenSample> {
  const { data } = await getSupabase().from("llm_calls").select("input_tokens,output_tokens,latency_ms")
    .eq("simulated", false).eq("operation", "chat").eq("status", "ok").gt("input_tokens", 0).order("id", { ascending: false }).limit(300);
  const rows = data ?? [];
  return { input: rows.map((r) => r.input_tokens), output: rows.map((r) => r.output_tokens), latency: rows.map((r) => r.latency_ms ?? 1500) };
}

async function main() {
  const { env, providers } = getEnv();
  if (flag("clear")) return clear();

  const db = getSupabase();
  const dry = flag("dry-run");
  const existing = await db.from("llm_calls").select("id", { count: "exact", head: true }).eq("simulated", true);
  if (!dry && (existing.count ?? 0) > 0) throw new Error(`${existing.count} simulated rows already exist. Run "npm run seed -- --clear" first so they aren't doubled.`);

  const cfg = getAgencies();
  const trendCode = sarg("trend", "DMV");
  const budget = cfg.agencies.find((a) => a.code === trendCode)?.monthly_budget_usd;
  if (!budget) throw new Error(`--trend ${trendCode} is not an agency in config/agencies.json`);

  const chat = resolveChat(env, providers.chat, "fast");
  const embed = resolveEmbed(env, providers.embed);
  const sample = await realSample();
  const { rows, trend } = generateSeedRows({
    now: new Date(), days: arg("days", 30), requests: arg("requests", 280), seed: arg("seed", 20261123),
    chat: { provider: chat.provider, model: chat.pricingKey }, embed: { provider: embed.provider, model: embed.pricingKey },
    agencies: cfg.agencies.filter((a) => a.code !== "DEMO").map((a) => ({ code: a.code, weight: AGENCY_WEIGHTS[a.code] ?? 5 })),
    useCases: cfg.use_cases.filter((u) => u.code in USE_CASE_WEIGHTS).map((u) => ({ code: u.code, weight: USE_CASE_WEIGHTS[u.code] })),
    trend: { agency: trendCode, budgetUsd: budget, targetUtilization: arg("target", 0.92), maxScale: arg("max-scale", 25) },
    sample, cost: computeCost,
  });

  const spend = new Map<string, number>();
  for (const r of rows) spend.set(r.agency, (spend.get(r.agency) ?? 0) + r.cost_usd);
  console.log(`${dry ? "DRY RUN: would insert" : "Inserting"} ${rows.length} simulated rows (${sample.input.length >= 10 ? `token counts sampled from ${sample.input.length} real calls` : "default token distributions, no real calls to sample yet"}).`);
  console.table([...spend].map(([agency, usd]) => ({ agency, "30-day spend (USD)": usd.toFixed(4) })));

  if (!dry) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from("llm_calls").insert(rows.slice(i, i + 200));
      if (error) throw new Error(`insert failed: ${error.message}`);
    }
    // Alerts are never inserted directly: the normal budget check decides, as it does for real traffic.
    for (const a of cfg.agencies) await checkBudget(a.code, true);
    const { data } = await db.from("alerts").select("agency,level,spend_usd,budget_usd").eq("simulated", true).order("created_at");
    console.log(`Budget check created ${data?.length ?? 0} simulated alert(s):`, data ?? []);
  }

  const pct = Math.round(trend.utilization * 100);
  console.log(`\n${trend.agency} month-to-date: $${trend.mtdSpendUsd.toFixed(4)} of its $${trend.budgetUsd.toFixed(2)} budget (${pct}%), usage ramped up through the month (token scale x${trend.scale.toFixed(1)}).`);
  if (trend.utilization < 0.8) {
    console.log(`That is below the 80% warning level: this model is cheap, and the scale is capped at x${arg("max-scale", 25)} so token counts stay realistic.\nTo see a Warning alert, set ${trend.agency}'s monthly_budget_usd in config/agencies.json to about ${(Math.ceil((trend.mtdSpendUsd / 0.9) * 100) / 100).toFixed(2)}, then re-run with --clear and seed again.`);
  }
  if (dry) console.log("Nothing was written (dry run).");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
