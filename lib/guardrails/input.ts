import { z } from "zod";
import { getAgencies } from "@/lib/config";

// Use cases that only the system sets. Users can't pick them from the UI.
export const INTERNAL_USE_CASES = ["query-rewrite", "eval-run", "ingestion"];

/** Validates a question plus its cost-allocation tags (agency, use case). */
export function makeInputSchema(maxChars: number, opts: { allowInternal?: boolean } = {}) {
  const cfg = getAgencies();
  const agencies = new Set(cfg.agencies.map((a) => a.code));
  const useCases = new Set(
    cfg.use_cases.map((u) => u.code).filter((c) => opts.allowInternal || !INTERNAL_USE_CASES.includes(c)),
  );
  return z.object({
    question: z.string().trim().min(1, "Question is required").max(maxChars, `Question must be at most ${maxChars} characters`),
    agency: z.string().refine((v) => agencies.has(v), "Unknown agency"),
    useCase: z.string().refine((v) => useCases.has(v), "Unknown use case"),
  });
}

export type GuardInput = z.infer<ReturnType<typeof makeInputSchema>>;
