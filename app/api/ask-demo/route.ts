import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/guardrails/guard";
import { isSameOrigin } from "@/lib/guardrails/origin";
import { answerDemoQuestion } from "@/lib/rag/ask-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({ question: z.string().max(5000) }); // guard() applies the real, tighter limit
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

// POST /api/ask-demo { question } -> { answer, refused, sources, cost }
// The agency and use case are fixed here (DEMO / reviewer-assistant), never taken from the caller.
async function handle(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "Request body must be JSON.");
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) return fail(400, "Invalid request: expected a question.");

  // The widget has its own daily cap, so policy traffic can't lock reviewers out.
  const g = await guard(req, { question: body.data.question, agency: "DEMO", useCase: "reviewer-assistant" }, { scope: "demo" });
  if (!g.ok) return fail(g.status, g.error);

  try {
    return NextResponse.json(await answerDemoQuestion(g.input.question), { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("ask-demo failed:", err instanceof Error ? err.message : err);
    return fail(500, "Something went wrong while answering. Please try again.");
  }
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Cross-site requests are not allowed.");
  try {
    return await handle(req);
  } catch (err) {
    // Misconfiguration or an unexpected bug: log the detail, tell the browser nothing sensitive.
    console.error("ask-demo failed:", err instanceof Error ? err.message : err);
    return fail(500, "Something went wrong. Please try again.");
  }
}
