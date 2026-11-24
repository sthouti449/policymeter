import type { Usage } from "./types";

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Used when a provider returns no usage block. chars/4 is a rough token guess. */
export function estimateUsage(inputText: string, outputText: string): Usage {
  return {
    inputTokens: Math.ceil(inputText.length / 4),
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: Math.ceil(outputText.length / 4),
    estimated: true,
  };
}

/** OpenAI + Azure: prompt_tokens already INCLUDES cached tokens. */
export function fromOpenAI(u: {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number } | null;
} | null | undefined): Usage | null {
  if (!u) return null;
  return {
    inputTokens: n(u.prompt_tokens),
    cachedInputTokens: n(u.prompt_tokens_details?.cached_tokens),
    cacheWriteTokens: 0,
    outputTokens: n(u.completion_tokens), // reasoning tokens are already inside this number
    estimated: false,
  };
}

/** Anthropic: input_tokens EXCLUDES cache reads and writes, so add them back. */
export function fromAnthropic(u: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined): Usage | null {
  if (!u) return null;
  const read = n(u.cache_read_input_tokens);
  const write = n(u.cache_creation_input_tokens);
  return {
    inputTokens: n(u.input_tokens) + read + write,
    cachedInputTokens: read,
    cacheWriteTokens: write,
    outputTokens: n(u.output_tokens),
    estimated: false,
  };
}

export const ZERO_USAGE: Usage = { inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, estimated: false };
