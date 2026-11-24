// Cleaning that happens before chunking. Pure functions, so they are easy to test.

/** A line that looks like a section heading: short, no sentence ending, and ALL CAPS or numbered. */
export function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80 || /[.,;]$/.test(t)) return false;
  const numbered = /^(\d+(\.\d+)*[.)]?|[A-Z][.)]|section\s+\d+|article\s+[ivx\d]+)\s+\S/i.test(t) && /^[A-Z0-9]/.test(t);
  const allCaps = /[A-Z]{3}/.test(t) && t === t.toUpperCase();
  return numbered || allCaps;
}

const isBullet = (line: string) => /^(\d+[.)]|[a-z][.)]|[-•*])\s/.test(line.trim());

/**
 * Turn raw PDF page text into paragraphs. PDFs break lines at the page margin,
 * not at sentence ends, so we re-join lines, and start a new paragraph at a blank
 * line, a heading or a bullet.
 */
export function toParagraphs(pageText: string): string[] {
  const lines = pageText.replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const out: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur) out.push(cur);
    cur = "";
  };
  for (const line of lines) {
    if (!line) {
      flush();
    } else if (isHeading(line) || isBullet(line)) {
      flush();
      cur = line;
      if (isHeading(line)) flush(); // a heading is its own block
    } else {
      cur = cur ? `${cur} ${line}` : line;
    }
  }
  flush();
  return out;
}

// Digits become "#" so "Page 3 of 40" and "Page 4 of 40" count as the same line.
const shape = (line: string) => line.trim().replace(/\d+/g, "#").toLowerCase();

/**
 * Remove running headers and footers: lines whose shape appears on more than 50%
 * of pages (needs at least 4 pages), plus lines that are only a page number.
 */
export function stripRepeatedLines(pages: string[]): string[] {
  const perPage = pages.map((p) => new Set(p.split("\n").map(shape).filter(Boolean)));
  const counts = new Map<string, number>();
  for (const set of perPage) for (const s of set) counts.set(s, (counts.get(s) ?? 0) + 1);

  const repeated = new Set<string>();
  if (pages.length >= 4) for (const [s, n] of counts) if (n / pages.length > 0.5) repeated.add(s);

  return pages.map((p) =>
    p
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        if (/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/i.test(t)) return false; // bare page numbers
        return !repeated.has(shape(line));
      })
      .join("\n"),
  );
}

/** Pages whose text is suspiciously short, which usually means a scan with no text layer. */
export function thinPages(pages: string[], minChars = 200): number[] {
  return pages.flatMap((p, i) => (p.replace(/\s+/g, " ").trim().length < minChars ? [i + 1] : []));
}
