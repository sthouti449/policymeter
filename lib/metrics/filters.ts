import { z } from "zod";
import type { Filters } from "./types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = z.string().regex(DAY, "Dates must look like 2026-11-23").refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Invalid date");

const schema = z.object({
  from: day.optional(),
  to: day.optional(),
  agency: z.string().max(40).optional(),
  useCase: z.string().max(40).optional(),
  model: z.string().max(100).optional(),
  includeSimulated: z.enum(["true", "false"]).optional(),
});

export const MAX_RANGE_DAYS = 366;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export type FilterResult = { ok: true; filters: Filters } | { ok: false; error: string };

/**
 * Query string -> validated filters. Defaults: the last 30 days, simulated traffic
 * ON (CLAUDE.md rule 11). Agency and use case must be ones in agencies.json.
 */
export function parseFilters(
  params: URLSearchParams,
  known: { agencies: string[]; useCases: string[] },
  now = new Date(),
): FilterResult {
  const raw = Object.fromEntries([...params.entries()].filter(([, v]) => v !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const p = parsed.data;

  const to = p.to ?? iso(now);
  const from = p.from ?? iso(new Date(Date.parse(`${to}T00:00:00Z`) - 29 * 86_400_000));
  if (from > to) return { ok: false, error: "from must be on or before to" };
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 >= MAX_RANGE_DAYS) {
    return { ok: false, error: `Date range is limited to ${MAX_RANGE_DAYS} days` };
  }
  if (p.agency && !known.agencies.includes(p.agency)) return { ok: false, error: "Unknown agency" };
  if (p.useCase && !known.useCases.includes(p.useCase)) return { ok: false, error: "Unknown use case" };

  return { ok: true, filters: { from, to, agency: p.agency, useCase: p.useCase, model: p.model, includeSimulated: p.includeSimulated !== "false" } };
}

/** Inclusive [from, to] days -> a half-open timestamp range [fromTs, toTs). */
export function rangeBounds(f: Pick<Filters, "from" | "to">) {
  return { fromTs: `${f.from}T00:00:00.000Z`, toTs: new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000).toISOString() };
}

export const monthStartUtc = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
