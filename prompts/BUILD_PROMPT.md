# PolicyMeter — Claude Code build prompts

How to use: start Claude Code in the project folder (with this kit copied in), paste the **Master prompt** once, then paste **one stage at a time**. Don't move on until the stage's "Done when" checks pass. Commit after every stage (`git commit -m "stage N: …"`).

Tip: if Claude Code drifts, paste: *"Re-read CLAUDE.md and docs/ARCHITECTURE.md. Which hard rule did the last change break?"*

---

## Master prompt (paste first)

```
You are my forward-deployed engineer on a 4-day POC called PolicyMeter.

Context: I'm preparing for an AI role at the Virginia IT Agency (VITA). The job asks for production
chatbots and RAG on Azure OpenAI, token economics with tagging and cost allocation, agentic vs.
automation judgment, human oversight, and time-boxed POCs. PolicyMeter proves those in one app:
1) a cited RAG assistant over public Virginia AI policy documents,
2) a cost dashboard that meters every LLM call by agency and use case with budgets and alerts,
3) an "Ask about this demo" widget so the hiring panel can question the build.

Read these files fully before doing anything: CLAUDE.md, docs/PRD.md, docs/ARCHITECTURE.md,
docs/DATA_SOURCES.md, supabase/schema.sql, config/*.json, .env.example, evals/golden-set.json,
content/about-kb/*.md.

Then reply with:
- a one-paragraph summary of what you'll build, in your own words
- any contradictions or gaps you found across those files
- your questions (at most 5)
Do not write code yet. We'll go stage by stage from prompts/BUILD_PROMPT.md.
```

---

## Stage 0 — Scaffold, config and provider adapter

```
Stage 0. Scaffold the app and build the provider adapter.

1. Create a Next.js 15 App Router project in this folder (TypeScript strict, Tailwind, ESLint, src/ not used).
   Add shadcn/ui, Recharts, zod, openai, @anthropic-ai/sdk, @supabase/supabase-js, pdf-parse, server-only,
   and dev deps tsx, vitest. Add scripts: dev, build, start, lint, typecheck, test, ingest, ingest:about,
   seed, check:metering, eval.
2. lib/env.ts: parse process.env with zod. Fail fast with a readable message listing missing vars.
   Work out the active provider per ARCHITECTURE §2. Refuse to start if no embedding provider exists.
3. lib/config.ts: load and validate config/pricing.json and config/agencies.json with zod.
   Export getPrice(pricingKey) and a function listing zero-priced keys.
4. lib/llm/: types.ts, azure.ts, openai.ts, anthropic.ts, index.ts exposing chat(), chatStream(), embed()
   exactly as in ARCHITECTURE §2. Tier "fast" | "smart" maps to env deployment/model names.
   Return normalized usage { inputTokens, cachedInputTokens, outputTokens, estimated }.
   For streams, capture usage from the final event per provider. Do NOT add metering yet; leave a
   clearly marked hook (onComplete callback) that Stage 1 will wire to logCall.
5. Vitest: provider selection (auto/forced/missing keys), usage normalization for each provider
   using recorded fixture payloads (no network).
6. A temporary page /dev/ping (server action) that sends "Reply with OK" on the fast tier and shows
   provider, model, usage and latency. Remove it in Stage 7.

Done when: npm run lint, typecheck and test pass; /dev/ping returns OK with real usage numbers
from my configured provider. Show me the output.
```

## Stage 1 — Database, metering and guardrails

