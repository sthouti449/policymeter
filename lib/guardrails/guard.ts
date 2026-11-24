import "server-only";
import { getEnv } from "@/lib/env";
import { checkDailyCap, type CapScope } from "./dailyCap";
import { makeInputSchema, type GuardInput } from "./input";
import { checkRateLimit, clientIp, hashIp } from "./rateLimit";

export interface GuardOptions {
  scope: CapScope; // which daily cap applies
  bypassRateLimit?: boolean; // evals and ingestion: still metered, never rate limited
  allowInternalUseCases?: boolean;
}

export type GuardResult =
  | { ok: true; input: GuardInput; ipHash: string }
  | { ok: false; status: 400 | 429 | 503; error: string };

export const CAP_MESSAGE =
  "The demo has hit its spending limit for today. That limit is one of the guardrails being demonstrated.";

/**
 * Runs before ANY model call: validate input, rate limit, daily cap.
 * If the database can't be reached we fail closed (503), because without it the
 * spend cap can't be checked.
 */
export async function guard(
  req: { headers: { get(name: string): string | null } },
  body: unknown,
  opts: GuardOptions,
): Promise<GuardResult> {
  const { env } = getEnv();

  const parsed = makeInputSchema(env.MAX_QUESTION_CHARS, { allowInternal: opts.allowInternalUseCases }).safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const ipHash = hashIp(clientIp(req.headers), env.IP_HASH_SALT);
  try {
    if (!opts.bypassRateLimit && !(await checkRateLimit(ipHash))) {
      return { ok: false, status: 429, error: "Too many requests. Please wait a minute and try again." };
    }
    if ((await checkDailyCap(opts.scope)).blocked) {
      return { ok: false, status: 429, error: CAP_MESSAGE };
    }
  } catch (err) {
    console.error("guard failed closed:", err instanceof Error ? err.message : err);
    return { ok: false, status: 503, error: "The service is temporarily unavailable. Please try again shortly." };
  }
  return { ok: true, input: parsed.data, ipHash };
}
