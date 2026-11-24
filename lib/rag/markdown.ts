// Markdown helpers for the "about" knowledge base. Pure functions, no I/O.

export interface MdChunk { content: string; tokenCount: number }

const MAX_CHARS = 2400; // keeps a chunk well under ~700 tokens (chars / 4)

/** Remove <!-- ... --> notes. The "EDIT BEFORE DEPLOYING" reminders must never reach the bot. */
export const stripComments = (src: string) => src.replace(/<!--[\s\S]*?-->/g, "");

/** Greedy-pack paragraphs into pieces of at most MAX_CHARS (a lone huge paragraph is cut at a word). */
function pack(body: string): string[] {
  const pieces: string[] = [];
  let cur = "";
  for (const para of body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    for (const part of para.length > MAX_CHARS ? (para.match(new RegExp(`[\\s\\S]{1,${MAX_CHARS}}(\\s|$)`, "g")) ?? [para]) : [para]) {
      if (cur && cur.length + part.length + 2 > MAX_CHARS) {
        pieces.push(cur);
        cur = "";
      }
      cur = cur ? `${cur}\n\n${part.trim()}` : part.trim();
    }
  }
  if (cur) pieces.push(cur);
  return pieces;
}

/**
 * One chunk per heading section. Every chunk starts with "Document title: Section",
 * so a short section like "Contact" still says what it belongs to when retrieved alone.
 */
export function chunkMarkdown(source: string, fallbackTitle: string): { title: string; chunks: MdChunk[] } {
  const text = stripComments(source).replace(/\r/g, "");
  const title = /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? fallbackTitle;

  const sections: { heading: string; lines: string[] }[] = [{ heading: "", lines: [] }];
  for (const line of text.split("\n")) {
    const h = /^#{1,3}\s+(.+)$/.exec(line);
    if (h) sections.push({ heading: h[1].trim(), lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }

  const chunks: MdChunk[] = [];
  for (const s of sections) {
    const label = s.heading && s.heading !== title ? `${title}: ${s.heading}` : title;
    for (const piece of pack(s.lines.join("\n"))) {
      const content = `${label}\n\n${piece}`;
      chunks.push({ content, tokenCount: Math.ceil(content.length / 4) });
    }
  }
  return { title, chunks };
}

// ---------- tiny renderer model: just what jd-mapping.md and POC_SCORECARD.md use ----------

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "rule" };

export type Inline = { kind: "text" | "bold" | "code"; text: string } | { kind: "link"; text: string; href: string };

const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

export function parseMarkdown(source: string): Block[] {
  const lines = stripComments(source).replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    const h = /^(#{1,6})\s+(.+)$/.exec(line);
    if (!line.trim()) { i++; continue; }
    if (h) { blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() }); i++; continue; }
    if (/^---+\s*$/.test(line)) { blocks.push({ type: "rule" }); i++; continue; }
    if (line.trim().startsWith("|") && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? "")) {
      const header = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(cells(lines[i]));
      blocks.push({ type: "table", header, rows });
      continue;
    }
    const li = /^\s*(?:([-*])|(\d+)[.)])\s+/.exec(line);
    if (li) {
      const ordered = !!li[2];
      const items: string[] = [];
      for (; i < lines.length && /^\s*(?:[-*]|\d+[.)])\s+/.test(lines[i]); i++) items.push(lines[i].replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim());
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const para: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\||\s*(?:[-*]|\d+[.)])\s)/.test(lines[i]); i++) para.push(lines[i].trim());
    if (para.length) blocks.push({ type: "paragraph", text: para.join(" ") });
    else i++; // never loop forever on an unrecognised line
  }
  return blocks;
}

/** **bold**, `code` and [text](https://url). Only http(s) and mailto links are kept as links. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] != null) out.push({ kind: "bold", text: m[1] });
    else if (m[2] != null) out.push({ kind: "code", text: m[2] });
    else if (/^(https?:|mailto:)/i.test(m[4])) out.push({ kind: "link", text: m[3], href: m[4] });
    else out.push({ kind: "text", text: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
