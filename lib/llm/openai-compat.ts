import type OpenAI from "openai";
import { getEnv } from "@/lib/env";
import type { ProviderImpl } from "./types";
import { estimateUsage, fromOpenAI } from "./usage";

// Azure OpenAI and OpenAI speak the same API, so one implementation serves both.
// The two provider files only differ in how they build the client.

const inputText = (m: { content: string }[]) => m.map((x) => x.content).join("\n");

// GPT-5-family models can burn max tokens on hidden reasoning. When
// OPENAI_REASONING_EFFORT is set we send it; otherwise we leave it out.
function params(maxTokens: number) {
  const effort = getEnv().env.OPENAI_REASONING_EFFORT;
  return {
    max_completion_tokens: maxTokens, // max_tokens is rejected by newer models
    ...(effort ? { reasoning_effort: effort as "low" } : {}),
  };
}

export function makeOpenAICompat(client: OpenAI): ProviderImpl {
  return {
    async chat({ messages, model, maxTokens }) {
      const res = await client.chat.completions.create({ model: model.model, messages, ...params(maxTokens) });
      const text = res.choices[0]?.message?.content ?? "";
      return { text, usage: fromOpenAI(res.usage) ?? estimateUsage(inputText(messages), text) };
    },

    async *stream({ messages, model, maxTokens }) {
      const stream = await client.chat.completions.create({
        model: model.model,
        messages,
        stream: true,
        stream_options: { include_usage: true }, // usage arrives on the final chunk
        ...params(maxTokens),
      });
      let text = "";
      let usage = null;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          text += delta;
          yield { delta };
        }
        if (chunk.usage) usage = fromOpenAI(chunk.usage);
      }
      yield { usage: usage ?? estimateUsage(inputText(messages), text) };
    },

    async embed({ texts, model }) {
      const res = await client.embeddings.create({
        model: model.model,
        input: texts,
        dimensions: getEnv().env.EMBEDDING_DIMENSIONS,
      });
      const usage = fromOpenAI({ prompt_tokens: res.usage?.prompt_tokens }) ?? estimateUsage(texts.join("\n"), "");
      return { vectors: res.data.map((d) => d.embedding), usage };
    },
  };
}
