import "server-only";
import { NextResponse } from "next/server";
import { getAgencies } from "@/lib/config";
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

/** Never leak database or stack details to the browser. */
export function serverError(label: string, err: unknown) {
  console.error(`${label} failed:`, err instanceof Error ? err.message : err);
  return jsonError(500, "The dashboard data could not be loaded right now.");
}
