import { NextResponse } from "next/server";
import { previewCalls, previewMetrics, previewTrace } from "@/lib/dev/previewData";
import { filtersFromRequest } from "@/lib/metrics/http";

// TEMPORARY (removed in Stage 7): fixture versions of /api/metrics, /api/calls and
// /api/trace/<id>, so /dev/dashboard-preview works with no database.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [kind, id] = (await ctx.params).path;
  if (kind === "trace" && id) return NextResponse.json(previewTrace(id));

  const filters = filtersFromRequest(req);
  if (filters instanceof NextResponse) return filters;
  if (kind === "metrics") return NextResponse.json(previewMetrics(filters));
  if (kind === "calls") {
    const url = new URL(req.url);
    return NextResponse.json(previewCalls(Number(url.searchParams.get("page") ?? 1), Number(url.searchParams.get("pageSize") ?? 15)));
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
