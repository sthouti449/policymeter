import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/db/supabase";
import { getEnv } from "@/lib/env";
import { isSameOrigin } from "@/lib/guardrails/origin";
import { checkRateLimit, clientIp, hashIp } from "@/lib/guardrails/rateLimit";

export const runtime = "nodejs";

const bodySchema = z.object({ requestId: z.string().uuid(), value: z.union([z.literal(1), z.literal(-1)]) });
const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Thumbs up/down. Stored on the answer row (the chat call) of that question. */
async function handle(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "Request body must be JSON.");
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) return fail(400, "Invalid feedback.");

  try {
    const ip = hashIp(clientIp(req.headers), getEnv().env.IP_HASH_SALT);
    if (!(await checkRateLimit(ip))) return fail(429, "Too many requests. Please wait a minute and try again.");

    // Store it on the chat row; a question refused after retrieval has only an embedding row.
    for (const operation of ["chat", "embed"]) {
      const { data, error } = await getSupabase()
        .from("llm_calls")
        .update({ feedback: body.data.value })
        .eq("request_id", body.data.requestId)
        .eq("operation", operation)
        .neq("use_case", "query-rewrite")
        .select("id");
      if (error) throw new Error(error.message);
      if (data?.length) return NextResponse.json({ ok: true });
    }
    return fail(404, "Unknown question.");
  } catch (err) {
    console.error("feedback failed:", err instanceof Error ? err.message : err);
    return fail(503, "Feedback could not be saved right now.");
  }
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return fail(403, "Cross-site requests are not allowed.");
  try {
    return await handle(req);
  } catch (err) {
    // Misconfiguration or an unexpected bug: log the detail, tell the browser nothing sensitive.
    console.error("feedback failed:", err instanceof Error ? err.message : err);
    return fail(500, "Something went wrong. Please try again.");
  }
}
