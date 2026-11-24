import "server-only";
import OpenAI from "openai";
import { getEnv } from "@/lib/env";
import { makeOpenAICompat } from "./openai-compat";
import type { ProviderImpl } from "./types";

let impl: ProviderImpl | undefined;

export function openaiProvider(): ProviderImpl {
  return (impl ??= makeOpenAICompat(new OpenAI({ apiKey: getEnv().env.OPENAI_API_KEY })));
}
