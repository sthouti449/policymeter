import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, serverError, readGuard } from "@/lib/metrics/http";
import { getTrace } from "@/lib/metrics/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/trace/<requestId>: every call for one question, plus the chunks it retrieved.
export async function GET(req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const limited = await readGuard(req);
  if (limited) return limited;
  const { requestId } = await ctx.params;
  if (!z.string().uuid().safeParse(requestId).success) return jsonError(400, "Invalid request id.");
  try {
    const trace = await getTrace(requestId);
    return trace ? NextResponse.json(trace, { headers: { "cache-control": "no-store" } }) : jsonError(404, "No calls found for that request.");
  } catch (err) {
    return serverError("trace", err);
  }
}
