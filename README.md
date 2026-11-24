# PolicyMeter

A cited RAG assistant over public Virginia AI policy documents, with every model call metered by agency and use case.

> Independent portfolio demo by Suresh Thouti. Not affiliated with or endorsed by VITA or the Commonwealth of Virginia. It uses only public documents.

| | |
|---|---|
| **Policy Assistant** (`/chat`) | Answers staff questions with numbered citations, refuses when the documents are silent, and warns when it cites a rescinded document (for example EO 30, replaced by EO 22). |
| **Cost Dashboard** (`/dashboard`) | Spend by agency, use case and model; budgets with 80% and 100% alerts; a month-end forecast; a model what-if; a chargeback CSV; a per-question trace. |
| **Evals** (`/evals`) | A 16-question golden set scored for retrieval, citations, groundedness (LLM judge), correct refusals, latency and cost against targets set before building. |
| **Ask about this demo** | A floating assistant on every page that answers questions about the build and the builder, from `content/about-kb/` only. |

<!-- Screenshots: add docs/img/chat.png, dashboard.png, evals.png and link them here. -->

## What it runs on

Built **Azure-first** behind one provider adapter, but **this deployment runs Claude for chat and OpenAI for embeddings** (Anthropic has no embeddings API). The Azure OpenAI path is implemented and unit-tested with recorded payloads, but it has not been run against a live Azure resource.

- Chat: Claude Haiku 5.5 (assistant, rewrite, reviewer bot) and Claude Sonnet 5.5 (eval judge only).
- Embeddings: OpenAI `text-embedding-3-small`.
- Next.js 15 (App Router), TypeScript strict, Tailwind, Recharts, Supabase Postgres + pgvector, Vercel.

## How it works

```
Browser -> Next.js API routes -> guardrails -> rag -> llm adapter -> model providers
                                      |           |        |
                                      +-----------+--------+--> metering -> Supabase (pgvector + llm_calls)
```

A question passes the guardrails first (input check, per-IP rate limit, daily spend cap), then an obvious-injection check. Follow-ups are rewritten into standalone questions. The question is embedded and matched against chunks with vector and keyword search merged by reciprocal rank fusion. If no chunk clears the similarity threshold the assistant refuses without calling the chat model. Otherwise the top chunks go into a prompt that requires a citation for every claim, and invalid citations are stripped from the answer. See the `/architecture` page and `docs/ARCHITECTURE.md`.

## Run it locally

```bash
npm install
cp .env.example .env.local     # fill in the keys (see below)
```

1. **Database.** In a Supabase project, run `supabase/schema.sql` in the SQL editor. It already includes every change, so on a fresh project you do not need the files in `supabase/migrations/`. (Those exist to upgrade a database made from an earlier version of the schema: run `001` to `004` in order.)
2. **Keys** in `.env.local`: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and real random values for `IP_HASH_SALT` and `ADMIN_TOKEN`.
3. **Prices.** Check every row in `config/pricing.json` against the providers' pricing pages. A missing price throws, and the dashboard warns while any price in use is 0.
4. **Documents.** Download the PDFs listed in `docs/DATA_SOURCES.md` into `data/sources/` using the exact file names. Check document 3's status against EA400's revision history first.

```bash
npm run ingest         # policy PDFs -> chunks -> embeddings (skips unchanged files)
npm run ingest:about   # content/about-kb/*.md for the reviewer assistant
npm run dev            # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run try-retrieve -- "question"` | Shows the top chunks and similarity scores for a question. |
| `npm run eval` | Runs the golden set through the real pipeline and prints the scorecard. Spends real money (cents). |
| `npm run seed` / `-- --clear` | Inserts / removes labelled simulated traffic for the dashboard. |
| `npm run check:metering` | Totals per provider and model to compare with the providers' usage pages. |
| `npm run build && npm run check:bundle` | Scans the browser bundle for API keys and your real secret values. |
| `npm run lint`, `typecheck`, `test` | The checks to run before any change. |

## Deploy

See `docs/DEPLOY.md` section 4. In short: push to GitHub, import the repo in Vercel, add every variable from `.env.example` for Production (never with a `NEXT_PUBLIC_` prefix, except the four site and link variables), deploy, then:

```bash
npx tsx scripts/smoke.ts https://YOUR-APP.vercel.app
```

