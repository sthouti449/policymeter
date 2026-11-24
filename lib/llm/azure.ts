import "server-only";
import { AzureOpenAI } from "openai";
import { getEnv } from "@/lib/env";
import { makeOpenAICompat } from "./openai-compat";
import type { ProviderImpl } from "./types";

let impl: ProviderImpl | undefined;

// The "model" we pass on each call is the Azure DEPLOYMENT name (see resolve.ts).
export function azureProvider(): ProviderImpl {
  if (!impl) {
    const { env } = getEnv();
    impl = makeOpenAICompat(
      new AzureOpenAI({
        endpoint: env.AZURE_OPENAI_ENDPOINT,
        apiKey: env.AZURE_OPENAI_API_KEY,
        apiVersion: env.AZURE_OPENAI_API_VERSION,
      }),
    );
  }
  return impl;
}
