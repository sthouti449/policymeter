import "server-only";
import { NextResponse } from "next/server";
import { getAgencies } from "@/lib/config";
import { checkReadRateLimit } from "@/lib/guardrails/rateLimit";
import { parseFilters } from "./filters";
import type { Filters } from "./types";

export const jsonError = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Validate the query string against agencies.json. Returns Filters, or a ready 400 response. */
export function filtersFromRequest(req: Request): Filters | NextResponse {
  const cfg = getAgencies();
  const result = parseFilters(new URL(req.url).searchParams, {
    agencies: cfg.agencies.map((a) => a.code),
    useCases: cfg.use_cases.map((u) => u.code),
  });
  return result.ok ? result.filters : jsonError(400, result.error);
}

/** Per-IP limit for the read-only endpoints. Returns a ready 429/503 response, or null when allowed. Fails closed. */
export async function readGuard(req: Request): Promise<NextResponse | null> {
  try {
    return (await checkReadRateLimit(req.headers)) ? null : jsonError(429, "Too many requests. Please wait a minute and try again.");
  } catch (err) {
    console.error("read guard failed closed:", err instanceof Error ? err.message : err);
    return jsonError(503, "The service is temporarily unavailable. Please try again shortly.");
  }
}

/** Never leak database or stack details to the browser. */
export function serverError(label: string, err: unknown) {
  console.error(`${label} failed:`, err instanceof Error ? err.message : err);
  return jsonError(500, "The dashboard data could not be loaded right now.");
}
