import { NextResponse } from "next/server";
import { z } from "zod";
import { callsToCsv } from "@/lib/metrics/csv";
import { filtersFromRequest, jsonError, serverError, readGuard } from "@/lib/metrics/http";
import { CSV_MAX_ROWS, getAllCalls, getCalls } from "@/lib/metrics/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paging = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  format: z.enum(["json", "csv"]).default("json"),
});

// GET /api/calls?...filters&page&pageSize          -> one page of calls
// GET /api/calls?...filters&format=csv             -> chargeback CSV of ALL filtered calls
export async function GET(req: Request) {
  const limited = await readGuard(req);
  if (limited) return limited;
  const filters = filtersFromRequest(req);
  if (filters instanceof NextResponse) return filters;
  const p = paging.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return jsonError(400, "Invalid paging parameters.");

  try {
    if (p.data.format === "csv") {
      const { rows, truncated } = await getAllCalls(filters);
      return new Response(callsToCsv(rows), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="policymeter-calls-${filters.from}-to-${filters.to}.csv"`,
          "cache-control": "no-store",
          ...(truncated ? { "x-truncated": `first ${CSV_MAX_ROWS} rows` } : {}),
        },
      });
    }
    return NextResponse.json(await getCalls(filters, p.data.page, p.data.pageSize), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return serverError("calls", err);
  }
}
