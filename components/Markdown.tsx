import type { ReactNode } from "react";
import { parseInline, parseMarkdown, type Block } from "@/lib/rag/markdown";

// Renders the small markdown subset used by content/about-kb/jd-mapping.md and
// docs/POC_SCORECARD.md. No raw HTML is ever injected, so file contents can't add markup.

export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) =>
        t.kind === "bold" ? <strong key={i}>{t.text}</strong>
        : t.kind === "code" ? <code key={i} className="rounded bg-neutral-100 px-1 py-0.5 text-[0.85em]">{t.text}</code>
        : t.kind === "link" ? <a key={i} href={t.href} target="_blank" rel="noreferrer" className="text-blue-700 underline">{t.text}</a>
        : <span key={i}>{t.text}</span>,
      )}
    </>
  );
}

const HEADING = ["text-2xl font-semibold", "text-xl font-semibold mt-8", "text-lg font-semibold mt-6", "font-semibold mt-4"];

function renderBlock(b: Block, key: number, offset: number): ReactNode {
  switch (b.type) {
    case "heading": {
      const level = Math.min(6, b.level + offset);
      const Tag = `h${level}` as "h2";
      return <Tag key={key} className={HEADING[Math.min(3, level - 1)]}><Inline text={b.text} /></Tag>;
    }
    case "paragraph": return <p key={key} className="mt-2 leading-relaxed"><Inline text={b.text} /></p>;
    case "rule": return <hr key={key} className="my-6" />;
    case "list": {
      const List = b.ordered ? "ol" : "ul";
      return (
        <List key={key} className={`mt-2 space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"}`}>
          {b.items.map((it, i) => <li key={i}><Inline text={it} /></li>)}
        </List>
      );
    }
    case "table":
      return (
        <div key={key} className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead><tr>{b.header.map((h, i) => <th key={i} className="border-b px-2 py-1.5 text-left font-medium"><Inline text={h} /></th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b px-2 py-1.5 align-top"><Inline text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
  }
}

/** headingOffset shifts levels (1 makes "#" an h2), and dropTitle skips a leading "# Title". */
export function Markdown({ source, headingOffset = 0, dropTitle = false }: { source: string; headingOffset?: number; dropTitle?: boolean }) {
  const blocks = parseMarkdown(source);
  const body = dropTitle && blocks[0]?.type === "heading" && blocks[0].level === 1 ? blocks.slice(1) : blocks;
  return <div>{body.map((b, i) => renderBlock(b, i, headingOffset))}</div>;
}
