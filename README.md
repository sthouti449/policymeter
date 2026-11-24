# PolicyMeter — Build Kit

**PolicyMeter** is a cited RAG assistant over public Virginia AI policy documents. It meters every LLM call (tokens, cost, agency tag, use case) and shows spend on a live dashboard with budgets and alerts. A second assistant, "Ask about this demo", answers reviewers' questions about the build and about Suresh's fit for the role.

> Independent portfolio demo. It is not affiliated with or endorsed by VITA or the Commonwealth of Virginia. It uses only public documents.

## What's in this kit

| File | What it's for | When you use it |
|---|---|---|
| `CLAUDE.md` | Standing project rules Claude Code reads every session | Copy to repo root before the first prompt |
| `prompts/BUILD_PROMPT.md` | The master prompt plus 8 staged prompts | Paste one stage at a time into Claude Code |
| `docs/PRD.md` | Problem, users, scope, success criteria | Claude Code reads it; you use it in interviews |
| `docs/ARCHITECTURE.md` | Components, data flow, provider adapter, cost math | Claude Code reads it |
| `docs/DATA_SOURCES.md` | The 9 public documents to download, with status | Before Stage 2 (ingestion) |
| `docs/DEPLOY.md` | Azure, Supabase, Vercel setup step by step | Before Stage 0 and at Stage 7 |
| `docs/DEMO_SCRIPT.md` | 5-minute walkthrough for the panel | After deploy |
| `docs/POC_SCORECARD.md` | Demo 5: time-boxed POC scorecard (filled after evals) | Stage 6, then interview |
| `supabase/schema.sql` | Tables, pgvector index, RPC functions | Run once in Supabase SQL editor |
| `config/pricing.json` | Per-model token prices (you fill these in) | Before Stage 3 |
| `config/agencies.json` | Simulated agency tags and monthly budgets | Stage 3 |
| `evals/golden-set.json` | 16 test questions with expected sources | Stage 6 |
| `content/about-kb/*.md` | Knowledge base for "Ask about this demo" | Stage 5 |
| `.env.example` | Every environment variable | Copy to `.env.local` |

## Order of work (about 3–4 focused days)

1. **Day 0 (1 hr):** Follow `docs/DEPLOY.md` sections 1–3 (Azure OpenAI, Supabase, GitHub repo). Download the PDFs in `docs/DATA_SOURCES.md` into `data/sources/`.
2. **Copy this kit into an empty folder**, run `claude` in it, and paste the **Master prompt** from `prompts/BUILD_PROMPT.md`.
3. **Run Stages 0 → 7 in order.** After each stage, run the stage's "Done when" checks before moving on. Commit after every stage.
4. **Fill `config/pricing.json`** from the Azure pricing page before Stage 3. The dashboard shows a warning banner while any price is 0.
5. **Deploy** (Stage 7), run the seed script, run evals, and fill in `docs/POC_SCORECARD.md` with your real numbers.
6. **Rehearse** with `docs/DEMO_SCRIPT.md`.

## Before you start: check these yourself

- **Model prices change.** `config/pricing.json` ships with zeros on purpose. Copy current prices from the Azure OpenAI pricing page (and OpenAI or Anthropic pricing if you use the fallbacks).
- **Azure model names change.** Use whatever chat and embedding deployments your Azure resource offers. Set the deployment names in `.env.local`. The code never hard-codes a model name.
- **Your background facts** in `content/about-kb/suresh.md` are what the reviewer bot will say about you. Read every line and edit anything you would not say in an interview.
