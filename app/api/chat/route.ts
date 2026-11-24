import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/guardrails/guard";
import { isSameOrigin } from "@/lib/guardrails/origin";
import { answerPolicyQuestion } from "@/lib/rag/answer";
import type { ChatEvent } from "@/lib/chat/types";

export const runtime = "nodejs"; // not Edge (CLAUDE.md)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).min(1).max(20),
  agency: z.string(),
  useCase: z.string(),
});

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

async function handle(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "Request body must be JSON.");
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) return fail(400, "Invalid request: expected messages, agency and useCase.");

  const { messages, agency, useCase } = body.data;
  if (agency === "DEMO") return fail(400, "Unknown agency."); // DEMO is reserved for the reviewer widget
  const last = messages[messages.length - 1];
  if (last.role !== "user") return fail(400, "The last message must be from the user.");

  // guard() validates the tags and the question length, then rate limit and daily cap.
  const g = await guard(req, { question: last.content, agency, useCase }, { scope: "global" });
  if (!g.ok) return fail(g.status, g.error);

  const events = answerPolicyQuestion({ history: messages.slice(0, -1), question: g.input.question, agency, useCase });
  const encoder = new TextEncoder();
  const send = (c: ReadableStreamDefaultController, ev: ChatEvent) => c.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of events) send(controller, ev);
      } catch (err) {
        // Log the detail on the server; send the browser a safe message (no stack traces).
        console.error("chat pipeline failed:", err instanceof Error ? err.message : err);
        send(controller, { type: "error", message: "Something went wrong while answering. Please try again." });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
  });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Cross-site requests are not allowed.");
  try {
    return await handle(req);
  } catch (err) {
    // Misconfiguration or an unexpected bug: log the detail, tell the browser nothing sensitive.
    console.error("chat failed:", err instanceof Error ? err.message : err);
    return fail(500, "Something went wrong. Please try again.");
  }
}
