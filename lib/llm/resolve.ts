import type { Env, Provider } from "@/lib/env";
import type { ResolvedModel, Tier } from "./types";

// Model names come from env, never from code (CLAUDE.md rule 4).
// Pricing keys for OpenAI/Anthropic are "<provider>:<model>"; Azure sets its own in env.

export function resolveChat(env: Env, provider: Provider, tier: Tier): ResolvedModel {
  const fast = tier === "fast";
  if (provider === "azure") {
    const deployment = (fast ? env.AZURE_CHAT_DEPLOYMENT_FAST : env.AZURE_CHAT_DEPLOYMENT_SMART)!;
    const pricingKey = (fast ? env.AZURE_CHAT_FAST_PRICING_KEY : env.AZURE_CHAT_SMART_PRICING_KEY)!;
    return { provider, model: deployment, deployment, pricingKey };
  }
  const model = (provider === "openai"
    ? fast ? env.OPENAI_CHAT_MODEL_FAST : env.OPENAI_CHAT_MODEL_SMART
    : fast ? env.ANTHROPIC_MODEL_FAST : env.ANTHROPIC_MODEL_SMART)!;
  return { provider, model, pricingKey: `${provider}:${model}` };
}

export function resolveEmbed(env: Env, provider: "azure" | "openai"): ResolvedModel {
  if (provider === "azure") {
    const deployment = env.AZURE_EMBED_DEPLOYMENT!;
    return { provider, model: deployment, deployment, pricingKey: env.AZURE_EMBED_PRICING_KEY! };
  }
  const model = env.OPENAI_EMBED_MODEL!;
  return { provider, model, pricingKey: `openai:${model}` };
}
