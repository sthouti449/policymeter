import { describe, expect, it } from "vitest";
import { chunkPages } from "@/lib/rag/chunk";
import { stripRepeatedLines } from "@/lib/rag/clean";
import { extractPages } from "@/lib/rag/pdf";
import { makePdf } from "./helpers/makePdf";

describe("PDF extraction (generated fixture)", () => {
  const pdf = makePdf([
    ["Header line", "Alpha policy text on the first page.", "Page 1 of 4"],
    ["Header line", "Bravo requirement for state agencies.", "Page 2 of 4"],
    ["Header line", "Charlie disclaimer wording lives here.", "Page 3 of 4"],
    ["Header line", "Delta registry rules are listed here.", "Page 4 of 4"],
  ]);

  it("returns one string per page, in order", async () => {
    const pages = await extractPages(pdf);
    expect(pages).toHaveLength(4);
    expect(pages[0]).toContain("Alpha");
    expect(pages[2]).toContain("Charlie");
  });

  it("keeps page numbers through cleaning and chunking", async () => {
    const pages = stripRepeatedLines(await extractPages(pdf));
    expect(pages.join("\n")).not.toContain("Header line"); // running header removed
    const chunks = chunkPages(pages);
    expect(chunks.map((c) => c.page)).toEqual([1, 2, 3, 4]);
    expect(chunks[2].content).toContain("Charlie");
  });
});
