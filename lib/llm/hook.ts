import type { CallRecord } from "./types";

// ---- METERING HOOK (Stage 1 plugs logCall in here) ----
// The adapter calls emit() in a finally block after EVERY chat, chatStream and
// embed call, including failures. Until Stage 1 registers a handler, it does nothing.

type Handler = (record: CallRecord) => Promise<void> | void;
let handler: Handler | undefined;

export function registerOnComplete(fn: Handler | undefined) {
  handler = fn;
}

/** Awaited, but a logging failure must never break the user's answer. */
export async function emit(record: CallRecord) {
  try {
    await handler?.(record);
  } catch (err) {
    console.error("metering hook failed:", err instanceof Error ? err.message : err);
  }
}
