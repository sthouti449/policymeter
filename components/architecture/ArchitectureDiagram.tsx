// The component map from docs/ARCHITECTURE.md section 1, drawn as SVG (not ASCII).
// Colours use currentColor and neutral classes so it reads on a white page.

interface BoxProps { x: number; y: number; w: number; h: number; title: string; lines: string[]; tone?: "ui" | "api" | "lib" | "data" }

const TONE = {
  ui: "fill-sky-50 stroke-sky-300",
  api: "fill-indigo-50 stroke-indigo-300",
  lib: "fill-emerald-50 stroke-emerald-300",
  data: "fill-amber-50 stroke-amber-300",
} as const;

function Box({ x, y, w, h, title, lines, tone = "lib" }: BoxProps) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={12} className={TONE[tone]} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + 24} textAnchor="middle" className="fill-neutral-900 text-[14px] font-semibold">{title}</text>
      {lines.map((l, i) => (
        <text key={i} x={x + w / 2} y={y + 44 + i * 16} textAnchor="middle" className="fill-neutral-600 text-[11.5px]">{l}</text>
      ))}
    </g>
  );
}

const Arrow = ({ x, y1, y2 }: { x: number; y1: number; y2: number }) => (
  <line x1={x} y1={y1} x2={x} y2={y2} className="stroke-neutral-500" strokeWidth={1.5} markerEnd="url(#arrow)" />
);

export function ArchitectureDiagram() {
  return (
    <figure>
      <svg viewBox="0 0 880 570" role="img" aria-labelledby="arch-title arch-desc" className="h-auto w-full">
        <title id="arch-title">PolicyMeter architecture</title>
        <desc id="arch-desc">
          The browser calls Next.js API routes. The routes use four modules: guardrails, rag, metering and the llm provider adapter.
          Guardrails, rag and metering read and write Supabase Postgres with pgvector. The llm adapter calls the model providers.
          Local scripts load documents and run evals against the same database.
        </desc>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="fill-neutral-500" />
          </marker>
        </defs>

        <Box tone="ui" x={40} y={16} w={800} h={74} title="Browser (Next.js pages)"
          lines={["/chat · /dashboard · /evals · /architecture", "plus the Ask-about-this-demo widget on every page"]} />
        <Arrow x={440} y1={90} y2={118} />

        <Box tone="api" x={40} y={118} w={800} h={92} title="Next.js API routes (Node runtime on Vercel)"
          lines={["POST /api/chat (streams) · POST /api/ask-demo · POST /api/feedback", "GET /api/metrics · GET /api/calls (+CSV) · GET /api/trace/:id", "POST /api/evals/run (admin token)"]} />
        {[132, 337, 537, 742].map((x) => <Arrow key={x} x={x} y1={210} y2={246} />)}

        <Box x={40} y={246} w={185} h={92} title="lib/guardrails" lines={["input check", "rate limit, daily caps", "PII redaction"]} />
        <Box x={245} y={246} w={185} h={92} title="lib/rag" lines={["rewrite, embed", "hybrid search, prompt", "cite, refuse"]} />
        <Box x={445} y={246} w={185} h={92} title="lib/metering" lines={["cost from real usage", "llm_calls log", "budgets and alerts"]} />
        <Box x={650} y={246} w={190} h={92} title="lib/llm (adapter)" lines={["chat, chatStream, embed", "Claude / OpenAI / Azure", "every call metered"]} />
        {[132, 337, 537].map((x) => <Arrow key={x} x={x} y1={338} y2={384} />)}
        <Arrow x={745} y1={338} y2={384} />

        <Box tone="data" x={40} y={384} w={590} h={86} title="Supabase Postgres + pgvector"
          lines={["documents, chunks (embeddings), llm_calls, alerts", "rate_limits, eval_runs, eval_results"]} />
        <Box tone="data" x={650} y={384} w={190} h={86} title="Model providers" lines={["Chat: Claude (Anthropic)", "Embeddings: OpenAI", "Azure OpenAI path built"]} />

        <Arrow x={335} y1={520} y2={472} />
        <Box tone="ui" x={40} y={520} w={590} h={42} title="scripts (tsx, run locally)" lines={[]} />
        <text x={335} y={554} textAnchor="middle" className="fill-neutral-600 text-[11.5px]">ingest, ingest:about, seed, check:metering, eval</text>
      </svg>
      <figcaption className="mt-2 text-sm text-neutral-600">
        A question passes the guardrails first, then retrieval, then one model call. Every call, including embeddings, is logged with tokens, cost, agency and use case.
      </figcaption>
    </figure>
  );
}
