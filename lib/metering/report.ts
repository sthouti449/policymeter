// The numbers check:metering prints, so you can compare them with a provider's own usage page.
// Pure: it takes rows and returns totals, so it can be tested without a database.

export interface MeterRow {
  provider: string;
  model: string;
  operation: string;
  status: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  usage_estimated: boolean;
}

export interface MeterGroup {
  provider: string;
  model: string;
  operation: string;
  calls: number;
  failedCalls: number; // status 'error': the provider may or may not have billed these
  inputTokens: number; // total prompt tokens, cached included
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
  estimatedCalls: number; // provider returned no usage, so tokens are a chars/4 guess
  unpricedCalls: number; // tokens were used but cost is $0: a price is missing or zero
}

export interface MeterReport { groups: MeterGroup[]; totals: Omit<MeterGroup, "provider" | "model" | "operation"> }

const empty = () => ({ calls: 0, failedCalls: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costUsd: 0, estimatedCalls: 0, unpricedCalls: 0 });

export function buildMeterReport(rows: MeterRow[]): MeterReport {
  const byKey = new Map<string, MeterGroup>();
  const totals = empty();
  for (const r of rows) {
    const key = `${r.provider}|${r.model}|${r.operation}`;
    const g = byKey.get(key) ?? { provider: r.provider, model: r.model, operation: r.operation, ...empty() };
    for (const t of [g, totals]) {
      t.calls += 1;
      t.failedCalls += r.status === "error" ? 1 : 0;
      t.inputTokens += Number(r.input_tokens);
      t.cachedInputTokens += Number(r.cached_input_tokens);
      t.outputTokens += Number(r.output_tokens);
      t.costUsd += Number(r.cost_usd);
      t.estimatedCalls += r.usage_estimated ? 1 : 0;
      t.unpricedCalls += r.status === "ok" && Number(r.cost_usd) === 0 && Number(r.input_tokens) + Number(r.output_tokens) > 0 ? 1 : 0;
    }
    byKey.set(key, g);
  }
  const groups = [...byKey.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model) || a.operation.localeCompare(b.operation));
  return { groups, totals };
}
