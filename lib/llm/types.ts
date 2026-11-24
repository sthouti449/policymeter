import type { Provider } from "@/lib/env";

export type Tier = "fast" | "smart";
export interface Msg { role: "system" | "user" | "assistant"; content: string }

/** Who and what a call is for. Stage 1 writes this to llm_calls. */
export interface CallMeta {
  requestId: string;
  agency: string;
  useCase: string;
  simulated?: boolean;
  // Optional context stored with the row. The question is redacted before storage.
  question?: string;
  topSimilarity?: number;
  retrievedChunkIds?: number[];
}

/**
 * Normalised usage. inputTokens is the TOTAL prompt size, cached tokens included
 * (OpenAI's meaning). Anthropic reports cache reads/writes separately from
 * input_tokens, so usage.ts adds them back in. Cost code can then always do:
 *   uncached = inputTokens - cachedInputTokens - cacheWriteTokens
 */
export interface Usage {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number; // includes hidden reasoning tokens, which are billed as output
  estimated: boolean; // true only when the provider returned no usage at all
}

export interface ResolvedModel {
  provider: Provider;
  model: string; // name sent to the API (an Azure deployment name for Azure)
  pricingKey: string; // key into config/pricing.json
  deployment?: string;
}

export interface ChatArgs { messages: Msg[]; tier: Tier; maxTokens: number; meta: CallMeta }
export interface ChatResult { text: string; usage: Usage; model: string; provider: Provider; latencyMs: number }
export type StreamEvent =
  | { delta: string }
  | { done: true; text: string; usage: Usage; model: string; provider: Provider; latencyMs: number; ttftMs: number | null };
export interface EmbedResult { vectors: number[][]; usage: Usage; model: string }

/** What the metering hook receives after every call, successful or not. */
export interface CallRecord {
  operation: "chat" | "embed";
  provider: Provider;
  model: string; // pricing key
  deployment?: string;
  usage: Usage;
  latencyMs: number;
  ttftMs: number | null;
  status: "ok" | "error";
  errorCode?: string;
  meta: CallMeta;
}

/** What each provider file implements. index.ts adds timing, errors and the hook. */
export interface ProviderImpl {
  chat(a: { messages: Msg[]; model: ResolvedModel; maxTokens: number }): Promise<{ text: string; usage: Usage }>;
  stream(a: { messages: Msg[]; model: ResolvedModel; maxTokens: number }): AsyncGenerator<{ delta: string } | { usage: Usage }>;
  embed(a: { texts: string[]; model: ResolvedModel }): Promise<{ vectors: number[][]; usage: Usage }>;
}
