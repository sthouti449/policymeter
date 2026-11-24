import "./_env";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";
import { buildMeterReport, type MeterRow } from "@/lib/metering/report";

// Usage: npm run check:metering
//        npm run check:metering -- --from 2026-11-01 --to 2026-11-23 [--include-simulated]
// Prints what llm_calls recorded, per provider and model, so you can compare it with
// the providers' own usage pages. Simulated rows are left out unless you ask for them.
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : undefined; };
const day = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  getEnv();
  const now = new Date();
  const from = arg("from") ?? day(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const to = arg("to") ?? day(now);
  const withSim = process.argv.includes("--include-simulated");
  if (![from, to].every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))) throw new Error("Dates must look like 2026-11-23");

  const rows: MeterRow[] = [];
  for (let start = 0; ; start += 1000) {
    let q = getSupabase().from("llm_calls")
      .select("provider,model,operation,status,input_tokens,cached_input_tokens,output_tokens,cost_usd,usage_estimated")
      .gte("created_at", `${from}T00:00:00Z`).lt("created_at", new Date(Date.parse(`${to}T00:00:00Z`) + 86_400_000).toISOString());
    if (!withSim) q = q.eq("simulated", false);
    const { data, error } = await q.order("id").range(start, start + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data as unknown as MeterRow[]));
    if ((data?.length ?? 0) < 1000) break;
  }

  const { groups, totals } = buildMeterReport(rows);
  console.log(`\nllm_calls from ${from} to ${to} (UTC), ${withSim ? "including" : "excluding"} simulated rows: ${totals.calls} calls\n`);
  console.table(groups.map((g) => ({
    provider: g.provider, model: g.model, operation: g.operation, calls: g.calls, failed: g.failedCalls,
    "input tokens": g.inputTokens, "of which cached": g.cachedInputTokens, "output tokens": g.outputTokens, "cost (USD)": g.costUsd.toFixed(6),
  })));
  console.log(`TOTAL  ${totals.calls} calls   in ${totals.inputTokens}   out ${totals.outputTokens}   $${totals.costUsd.toFixed(6)}`);

  console.log(`
Compare these totals with each provider's own numbers for the same dates:
  Anthropic  Console -> Usage and Cost (note: it reports cache reads and writes separately from input tokens;
             ours counts them inside "input tokens", with the cached part shown in its own column)
  OpenAI     platform usage page (embedding tokens)
  Azure      Azure Cost Management, or the Azure OpenAI resource's metrics
The target is 0 unmetered calls. A provider total noticeably above ours means some call bypassed lib/llm.`);

  let bad = false;
  if (totals.estimatedCalls) { bad = true; console.warn(`\nWARNING: ${totals.estimatedCalls} call(s) have usage_estimated = true. The provider returned no usage, so those tokens are a chars/4 guess.`); }
  if (totals.unpricedCalls) { bad = true; console.warn(`WARNING: ${totals.unpricedCalls} successful call(s) used tokens but cost $0. A price in config/pricing.json is missing or 0.`); }
  if (totals.failedCalls) console.log(`Note: ${totals.failedCalls} call(s) failed. They are logged with zero tokens; compare with the provider to see if any were billed.`);
  if (!bad) console.log("\nNo estimated-usage or unpriced calls found.");
  if (bad) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
