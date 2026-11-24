import { describe, expect, it } from "vitest";
import { chunkPages, OVERLAP_TOKENS, TARGET_TOKENS } from "@/lib/rag/chunk";
import { isHeading, stripRepeatedLines, thinPages, toParagraphs } from "@/lib/rag/clean";
import { rrf } from "@/lib/rag/fuse";

const sentence = "Agencies must complete an impact assessment before deploying a system that uses personal information. ";
const longText = (chars: number) => sentence.repeat(Math.ceil(chars / sentence.length)).slice(0, chars);

describe("chunkPages", () => {
  it("makes one chunk for a short page and records its page number", () => {
    const [c, ...rest] = chunkPages(["Short page about disclaimers."]);
    expect(rest).toHaveLength(0);
    expect(c).toMatchObject({ index: 0, page: 1, content: "Short page about disclaimers." });
  });

  it("never lets a chunk span two pages", () => {
    const chunks = chunkPages([longText(1500), longText(1500), longText(1500)]);
    expect(new Set(chunks.map((c) => c.page))).toEqual(new Set([1, 2, 3]));
    for (const c of chunks) expect(c.content).not.toMatch(/^$/);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i)); // global, sequential
  });

  it("keeps chunks near the target size", () => {
    const chunks = chunkPages([longText(12_000)]);
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(TARGET_TOKENS + 5);
  });

  it("overlaps consecutive chunks on the same page by about 100 tokens", () => {
    const [a, b] = chunkPages([longText(8_000)]);
    const tail = a.content.slice(-60);
    expect(b.content.slice(0, OVERLAP_TOKENS * 4 + 100)).toContain(tail.slice(-30));
  });

  it("splits one huge unbroken paragraph instead of making a giant chunk", () => {
    const chunks = chunkPages(["word ".repeat(6_000)]);
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(TARGET_TOKENS + 5);
  });

  it("starts a new chunk at a heading once the current one has some size", () => {
    const page = `${longText(1500)}\n\nSECTION TWO REQUIREMENTS\n\nThe next section starts here.`;
    const chunks = chunkPages([page]);
    expect(chunks.length).toBe(2);
    expect(chunks[1].content.startsWith("SECTION TWO REQUIREMENTS")).toBe(true);
  });

  it("returns nothing for empty pages", () => {
    expect(chunkPages(["", "   \n  "])).toEqual([]);
  });
});

describe("cleaning", () => {
  it("recognises headings but not ordinary sentences", () => {
    expect(isHeading("PURPOSE AND SCOPE")).toBe(true);
    expect(isHeading("3.2 Registration requirements")).toBe(true);
    expect(isHeading("Agencies must register their systems.")).toBe(false);
  });

  it("re-joins margin-broken lines into paragraphs", () => {
    expect(toParagraphs("Agencies must register\ntheir AI systems\nwith VITA.\n\nNext paragraph.")).toEqual([
      "Agencies must register their AI systems with VITA.",
      "Next paragraph.",
    ]);
  });

  it("removes headers and footers that repeat on more than half the pages", () => {
    const pages = ["VITA POLICY\nbody one\nPage 1 of 5", "VITA POLICY\nbody two\nPage 2 of 5", "VITA POLICY\nbody three\nPage 3 of 5", "other\nbody four\nPage 4 of 5"];
    const out = stripRepeatedLines(pages).join("|");
    expect(out).not.toContain("VITA POLICY");
    expect(out).not.toContain("Page");
    expect(out).toContain("body three");
  });

  it("does not strip repeats from very short documents", () => {
    expect(stripRepeatedLines(["Notice\nA", "Notice\nB"])[0]).toContain("Notice");
  });

  it("flags pages with under 200 characters", () => {
    expect(thinPages(["x".repeat(300), "short", "y".repeat(250)])).toEqual([2]);
  });
});

describe("rrf", () => {
  it("ranks items found by both lists above items found by one", () => {
    expect(rrf([[1, 2, 3], [3, 4, 1]])).toEqual([1, 3, 2, 4]);
  });

  it("handles an empty list", () => {
    expect(rrf([[5, 6], []])).toEqual([5, 6]);
  });
});
