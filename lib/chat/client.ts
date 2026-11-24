import type { ChatEvent, ChatTurn } from "./types";

/**
 * POST to /api/chat and call onEvent for every server-sent event.
 * Guard failures (400, 429, 503) come back as plain JSON, so they become Errors
 * whose message is already safe and friendly to show.
 */
export async function streamChat(
  body: { messages: ChatTurn[]; agency: string; useCase: string },
  onEvent: (ev: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: "Something went wrong. Please try again." }));
    throw new Error(err.error ?? "Something went wrong. Please try again.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? ""; // the last piece may be an unfinished frame
    for (const frame of frames) {
      if (frame.startsWith("data: ")) onEvent(JSON.parse(frame.slice(6)) as ChatEvent);
    }
  }
}

export async function sendFeedback(requestId: string, value: 1 | -1): Promise<boolean> {
  const res = await fetch("/api/feedback", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId, value }),
  });
  return res.ok;
}

export const DISCLAIMER = "DISCLAIMER: This output was created with assistance from artificial intelligence.";

export const formatCost = (usd: number) => `$${usd < 1 ? usd.toFixed(4) : usd.toFixed(2)}`;
