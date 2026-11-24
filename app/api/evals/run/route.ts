import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { runEvals } from "@/lib/evals/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
const body = z.object({ only: z.array(z.string().max(60)).max(50).optional() }).optional();

/** Constant-time comparison, so response timing can't be used to guess the token. */
function tokenMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/evals/run   header: x-admin-token   body (optional): { only: ["q01-disclaimer"] }
// Spends real money (about 16 questions plus judge calls), so it is admin-only.
export async function POST(req: Request) {
  const expected = getEnv().env.ADMIN_TOKEN;
  if (!expected || expected === "change-me") return fail(503, "Running evals is disabled until ADMIN_TOKEN is set to a real secret.");
  if (!tokenMatches(req.headers.get("x-admin-token"), expected)) return fail(401, "Invalid admin token.");

  const parsed = body.safeParse(await req.json().catch(() => undefined));
  if (!parsed.success) return fail(400, "Invalid request body.");
  try {
    const { runId, summary, targets } = await runEvals({ only: parsed.data?.only });
    return NextResponse.json({ runId, summary, targets }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("eval run failed:", err instanceof Error ? err.message : err);
    return fail(500, "The eval run failed. Check the server logs.");
  }
}
