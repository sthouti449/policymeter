import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "@/lib/env";
import type { Msg, ProviderImpl } from "./types";
import { estimateUsage, fromAnthropic } from "./usage";

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic({ apiKey: getEnv().env.ANTHROPIC_API_KEY }));

// Anthropic takes the system prompt separately from the chat turns.
function split(messages: Msg[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns = messages.filter((m) => m.role !== "system") as { role: "user" | "assistant"; content: string }[];
  return { system: system || undefined, turns };
}

// Low effort keeps hidden thinking small, so max_tokens is spent on the answer.
// No temperature/top_p: current Claude models reject non-default sampling values.
function base(messages: Msg[], model: string, maxTokens: number) {
  const { system, turns } = split(messages);
  return {
    model,
    max_tokens: maxTokens,
    system,
    messages: turns,
    output_config: { effort: getEnv().env.ANTHROPIC_EFFORT },
  };
}

const textOf = (content: Anthropic.ContentBlock[]) =>
  content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");

export const anthropicProvider: ProviderImpl = {
  async chat({ messages, model, maxTokens }) {
    const res = await getClient().messages.create(base(messages, model.model, maxTokens));
    const text = textOf(res.content);
    return { text, usage: fromAnthropic(res.usage) ?? estimateUsage(messages.map((m) => m.content).join("\n"), text) };
  },

  async *stream({ messages, model, maxTokens }) {
    const stream = getClient().messages.stream(base(messages, model.model, maxTokens));
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { delta: event.delta.text };
      }
    }
    // Usage (including cache reads/writes) is complete on the final message.
    const final = await stream.finalMessage();
    yield { usage: fromAnthropic(final.usage) ?? estimateUsage(messages.map((m) => m.content).join("\n"), textOf(final.content)) };
  },

  async embed() {
    // Guarded earlier by selectProviders(); this is a last line of defence.
    throw new Error("Anthropic has no embeddings API. Configure Azure OpenAI or OpenAI for embeddings.");
  },
};
