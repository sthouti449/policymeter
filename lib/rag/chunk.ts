import { isHeading, toParagraphs } from "./clean";

export interface Chunk { index: number; page: number; content: string; tokenCount: number }

// Sizes in tokens, estimated as chars/4. Only used to size chunks, never for cost.
export const TARGET_TOKENS = 700;
export const OVERLAP_TOKENS = 100;
const tok = (s: string) => Math.ceil(s.length / 4);

/** Split one oversized paragraph at sentence ends, then at words as a last resort. */
function splitLong(text: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let cur = "";
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const part of sentence.length > maxChars ? sentence.match(new RegExp(`.{1,${maxChars}}(\\s|$)`, "g")) ?? [sentence] : [sentence]) {
      if (cur && cur.length + part.length + 1 > maxChars) {
        pieces.push(cur);
        cur = "";
      }
      cur = cur ? `${cur} ${part.trim()}` : part.trim();
    }
  }
  if (cur) pieces.push(cur);
  return pieces;
}

/** The last ~OVERLAP_TOKENS of a chunk, cut at a word boundary, to start the next one. */
function tail(text: string): string {
  const slice = text.slice(-OVERLAP_TOKENS * 4);
  const space = slice.indexOf(" ");
  return space > -1 && slice.length === OVERLAP_TOKENS * 4 ? slice.slice(space + 1) : slice;
}

/**
 * Chunk a document: ~700 tokens with a ~100-token overlap. Paragraphs and headings
 * are kept whole where possible, and a chunk NEVER spans two pages, so every
 * chunk has one exact page number for its citation.
 * pages[0] is page 1.
 */
export function chunkPages(pages: string[]): Chunk[] {
  const maxChars = TARGET_TOKENS * 4;
  // Pieces are capped below the chunk size so a piece PLUS the overlap carried in
  // from the previous chunk still fits within the target.
  const pieceMax = maxChars - OVERLAP_TOKENS * 4;
  const chunks: Chunk[] = [];

  pages.forEach((pageText, i) => {
    const page = i + 1;
    let cur = "";
    let fresh = true; // true while cur holds only overlap text, nothing new

    const close = () => {
      if (!fresh && cur.trim()) {
        chunks.push({ index: chunks.length, page, content: cur.trim(), tokenCount: tok(cur) });
      }
      cur = "";
      fresh = true;
    };

    for (const para of toParagraphs(pageText)) {
      for (const piece of para.length > pieceMax ? splitLong(para, pieceMax) : [para]) {
        // A heading starts a new section, unless the chunk so far is tiny.
        if (isHeading(piece) && !fresh && cur.length > maxChars / 4) close();
        if (!fresh && cur.length + piece.length + 2 > maxChars) {
          const carry = tail(cur);
          close();
          cur = carry; // overlap: repeat the end of the last chunk
        }
        cur = cur ? `${cur}\n\n${piece}` : piece;
        fresh = false;
      }
    }
    close(); // no overlap across pages
  });
  return chunks;
}
