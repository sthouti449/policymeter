import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// ---------- pricing.json ----------
const priceSchema = z.object({
  input: z.number().min(0),
  cached_input: z.number().min(0),
  // Anthropic charges extra to write the prompt cache; OpenAI/Azure have no such fee.
  cache_write: z.number().min(0).default(0),
  output: z.number().min(0),
  label: z.string(),
});
const pricingSchema = z.object({
  _checked_on: z.string(),
  currency: z.literal("USD"),
  models: z.record(z.string(), priceSchema),
});
export type Price = z.infer<typeof priceSchema>;

// ---------- agencies.json ----------
const agenciesSchema = z.object({
  warning_threshold: z.number().gt(0).lte(1),
  breach_threshold: z.number().gt(0),
  agencies: z.array(z.object({ code: z.string(), name: z.string(), monthly_budget_usd: z.number().positive() })),
  use_cases: z.array(z.object({ code: z.string(), name: z.string() })),
});
export type AgencyConfig = z.infer<typeof agenciesSchema>;

function loadJson<T>(file: string, schema: z.ZodType<T>): T {
  const full = path.join(process.cwd(), "config", file);
  const parsed = schema.safeParse(JSON.parse(fs.readFileSync(full, "utf8")));
  if (!parsed.success) {
    throw new Error(`config/${file} is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  return parsed.data;
}

let pricing: z.infer<typeof pricingSchema> | undefined;
let agencies: AgencyConfig | undefined;

export const getPricing = () => (pricing ??= loadJson("pricing.json", pricingSchema));
export const getAgencies = () => (agencies ??= loadJson("agencies.json", agenciesSchema));

/** Price lookup. An unknown key is a bug, so it throws instead of costing $0. */
export function getPrice(pricingKey: string): Price {
  const price = getPricing().models[pricingKey];
  if (!price) throw new Error(`No price for "${pricingKey}" in config/pricing.json`);
  return price;
}

/** Keys whose input or output price is still 0, so the dashboard can warn. */
export function zeroPricedKeys(): string[] {
  return Object.entries(getPricing().models)
    // Embedding models have no output tokens, so only their input price matters.
    .filter(([key, p]) => p.input === 0 || (p.output === 0 && !key.includes("embed")))
    .map(([key]) => key);
}

/** Test hook: forget cached files. */
export function resetConfigCache() {
  pricing = undefined;
  agencies = undefined;
}
