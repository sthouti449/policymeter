import { NextResponse } from "next/server";
import { filtersFromRequest, serverError } from "@/lib/metrics/http";
import { getMetrics } from "@/lib/metrics/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/metrics?from&to&agency&useCase&model&includeSimulated
export async function GET(req: Request) {
  const filters = filtersFromRequest(req);
  if (filters instanceof NextResponse) return filters;
  try {
    return NextResponse.json(await getMetrics(filters), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return serverError("metrics", err);
  }
}
