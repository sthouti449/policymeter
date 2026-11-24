import type { Usage } from "@/lib/llm/types";

// Builds fake-but-realistic llm_calls rows for the dashboard demo. Pure (no database,
// no clock, no model): the caller supplies the date, a random seed and a cost function.

export interface SeedRow {
  request_id: string;
  created_at: string;
  provider: string;
  model: string;
  operation: "chat" | "embed";
  agency: string;
  use_case: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  ttft_ms: number | null;
  status: "ok" | "error" | "refused";
  error_code: string | null;
  usage_estimated: false;
  simulated: true;
  top_similarity: number | null;
  feedback: 1 | -1 | null;
}

export interface TokenSample { input: number[]; output: number[]; latency: number[] }

export interface SeedConfig {
  now: Date;
  days: number; // how far back, default 30
  requests: number; // questions; each makes 2-3 rows, so ~220 requests is ~600 rows
  seed: number;
  chat: { provider: string; model: string };
  embed: { provider: string; model: string };
  agencies: { code: string; weight: number }[];
  useCases: { code: string; weight: number }[];
  trend: { agency: string; budgetUsd: number; targetUtilization: number; maxScale: number };
  sample?: TokenSample; // real rows to imitate; defaults are used when there are fewer than 10
  cost: (usage: Usage, pricingKey: string) => number;
}

export interface TrendReport { agency: string; budgetUsd: number; mtdSpendUsd: number; utilization: number; scale: number; capped: boolean }

/** Small seeded PRNG, so `--seed 7` always produces the same data. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T extends { weight: number }>(rng: Rng, items: T[]): T => {
  let r = rng() * items.reduce((s, i) => s + i.weight, 0);
  for (const i of items) if ((r -= i.weight) < 0) return i;
  return items[items.length - 1];
};
const logNormal = (rng: Rng, median: number, sigma: number, lo: number, hi: number) => {
  const n = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  return Math.round(Math.min(hi, Math.max(lo, median * Math.exp(sigma * n))));
};
const fromSample = (rng: Rng, values: number[], fallback: () => number) =>
  values.length >= 10 ? Math.max(1, Math.round(values[Math.floor(rng() * values.length)] * (0.9 + rng() * 0.2))) : fallback();

const usage = (input: number, output: number): Usage => ({ inputTokens: input, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: output, estimated: false });
const HOURS = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22]; // US Eastern working hours, in UTC
const monthStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);

export function generateSeedRows(cfg: SeedConfig): { rows: SeedRow[]; trend: TrendReport } {
  const rng = mulberry32(cfg.seed);
  const nowMs = cfg.now.getTime();
  const dayStart = Date.UTC(cfg.now.getUTCFullYear(), cfg.now.getUTCMonth(), cfg.now.getUTCDate());

  // Busier on weekdays, quiet at weekends, growing a little over the period.
  const dayWeights = Array.from({ length: cfg.days }, (_, back) => {
    const dow = new Date(dayStart - back * 86_400_000).getUTCDay();
    return { back, weight: ([0, 6].includes(dow) ? 0.2 : 1) * (1.3 - 0.6 * (back / Math.max(1, cfg.days - 1))) };
  });

  const rows: SeedRow[] = [];
  const base = (id: string, at: number, agency: string, useCase: string) => ({ request_id: id, created_at: new Date(at).toISOString(), agency, use_case: useCase, cached_input_tokens: 0, usage_estimated: false as const, simulated: true as const });

  for (let i = 0; i < cfg.requests; i++) {
    const id = `${cfg.seed.toString(16).padStart(8, "0")}-0000-4000-8000-${i.toString(16).padStart(12, "0")}`;
    const { back } = pick(rng, dayWeights);
    const hour = HOURS[Math.floor(rng() * HOURS.length)];
    let at = dayStart - back * 86_400_000 + hour * 3_600_000 + Math.floor(rng() * 3_600_000);
    if (at > nowMs) at = nowMs - Math.floor(rng() * 3_600_000); // never in the future
    const agency = pick(rng, cfg.agencies).code;
    const useCase = pick(rng, cfg.useCases).code;
    const sim = Math.round((0.3 + rng() * 0.5) * 1000) / 1000;
    const roll = rng();

    if (roll < 0.02) { // injection attempt: refused before any model call, $0
      rows.push({ ...base(id, at, agency, useCase), provider: cfg.chat.provider, model: cfg.chat.model, operation: "chat", input_tokens: 0, output_tokens: 0, cost_usd: 0, latency_ms: 1, ttft_ms: null, status: "refused", error_code: "injection", top_similarity: null, feedback: null });
      continue;
    }
    if (roll >= 0.02 && roll < 0.27 && useCase === "policy-qa") { // a follow-up question gets rewritten first
      const t = usage(logNormal(rng, 260, 0.3, 120, 600), logNormal(rng, 24, 0.3, 8, 80));
      rows.push({ ...base(id, at, agency, "query-rewrite"), provider: cfg.chat.provider, model: cfg.chat.model, operation: "chat", input_tokens: t.inputTokens, output_tokens: t.outputTokens, cost_usd: cfg.cost(t, cfg.chat.model), latency_ms: logNormal(rng, 420, 0.3, 200, 900), ttft_ms: null, status: "ok", error_code: null, top_similarity: null, feedback: null });
    }
    const e = usage(logNormal(rng, 22, 0.4, 6, 90), 0);
    const refusedLow = rng() < 0.05; // nothing similar enough: embedding only
    rows.push({ ...base(id, at + 500, agency, useCase), provider: cfg.embed.provider, model: cfg.embed.model, operation: "embed", input_tokens: e.inputTokens, output_tokens: 0, cost_usd: cfg.cost(e, cfg.embed.model), latency_ms: logNormal(rng, 190, 0.3, 90, 500), ttft_ms: null, status: refusedLow ? "refused" : "ok", error_code: refusedLow ? "low_similarity" : null, top_similarity: refusedLow ? Math.round(rng() * 250) / 1000 : sim, feedback: null });
    if (refusedLow) continue;

    const failed = rng() < 0.01;
    const c = failed ? usage(0, 0) : usage(fromSample(rng, cfg.sample?.input ?? [], () => logNormal(rng, 1800, 0.35, 900, 4500)), fromSample(rng, cfg.sample?.output ?? [], () => logNormal(rng, 170, 0.45, 40, 500)));
    const latency = fromSample(rng, cfg.sample?.latency ?? [], () => logNormal(rng, 1700, 0.35, 700, 5000));
    rows.push({ ...base(id, at + 1000, agency, useCase), provider: cfg.chat.provider, model: cfg.chat.model, operation: "chat", input_tokens: c.inputTokens, output_tokens: c.outputTokens, cost_usd: failed ? 0 : cfg.cost(c, cfg.chat.model), latency_ms: latency, ttft_ms: failed ? null : Math.round(latency * 0.35), status: failed ? "error" : "ok", error_code: failed ? "http_529" : null, top_similarity: sim, feedback: !failed && rng() < 0.08 ? (rng() < 0.85 ? 1 : -1) : null });
  }

  return { rows, trend: applyTrend(rows, cfg) };
}

/**
 * Make one agency's usage ramp up through the month. Its answer calls get more
 * tokens as the month goes on, scaled (up to maxScale) toward targetUtilization of its
 * budget. The scale is capped so token counts stay believable, so a tiny model price
 * may leave it short of the target; the report says by how much.
 */