The smoke test asks one policy question, one out-of-scope question and one reviewer question, reads `/api/metrics`, and checks the security headers and that cross-site and unauthenticated requests are refused.

## How cost is calculated

From the token counts the provider actually returns, priced from `config/pricing.json` (USD per million tokens):

```
cost = (input - cached - cache_write) * price.input
     + cached * price.cached_input
     + cache_write * price.cache_write
     + output * price.output
```

Embeddings are priced on input tokens. All calls for one question share a request id, so **cost per answered question** includes the rewrite, the embedding and the answer. The forecast is month-to-date spend divided by days elapsed, times days in the month. The what-if re-prices the logged tokens on another model (an estimate: model families count tokens differently).

## Guardrails

- A global daily spend cap and a separate, smaller cap for the reviewer assistant, both counting real calls only (simulated, eval and ingestion calls are excluded); a per-IP rate limit; failing closed if the database is unreachable.
- Obvious prompt-injection attempts are refused before any model call; retrieved text and questions are treated as data in every prompt.
- Emails, phone numbers and SSN-like numbers are redacted from stored questions, which are capped at 500 characters. Question text is never shown on the dashboard or exported.
- Every answer shows the AI-assistance disclaimer. Rescinded sources are flagged with what replaced them.
- Same-origin check on every state-changing route; the admin token (constant-time compare) for evals; security headers and a strict CSP in production; errors never include stack traces.
- Secrets stay server-side: the service-role key and model keys are only imported by `server-only` modules.

## Eval results

Run `npm run eval` and record the numbers in `docs/POC_SCORECARD.md` (also shown on `/architecture`). Targets: hit rate at least 85%, citations at least 95%, groundedness at least 4.2 of 5, 100% correct refusals, p50 time to first token at most 4 s, under $0.01 per answered question, and zero unmetered calls.

Latest run (24 Nov 2026, 16 questions: 12 in scope, 4 out of scope):

| Target | Result |
|---|---|
| Retrieval hit rate ≥ 85% | 92% (11 of 12) |
| Valid citations ≥ 95% | 100% (12 of 12) |
| Groundedness ≥ 4.2 of 5 | 4.83 |
| Correct refusals 100% | 100% (4 of 4) |
| p50 time to first token ≤ 4 s | 1.0 s |
| Cost per answered question < $0.01 | $0.0004 |
| Unmetered calls = 0 | none found internally; not yet compared with provider usage pages |

The one question that still misses retrieval asks which risk framework the AI technology standard uses (EA-225 cites NIST AI 100-1, but that chunk ranks below the top 6). The run is the fifth, with the system tuned in between, so treat the numbers as a tuned result on a small set rather than an independent test. The full write-up is in `docs/POC_SCORECARD.md`.

## Limitations

- Refusals depend on a similarity cutoff (`RAG_MIN_SIMILARITY`, now 0.42, chosen with `npm run calibrate`). On the 16-question golden set out-of-scope questions peaked at 0.39 and in-scope ones started at 0.47, a narrow gap from a small sample. Re-run `npm run calibrate` after adding documents.
- PDFs with no text layer are not read (no OCR).
- No user accounts, and all documents are public: there is no per-agency document isolation.
- Agency tags are simulated labels for cost allocation. Seeded traffic is clearly labelled and can be removed.
- Free-tier Supabase projects pause when idle; open the project before a demo.
- The Azure OpenAI path has not been exercised against a live resource.

## Production path

Entra ID single sign-on with per-agency roles; Azure AI Search or Postgres in each agency's tenant; Azure API Management in front of the models for central token quotas and chargeback; Azure Monitor for traces; a document refresh pipeline with change detection; registration of each use case in the Commonwealth's AI registry; and human review for any answer that reaches the public.

## Repository guide

`app/` pages and API routes · `components/` UI · `lib/llm` the only code that imports a model SDK · `lib/rag` retrieval and prompts · `lib/metering` cost, logging, budgets, alerts · `lib/guardrails` limits and redaction · `lib/evals` golden-set runner and judge · `scripts/` CLI tools · `config/` prices, agencies, document manifest · `content/about-kb/` the reviewer assistant's notes · `docs/` PRD, architecture, data sources, deploy runbook, scorecard, and the original build kit README (`BUILD_KIT.md`).
