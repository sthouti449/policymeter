import { Inline } from "@/components/Markdown";
import { parseMarkdown } from "@/lib/rag/markdown";

/** content/about-kb/jd-mapping.md is split into one card per "## heading": a title and its paragraph. */
export function Role({ source }: { source: string }) {
  const cards: { title: string; text: string }[] = [];
  for (const b of parseMarkdown(source)) {
    if (b.type === "heading" && b.level >= 2) cards.push({ title: b.text, text: "" });
    else if (b.type === "paragraph" && cards.length) {
      const last = cards[cards.length - 1];
      last.text += `${last.text ? " " : ""}${b.text}`;
    }
  }
  return (
    <section aria-labelledby="role" className="mx-auto max-w-7xl px-4 py-16">
      <p className="eyebrow">Built for the role</p>
      <h2 id="role" className="mt-2 max-w-2xl text-3xl font-semibold text-ink-900">How this maps to the role</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {cards.map((c) => (
          <article key={c.title} className="card p-6">
            <h3 className="text-base font-semibold leading-snug text-ink-900">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600"><Inline text={c.text} /></p>
          </article>
        ))}
      </div>
    </section>
  );
}