```
Stage 1. Wire Supabase, metering and guardrails.

1. I have run supabase/schema.sql. Create lib/db/supabase.ts (server-only, service-role client).
2. lib/metering/cost.ts: computeCost(usage, pricingKey) per ARCHITECTURE §4. Unit-test it with
   cached tokens, zero cached, embeddings, and an unknown key (throws).
3. lib/metering/logCall.ts: insert one llm_calls row. Called from the adapter's onComplete for every
   chat, chatStream and embed call, including errors (status 'error', error_code). Fire-and-forget is
   NOT ok: await it, but never let a logging failure break the user's answer (catch, console.error).
4. lib/metering/budget.ts: after each call, compute month-to-date spend for the agency; insert alerts at
   80% and 100% (unique constraint makes it fire once); POST to ALERT_WEBHOOK_URL if set (5 s timeout,
   record webhook_ok). Unit-test the threshold logic.
5. lib/guardrails/: 
   - redact.ts: emails, US phone numbers, SSN-like patterns → [REDACTED]; truncate to 500 chars. Tests.
   - rateLimit.ts: SHA-256(ip + IP_HASH_SALT) → hit_rate_limit RPC.
   - dailyCap.ts: today's total cost >= DAILY_SPEND_CAP_USD → blocked; insert a GLOBAL daily_cap alert.
   - input.ts: zod schema for questions (1..MAX_QUESTION_CHARS), agency must exist in agencies.json,
     use_case must exist.
   - guard(req) helper that runs all of the above and returns a typed result.
6. Update /dev/ping to accept agency + use_case and confirm a row appears in llm_calls with the right cost.

Done when: tests pass; pinging three times writes three llm_calls rows with non-zero cost (after I fill
pricing.json); setting DAILY_SPEND_CAP_USD=0.000001 makes the next ping return 429 and creates an alert.
```

## Stage 2 — Ingestion

```
Stage 2. Build ingestion for the policy corpus.

1. scripts/ingest.ts reads config/sources.manifest.json and data/sources/. Skip documents marked optional
   if the file is missing; fail loudly if a non-optional file is missing.
2. For each PDF: extract text per page with pdf-parse (use the pagerender option to keep page numbers).
   Warn if a page has < 200 characters. Normalize whitespace, drop repeated headers/footers that appear
   on more than 50% of pages.
3. Chunk: ~700 tokens with 100-token overlap, split on headings/paragraphs first, never across pages
   (record page). Use a simple token estimate (chars/4) for chunk sizing only. Unit-test the chunker.
4. Compute a SHA-256 of the file. If documents.file_hash is unchanged, skip. Otherwise upsert the
   documents row (status, replaced_by, url, published, issuer, corpus 'policy') and replace its chunks.
5. Embed in batches of 64 via embed() with meta { agency: 'VITA', useCase: 'ingestion' }, so ingestion
   cost lands in llm_calls. Store embedding_model on each chunk.
6. Print a summary table: document, pages, chunks, tokens, embedding cost.
7. lib/rag/retrieve.ts: retrieve(question, corpus) → embed, match_chunks, and if RAG_HYBRID, keyword_chunks
   merged by reciprocal rank fusion (k=60). Return chunks with doc metadata and similarity.
   Refuse to run if the configured embedding model differs from chunks.embedding_model.
8. scripts/try-retrieve.ts "question" prints the top 6 chunks with title, page, status and similarity.

Done when: npm run ingest loads every non-optional document; a second run skips all of them;
try-retrieve "What disclaimer must AI outputs include?" returns a chunk from the policy standard or EA400
in the top 3; try-retrieve "Is Executive Order 30 still in effect?" returns chunks from EO 22 and EO 30.
```

## Stage 3 — Policy Assistant (API + /chat)

```
Stage 3. Build the Policy Assistant.

1. POST /api/chat (Node runtime). Body: { messages, agency, useCase }. Steps per ARCHITECTURE §3:
   guard → optional rewrite (fast tier, useCase 'query-rewrite', only when there is prior history) →
   retrieve → refuse if nothing clears RAG_MIN_SIMILARITY (log a 'refused' row with embed cost only) →
   build prompt with numbered context including status and replaced_by → chatStream (fast tier,
   max 700 tokens) → stream SSE events: {type:'delta'}, then {type:'final', requestId, sources,
   citationsUsed, rescindedCited, cost:{inputTokens, outputTokens, costUsd, latencyMs, model, provider}}.
   All calls for one question share one requestId.
2. lib/rag/cite.ts: parse [n] markers, drop invalid ones, map to sources. Unit tests.
3. /chat page:
   - Header controls: agency select and use-case select (from agencies.json; exclude internal use cases).
   - Message list with streaming. Each assistant message shows: the answer with clickable [n] chips,
     source cards (title, page, status badge: current/rescinded/historical, link), a red notice when a
     rescinded source is cited, the AI disclaimer line, a cost chip
     ("1,240 in · 210 out · $0.0004 · 1.8 s · gpt-5.4-mini via Azure"), and thumbs up/down.
   - Clicking a citation opens a side panel with the chunk text.
   - Starter questions: "What disclaimer must AI-generated outputs include?",
     "Do agencies have to register AI systems?", "Is Executive Order 30 still in effect?",
     "What does an Algorithmic Impact Assessment ask about?", "Which AI tools may agencies use?"
   - "Documents last ingested: {date}" under the input.
4. POST /api/feedback { requestId, value } updates llm_calls.feedback for that request's chat row.
5. Friendly errors: 429 (rate limit / daily cap) shows "The demo has hit its spending limit for today.
   That limit is one of the guardrails being demonstrated." 

Done when: the five starter questions answer with valid citations; "What's the weather in Richmond?"
returns the refusal with no chat call logged; the EO 30 question flags the rescinded source and names
EO 22; cost chips match the llm_calls rows for that requestId.
```

