import "server-only";
import { getEnv, type Provider } from "@/lib/env";
import { azureProvider } from "./azure";
import { anthropicProvider } from "./anthropic";
import { emit } from "./hook";
import { openaiProvider } from "./openai";
import { resolveChat, resolveEmbed } from "./resolve";
import type { CallMeta, CallRecord, ChatArgs, ChatResult, EmbedResult, ProviderImpl, ResolvedModel, StreamEvent, Usage } from "./types";
import { ZERO_USAGE } from "./usage";

// The ONLY module that talks to a model SDK (CLAUDE.md rule 1). Every call ends
// with emit() in a finally block, so failed calls are metered too (rule 2).

export type { CallMeta, ChatArgs, ChatResult, EmbedResult, StreamEvent, Usage } from "./types";
export { registerOnComplete } from "./hook";

const impls = (p: Provider): ProviderImpl =>
  p === "azure" ? azureProvider() : p === "openai" ? openaiProvider() : anthropicProvider;

function errorCode(err: unknown): string {
  const e = err as { status?: number; code?: string; name?: string };
  return e?.status ? `http_${e.status}` : (e?.code ?? e?.name ?? "unknown");
}

function record(op: "chat" | "embed", m: ResolvedModel, meta: CallMeta, start: number, usage: Usage, ttftMs: number | null, err?: unknown): CallRecord {
  return {
    operation: op, provider: m.provider, model: m.pricingKey, deployment: m.deployment, usage,
    latencyMs: Math.round(performance.now() - start), ttftMs,
    status: err ? "error" : "ok", errorCode: err ? errorCode(err) : undefined, meta,
  };
}

export async function chat(args: ChatArgs): Promise<ChatResult> {
  const { env, providers } = getEnv();
  const model = resolveChat(env, providers.chat, args.tier);
  const start = performance.now();
  let usage = ZERO_USAGE;
  let failure: unknown;
  try {
    const res = await impls(model.provider).chat({ messages: args.messages, model, maxTokens: args.maxTokens });
    usage = res.usage;
    return { text: res.text, usage, model: model.pricingKey, provider: model.provider, latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    failure = err;
    throw err;
  } finally {
    await emit(record("chat", model, args.meta, start, usage, null, failure));
  }
}

export async function* chatStream(args: ChatArgs): AsyncGenerator<StreamEvent> {
  const { env, providers } = getEnv();
  const model = resolveChat(env, providers.chat, args.tier);
  const start = performance.now();
  let usage = ZERO_USAGE;
  let ttftMs: number | null = null;
  let text = "";
  let failure: unknown = undefined;
  let finished = false;
  try {
    for await (const ev of impls(model.provider).stream({ messages: args.messages, model, maxTokens: args.maxTokens })) {
      if ("delta" in ev) {
        ttftMs ??= Math.round(performance.now() - start); // time to first token
        text += ev.delta;
        yield ev;
      } else {
        usage = ev.usage;
      }
    }
    finished = true;
    yield { done: true, text, usage, model: model.pricingKey, provider: model.provider, latencyMs: Math.round(performance.now() - start), ttftMs };
  } catch (err) {
    failure = err;
    throw err;
  } finally {
    // If the consumer stopped early we still log the call, marked as aborted.
    await emit(record("chat", model, args.meta, start, usage, ttftMs, failure ?? (finished ? undefined : { code: "aborted" })));
  }
}

export async function embed(texts: string[], meta: CallMeta): Promise<EmbedResult> {
  const { env, providers } = getEnv();
  const model = resolveEmbed(env, providers.embed);
  const start = performance.now();
  let usage = ZERO_USAGE;
  let failure: unknown;
  try {
    const res = await impls(model.provider).embed({ texts, model });
    usage = res.usage;
    return { vectors: res.vectors, usage, model: model.pricingKey };
  } catch (err) {
    failure = err;
    throw err;
  } finally {
    await emit(record("embed", model, meta, start, usage, null, failure));
  }
}
