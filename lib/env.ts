import "server-only";
import { z } from "zod";

// Every variable is optional here; which ones are REQUIRED depends on the
// provider you pick, and selectProviders() checks that with a readable message.
const str = z.string().trim().optional().transform((v) => (v ? v : undefined));
const num = (def: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().default(def));

const providerName = z.enum(["auto", "azure", "openai", "anthropic"]).default("auto");

export const envSchema = z.object({
  LLM_CHAT_PROVIDER: providerName,
  LLM_EMBED_PROVIDER: providerName,

  AZURE_OPENAI_ENDPOINT: str,
  AZURE_OPENAI_API_KEY: str,
  AZURE_OPENAI_API_VERSION: str,
  AZURE_CHAT_DEPLOYMENT_FAST: str,
  AZURE_CHAT_DEPLOYMENT_SMART: str,
  AZURE_EMBED_DEPLOYMENT: str,
  AZURE_CHAT_FAST_PRICING_KEY: str,
  AZURE_CHAT_SMART_PRICING_KEY: str,
  AZURE_EMBED_PRICING_KEY: str,

  OPENAI_API_KEY: str,
  OPENAI_CHAT_MODEL_FAST: str,
  OPENAI_CHAT_MODEL_SMART: str,
  OPENAI_EMBED_MODEL: str,
  // Only sent when set. GPT-5-family models spend max tokens on hidden reasoning.
  OPENAI_REASONING_EFFORT: str,

  ANTHROPIC_API_KEY: str,
  ANTHROPIC_MODEL_FAST: str,
  ANTHROPIC_MODEL_SMART: str,
  ANTHROPIC_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  // Hidden thinking uses the max_tokens budget. The fast tier answers in 700 tokens, so it must not think:
  // with thinking on, Haiku 5.5 once spent all 700 tokens thinking and returned a blank answer.
  // The smart tier (the judge) is a model that REJECTS "disabled", so it uses its own default.
  ANTHROPIC_THINKING_FAST: z.enum(["disabled", "adaptive", "omit"]).default("disabled"),
  ANTHROPIC_THINKING_SMART: z.enum(["disabled", "adaptive", "omit"]).default("omit"),

  SUPABASE_URL: str,
  SUPABASE_SERVICE_ROLE_KEY: str,
  ALERT_WEBHOOK_URL: str,
  IP_HASH_SALT: z.string().default("dev-salt-change-me"),
  ADMIN_TOKEN: str,

  // Spend guardrails. The widget has its own cap so reviewers are never locked out.
  DAILY_SPEND_CAP_USD: num(2),
  DEMO_DAILY_SPEND_CAP_USD: num(0.5),
  RATE_LIMIT_PER_MINUTE: num(8),
  RATE_LIMIT_READS_PER_MINUTE: num(60), // dashboard and trace reads, a separate bucket from questions
  MAX_QUESTION_CHARS: num(1000),

  EMBEDDING_DIMENSIONS: num(1536),
  RAG_MATCH_COUNT: num(6),
  RAG_MIN_SIMILARITY: num(0.42), // calibrated with npm run calibrate (see README)
  RAG_HYBRID: z.enum(["true", "false"]).default("true"),
});

export type Env = z.infer<typeof envSchema>;
export type Provider = "azure" | "openai" | "anthropic";
export interface ActiveProviders {
  chat: Provider;
  embed: Exclude<Provider, "anthropic">;
}

export class ConfigError extends Error {}

const need = (env: Env, keys: (keyof Env)[]) => keys.filter((k) => !env[k]);

const REQUIRED: Record<Provider, (keyof Env)[]> = {
  azure: [
    "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_VERSION",
    "AZURE_CHAT_DEPLOYMENT_FAST", "AZURE_CHAT_DEPLOYMENT_SMART",
    "AZURE_CHAT_FAST_PRICING_KEY", "AZURE_CHAT_SMART_PRICING_KEY",
  ],
  openai: ["OPENAI_API_KEY", "OPENAI_CHAT_MODEL_FAST", "OPENAI_CHAT_MODEL_SMART"],
  anthropic: ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL_FAST", "ANTHROPIC_MODEL_SMART"],
};
const EMBED_REQUIRED: Record<"azure" | "openai", (keyof Env)[]> = {
  azure: ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_VERSION", "AZURE_EMBED_DEPLOYMENT", "AZURE_EMBED_PRICING_KEY"],
  openai: ["OPENAI_API_KEY", "OPENAI_EMBED_MODEL"],
};

// A provider counts as "configured" for auto mode when its key is present.
const hasKey = (env: Env, p: Provider) =>
  p === "azure" ? !!(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_API_KEY)
  : p === "openai" ? !!env.OPENAI_API_KEY
  : !!env.ANTHROPIC_API_KEY;

/** Decide which provider serves chat and which serves embeddings (pure, testable). */
export function selectProviders(env: Env): ActiveProviders {
  const chat: Provider | undefined =
    env.LLM_CHAT_PROVIDER !== "auto" ? env.LLM_CHAT_PROVIDER
    : (["azure", "openai", "anthropic"] as const).find((p) => hasKey(env, p));

  // Anthropic has no embeddings API, so embeddings only come from Azure or OpenAI.
  if (env.LLM_EMBED_PROVIDER === "anthropic") {
    throw new ConfigError("LLM_EMBED_PROVIDER=anthropic is not possible: Anthropic has no embeddings API. Use azure or openai.");
  }
  const embed = env.LLM_EMBED_PROVIDER !== "auto" ? env.LLM_EMBED_PROVIDER
    : (["azure", "openai"] as const).find((p) => hasKey(env, p));

  if (!chat) throw new ConfigError("No chat provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or the AZURE_OPENAI_* variables (see .env.example).");
  if (!embed) throw new ConfigError("No embedding provider configured. Embeddings need OPENAI_API_KEY or Azure OpenAI (Anthropic has no embeddings API).");

  const missing = [...need(env, REQUIRED[chat]), ...need(env, EMBED_REQUIRED[embed])];
  if (missing.length) throw new ConfigError(`Missing environment variables for ${chat} chat + ${embed} embeddings: ${[...new Set(missing)].join(", ")}`);
  return { chat, embed };
}

/** In production the IP-hash salt must be a real secret, or stored hashes could be reversed by brute force. */
export function assertProductionSecrets(env: Env, nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv === "production" && (env.IP_HASH_SALT === "dev-salt-change-me" || env.IP_HASH_SALT.length < 16 || env.IP_HASH_SALT === "change-me-to-a-random-string")) {
    throw new ConfigError("IP_HASH_SALT must be set to a random secret of at least 16 characters in production.");
  }
}

let cached: { env: Env; providers: ActiveProviders } | undefined;

/** Parse process.env once and fail fast with a readable message. */
export function getEnv() {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
      throw new ConfigError(`Invalid environment variables:\n${lines.join("\n")}`);
    }
    assertProductionSecrets(parsed.data);
    cached = { env: parsed.data, providers: selectProviders(parsed.data) };
  }
  return cached;
}

export function resetEnvCache() {
  cached = undefined;
}