function applyTrend(rows: SeedRow[], cfg: SeedConfig): TrendReport {
  const t = cfg.trend;
  const start = monthStart(cfg.now);
  const span = Math.max(1, cfg.now.getTime() - start);
  const inMonth = (r: SeedRow) => r.agency === t.agency && Date.parse(r.created_at) >= start;
  const ramp = (r: SeedRow) => 0.25 + 0.75 * ((Date.parse(r.created_at) - start) / span);

  const answers = rows.filter((r) => inMonth(r) && r.operation === "chat" && r.status === "ok");
  const fixed = rows.filter((r) => inMonth(r) && !answers.includes(r)).reduce((s, r) => s + r.cost_usd, 0);
  const rampedCost = answers.reduce((s, r) => s + r.cost_usd * ramp(r), 0);
  const wanted = rampedCost > 0 ? (t.targetUtilization * t.budgetUsd - fixed) / rampedCost : 1;
  const scale = Math.min(t.maxScale, Math.max(1, wanted));

  for (const r of answers) {
    const f = Math.max(1, scale * ramp(r));
    r.input_tokens = Math.round(r.input_tokens * f);
    r.output_tokens = Math.round(r.output_tokens * f);
    r.cost_usd = cfg.cost(usage(r.input_tokens, r.output_tokens), r.model);
  }
  const mtd = rows.filter(inMonth).reduce((s, r) => s + r.cost_usd, 0);
  return { agency: t.agency, budgetUsd: t.budgetUsd, mtdSpendUsd: mtd, utilization: mtd / t.budgetUsd, scale, capped: wanted > t.maxScale };
}
