# PRD — PolicyMeter

**Owner:** Suresh Thouti · **Type:** Time-boxed POC (portfolio demo) · **Time box:** 4 days build, 1 day evaluation

## 1. Problem
State agencies want to use generative AI to answer staff questions about policy, but two questions block adoption:
1. **Can we trust the answers?** Staff need answers that cite the governing document and admit when the documents are silent.
2. **What will it cost, and who pays?** Central IT needs to see token spend per agency and per use case, forecast it, and stop overruns before the invoice arrives.

Most chatbot pilots answer the first question and ignore the second. PolicyMeter answers both in one working system.

## 2. Users
| User | Need | What they use |
|---|---|---|
| Agency staff member | A fast, cited answer to "what does policy say about X?" | Policy Assistant |
| Central AI / platform team | Spend by agency and use case, budgets, alerts, cost per answer | Cost Dashboard |
| AI governance reviewer | Evidence of answer quality and safe behavior | Evals page, POC scorecard |
| Hiring panel | Understand the build and the builder quickly | "Ask about this demo" widget, Architecture page |

## 3. Scope

### In scope (must have)
- **Ingestion:** 9 public documents from `docs/DATA_SOURCES.md`, chunked with page numbers and `doc_status` metadata, embedded and stored in pgvector. Ingestion cost is metered.
- **Policy Assistant (`/chat`):**
  - Agency selector (simulated tag) and use-case tag on every request
  - Streaming answer with numbered citations; clicking a citation shows the chunk text, document title, page and a link to the source
  - Refuses below the similarity threshold: "I can't find that in the loaded documents."
  - Flags rescinded sources and names the replacement
  - Shows the AI disclaimer and a **cost chip** on each answer (tokens in/out, cost, latency, model)
  - Thumbs up/down feedback stored with the call
- **Cost Dashboard (`/dashboard`):**
  - KPI tiles: total spend, calls, cost per answered question, average latency, tokens
  - Spend by agency (bar), by use case (bar), by model (donut is acceptable only if 4 or fewer slices; otherwise bar), daily trend (line)
  - Budget vs. actual per agency with status: OK, Warning (≥ 80%), Breached (≥ 100%)
  - Alerts list (budget crossings, daily cap hits) with optional webhook post
  - Month-end forecast per agency (run-rate)
  - **Model what-if:** "If this traffic ran on model X, cost would be $Y" using logged tokens and `pricing.json`
  - Recent calls table with request trace (retrieved chunks, scores, tokens, latency)
  - Filters: date range, agency, use case, model, include simulated
  - CSV export of filtered calls (chargeback-ready)
- **Evals (`/evals`):** run the golden set; show retrieval hit rate, citation rate, groundedness (LLM judge, 1–5), correct-refusal rate, total eval cost; keep run history.
- **"Ask about this demo" widget:** on every page; RAG over `content/about-kb/`; metered under agency `DEMO` and use case `reviewer-assistant`; refuses off-topic questions.
- **Architecture page (`/architecture`):** diagram, provider adapter explanation, cost formula, POC scorecard.
- **Guardrails:** daily spend cap, per-IP rate limit, PII redaction in logs, prompt-injection-safe system prompts.

### Out of scope
- User accounts and SSO (noted as the production path: Entra ID)
- Real agency data or any non-public document
- Fine-tuning; multi-tenant document isolation (noted as the production path)

## 4. Success criteria (the POC "adopt" bar)
| Metric | Target |
|---|---|
| Retrieval hit rate (expected doc in top 6) | ≥ 85% |
| Answers with at least one valid citation (in-scope questions) | ≥ 95% |
| Groundedness (judge, 1–5) | average ≥ 4.2 |
| Correct refusals on out-of-scope questions | 100% |
| p50 answer latency | ≤ 4 s to first token |
| Cost per answered question | Shown to 4 decimals; target under $0.01 on the fast deployment |
| Unmetered calls | 0 (checked by comparing provider usage to `llm_calls`) |

## 5. Forward-deployed engineering practices this POC demonstrates
- **Discovery first:** the problem statement and users above come before code.
- **Customer-environment fit:** Azure OpenAI first (the customer's stack), with a provider adapter so the demo runs anywhere.
- **Evals before claims:** a golden set and scorecard, not screenshots.
- **Observability:** every call traced and costed; a request ID joins the UI, the logs and the trace view.
- **Guardrails:** spend cap, rate limit, redaction, refusal, superseded-document handling, AI disclaimer.
- **Handoff:** README, runbook (`docs/DEPLOY.md`), and a scorecard with an adopt / extend / stop call.

## 6. Risks
| Risk | Mitigation |
|---|---|
| Azure OpenAI access delayed | Adapter falls back to OpenAI or Anthropic; the cost model is the same |
| Public demo runs up a bill | Daily cap, per-IP limit, short `max_tokens`, fast deployment |
| Out-of-date policy answers | `doc_status` metadata, a "last ingested" date in the UI, and rescinded flags |
| Prices change | Prices live in one config file; the dashboard warns on any zero price |