## Stage 4 — Cost Dashboard

```
Stage 4. Build the cost dashboard. Before writing chart code, read the dataviz skill if available.

1. GET /api/metrics?from&to&agency&useCase&model&includeSimulated → one JSON payload with:
   kpis {spendUsd, calls, answeredQuestions, costPerAnsweredQuestion, avgAnswerLatencyMs, inputTokens,
   outputTokens}, byAgency, byUseCase, byModel, daily, budgets [{agency, budget, mtdSpend, pct, status,
   forecastMonthEnd}], alerts (latest 20), zeroPricedModels.
   Use SQL aggregation (views v_daily_spend, v_request_cost), not JS loops over every row.
2. GET /api/calls (paged, same filters) and GET /api/calls?format=csv (chargeback export with agency,
   use_case, model, tokens, cost, date).
3. GET /api/trace/[requestId] → all calls for the request plus retrieved chunks (title, page, similarity).
4. /dashboard page:
   - Filter bar (date range presets 7d/30d/MTD, agency, use case, model, "Include simulated traffic").
     Show a "Includes simulated traffic" badge when on and simulated rows exist.
   - KPI row (5 tiles). Cost values to 4 decimals under $1, 2 decimals above.
   - Charts: spend by agency (horizontal bar), spend by use case (bar), spend by model (bar),
     daily spend (line, stacked by agency is acceptable if ≤ 7 agencies).
   - Budget table: agency, budget, MTD spend, % used with a bar, status pill (OK / Warning / Breached),
     month-end forecast.
   - Alerts panel.
   - Model what-if card: pick a model from pricing.json; show "This period's traffic would cost $X on
     {model} (vs $Y actual, Z% difference)" computed from logged tokens.
   - Recent calls table with a "Trace" drawer.
   - Yellow banner if zeroPricedModels is non-empty: "Some model prices are 0 in config/pricing.json;
     costs for those models are understated."
5. Charts must be readable in light and dark mode and have axis labels with units.

Done when: after a few chat questions across 3 agencies, every chart and the budget table update;
CSV export opens in Excel with correct totals; the what-if card changes when I switch models;
lowering an agency budget to $0.0001 and asking one question creates a Breached alert.
```

## Stage 5 — "Ask about this demo" widget, landing and architecture pages

```
Stage 5. Build the reviewer assistant and the explanatory pages.

1. scripts/ingest-about.ts: ingest content/about-kb/*.md into corpus 'about' (split on headings,
   page = null, status current), metered as agency DEMO, use case 'ingestion'.
2. POST /api/ask-demo: same guard + retrieve(corpus 'about') + chat (fast tier, max 300 tokens, not
   streamed is fine), metered as agency DEMO, use case 'reviewer-assistant'. System prompt per
   ARCHITECTURE §6. Below threshold → "I only cover this demo and the builder's background. For policy
   questions, try the Policy Assistant." Return answer + cost chip.
3. <AskAboutDemo/>: floating button bottom-right on every page ("Ask about this demo"), opens a panel with
   suggested-question chips (ARCHITECTURE §6), message list, cost chip per answer, AI disclaimer.
   Keyboard accessible; Esc closes.
4. / (landing): one-line pitch, three cards (Policy Assistant, Cost Dashboard, Evals) with a live
   stat on each (documents loaded, spend this month, latest groundedness score), a "How this maps to
   the role" section rendered from content/about-kb/jd-mapping.md, builder links (LinkedIn, GitHub).
5. /architecture: render the diagram from ARCHITECTURE §1 as a clean SVG/HTML diagram (not ASCII),
   the provider-adapter explanation, the cost formula, the production path list, and
   docs/POC_SCORECARD.md rendered as a page section.
6. Footer on every page: "Independent demo. Not affiliated with or endorsed by VITA or the Commonwealth
   of Virginia. Built by {NEXT_PUBLIC_BUILDER_NAME}."

Done when: each suggested chip gets a sensible, grounded answer; "Write me a poem" gets the
off-topic reply; reviewer calls appear in the dashboard under DEMO / reviewer-assistant.
```

