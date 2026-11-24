import { describe, expect, it } from "vitest";
import { JUDGE_PROMPT, judgeInput } from "@/lib/evals/judge";
import { toKeywordQuery } from "@/lib/rag/keyword";
import { SYSTEM_PROMPT } from "@/lib/rag/prompt";
import type { Source } from "@/lib/chat/types";

describe("toKeywordQuery", () => {
  it("joins the words with 'or', so a chunk matches when it has ANY of them", () => {
    expect(toKeywordQuery("What risk framework does the technology standard draw on?")).toBe("what or risk or framework or does or the or technology or standard or draw");
  });

  it("drops punctuation, possessives and one- or two-letter words", () => {
    expect(toKeywordQuery("Is the Commonwealth's AI registry (FOIA) public?")).toBe("the or commonwealth or registry or foia or public");
  });

  it("removes duplicates and keeps only the first twelve terms", () => {
    const q = toKeywordQuery("alpha alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november");
    expect(q.split(" or ")).toHaveLength(12);
    expect(q.startsWith("alpha or bravo")).toBe(true);
  });

  it("never lets the user inject search operators ('or' / 'and' words, quotes, minus signs)", () => {
    const q = toKeywordQuery('rescind OR "EO 30" -policy and agencies');
    expect(q).toBe("rescind or policy or agencies");
    expect(q).not.toMatch(/["\-()&|!:]/);
  });

  it("returns an empty string when nothing searchable is left", () => {
    expect(toKeywordQuery("?! a b")).toBe("");
    expect(toKeywordQuery("")).toBe("");
  });
});

describe("judge sees what the answering model saw", () => {
  const sources: Source[] = [
    { n: 1, chunkId: 1, docId: "eo30", title: "Executive Order 30 (2024)", page: 2, status: "rescinded", replacedBy: "Executive Order 22 (Sept 18, 2026)", url: null, content: "Body of EO 30.", similarity: 0.6 },
    { n: 2, chunkId: 2, docId: "eo22", title: "Executive Order 22 (2026)", page: null, status: "current", replacedBy: null, url: null, content: "Body of EO 22.", similarity: 0.5 },
  ];
  const input = judgeInput("Is EO 30 in effect?", sources, "No, it was rescinded and replaced by EO 22 [1].");

  it("includes each passage's title, page, status and replacement, not just its text", () => {
    expect(input).toContain("[1] Executive Order 30 (2024) — p.2 — status:rescinded; replaced_by: Executive Order 22 (Sept 18, 2026)\nBody of EO 30.");
    expect(input).toContain("[2] Executive Order 22 (2026) — no page — status:current\nBody of EO 22.");
  });

  it("lays out question, context and answer in order", () => {
    expect(input.indexOf("QUESTION:")).toBeLessThan(input.indexOf("CONTEXT:"));
    expect(input.indexOf("CONTEXT:")).toBeLessThan(input.indexOf("ANSWER:"));
  });

  it("tells the judge that header facts count as context", () => {
    expect(JUDGE_PROMPT).toMatch(/header line/i);
    expect(JUDGE_PROMPT).toMatch(/title, page and status/);
  });
});

describe("answer prompt discipline", () => {
  it("forbids inference and unprompted status remarks", () => {
    expect(SYSTEM_PROMPT).toMatch(/State only what the context says/);
    expect(SYSTEM_PROMPT).toMatch(/never say a source is "current"/);
  });
  it("still requires the rescinded warning", () => {
    expect(SYSTEM_PROMPT).toMatch(/status "rescinded", say so and name what replaced it/);
  });
});

describe("embeddingText", () => {
  it("puts the document title in front of the chunk for embedding", async () => {
    const { embeddingText } = await import("@/lib/rag/embedtext");
    expect(embeddingText("EA400 AI Utilization Policy", "The Task Force shall be co-led by...")).toBe("EA400 AI Utilization Policy\n\nThe Task Force shall be co-led by...");
  });
  it("leaves the text alone when there is no title", async () => {
    const { embeddingText } = await import("@/lib/rag/embedtext");
    expect(embeddingText(undefined, "plain")).toBe("plain");
    expect(embeddingText("", "plain")).toBe("plain");
  });
});

describe("blank answers are failures, and thinking is controlled", () => {
  it("assertNonEmpty throws a typed error for empty or whitespace-only text", async () => {
    const { assertNonEmpty, EmptyResponseError } = await import("@/lib/llm/empty");
    expect(() => assertNonEmpty("", 700, 700)).toThrow(EmptyResponseError);
    expect(() => assertNonEmpty("  \n\t ", 700, 700)).toThrow(/spent its whole budget on hidden reasoning/);
    expect(() => assertNonEmpty("An answer.", 20, 700)).not.toThrow();
    try { assertNonEmpty("", 700, 700); } catch (e) { expect((e as { code: string }).code).toBe("empty_response"); }
  });

  it("thinkingParam sends the right field for each mode", async () => {
    const { thinkingParam } = await import("@/lib/llm/thinking");
    expect(thinkingParam("disabled")).toEqual({ thinking: { type: "disabled" } });
    expect(thinkingParam("adaptive")).toEqual({ thinking: { type: "adaptive" } });
    expect(thinkingParam("omit")).toEqual({}); // send nothing: the model default applies
  });

  it("defaults: fast tier never thinks, smart tier keeps its default (it rejects 'disabled')", async () => {
    const { envSchema } = await import("@/lib/env");
    const e = envSchema.parse({});
    expect(e.ANTHROPIC_THINKING_FAST).toBe("disabled");
    expect(e.ANTHROPIC_THINKING_SMART).toBe("omit");
  });
});