## Stage 6 — Evals, seed traffic, metering check

```
Stage 6. Prove quality and cost accuracy.

1. lib/evals/run.ts + POST /api/evals/run (requires header x-admin-token = ADMIN_TOKEN) + npm run eval:
   For each item in evals/golden-set.json, call the same pipeline as /api/chat with agency VITA,
   use case 'eval-run'. Compute:
   - hit: any expected_doc_id among retrieved doc_ids
   - cited: answer contains ≥1 valid citation (in-scope items)
   - refused: answer is the refusal message; correct if it matches should_refuse
   - groundedness: judge on the SMART tier with a strict rubric (1–5) that sees only the question,
     the retrieved context and the answer, and returns JSON {score, reason} validated by zod.
   - must_mention: case-insensitive check that each phrase (or listed synonym) appears; report misses.
   Write eval_runs + eval_results. All judge calls are metered.
2. /evals page: latest run scorecard vs PRD targets (green/red), trend of past runs, a table of items
   with expandable answer, judge reason and misses, and the run's total cost. A "Run evals" button that
   asks for the admin token (stored only in sessionStorage).
3. scripts/seed-traffic.ts: insert ~600 simulated llm_calls rows over the last 30 days with
   simulated=true, realistic token distributions from my real calls (sample real rows' tokens if any
   exist), agencies weighted (VITA 30%, DMV 20%, VDH 15%, VEC 12%, DSS 13%, VDOT 10%), use cases
   weighted, a weekday pattern, and one agency that trends toward its budget. Costs computed with
   computeCost. Do not insert alerts directly; run checkBudget per agency after seeding.
   Add --clear to delete simulated rows only.
4. scripts/check-metering.ts: for a date range, print calls and tokens per provider/model from llm_calls
   and remind me where to compare against Azure Cost Management / provider usage pages. Flag any
   usage_estimated rows.

Done when: npm run eval completes and prints the scorecard; /evals shows it; seeding populates the
dashboard with the simulated badge; --clear removes only simulated rows.
Then fill docs/POC_SCORECARD.md "Results" with the real numbers from this run and show me the diff.
```

## Stage 7 — Hardening and Vercel deploy

```
Stage 7. Harden and deploy.

1. Remove /dev/ping. Add security headers (CSP allowing self + Supabase is not needed client-side since
   all DB access is server-side), and make sure no secret is reachable from the client bundle
   (grep the .next output for key prefixes).
2. Review every API route: zod validation, guard() first, admin routes check x-admin-token,
   errors don't leak stack traces.
3. Add loading and empty states everywhere; mobile layout for /chat and the widget.
4. Accessibility pass: labels, focus states, contrast, chart titles/aria-labels.
5. Write README.md for the repo: what it is, screenshots placeholders, architecture summary,
   how to run locally, how to ingest, how to deploy, how cost is computed, guardrails, eval results,
   limitations, production path. Keep docs/ in the repo.
6. Deploy per docs/DEPLOY.md §4: vercel link, set env vars for Production, set function maxDuration 60
   for /api/chat and /api/evals/run, deploy, then run a smoke test script (scripts/smoke.ts BASE_URL)
   that asks one policy question, one refusal, one reviewer question, and fetches /api/metrics.

Done when: the production URL passes the smoke test, the dashboard shows the production calls,
and the README is complete. Give me the URL and a checklist of anything I must do by hand.
```

---

## Handy follow-up prompts

- **Cost tuning:** "Show me cost per answered question by component (rewrite, embed, answer). Suggest two changes to cut it 30% without lowering groundedness below 4.2, then implement the one I pick."
- **Debug a bad answer:** "Here is requestId X. Pull its trace, tell me whether the failure is retrieval or generation, and propose a fix with a new golden-set item that catches it."
- **Interview prep:** "Explain this codebase to a VITA hiring panel in 2 minutes, then list 10 questions they might ask about it with crisp answers."
