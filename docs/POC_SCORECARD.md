# POC Scorecard — PolicyMeter (Policy Assistant + Token Cost Meter)

| Field | Entry |
|---|---|
| **Objective** | Show that a RAG assistant, built Azure-first behind a provider adapter (this POC runs Claude for chat and OpenAI for embeddings), can answer agency staff questions about Virginia AI policy with cited, grounded answers, while metering cost per agency and use case well enough to support chargeback and budget control. |
| **Time box** | 4 days build + 1 day evaluation (started: ____ , ended: ____ ) |
| **Scope** | 10 public policy documents loaded (the 2026 task-force report could not be found); 6 simulated agency tags plus one for the reviewer assistant; single-turn questions evaluated (the follow-up rewrite step is built but not covered by the golden set); no user accounts |
| **Owner** | Suresh Thouti |

## Success criteria (set before build)
Measured on 24 Nov 2026 with the 16-question golden set (12 in scope, 4 out of scope). This is the fifth run; the system was tuned between runs, and these are the final numbers.

| # | Criterion | Target | Result | Pass? |
|---|---|---|---|---|
| 1 | Retrieval hit rate (expected document in top 6) | ≥ 85% | 92% (11 of 12) | ☑ |
| 2 | In-scope answers with ≥ 1 valid citation | ≥ 95% | 100% (12 of 12) | ☑ |
| 3 | Groundedness (LLM judge, 1–5) | ≥ 4.2 avg | 4.83 | ☑ |
| 4 | Correct refusals (out-of-scope + injection) | 100% | 100% (4 of 4) | ☑ |
| 5 | p50 time to first token | ≤ 4 s | 1.0 s | ☑ |
| 6 | Cost per answered question (fast deployment) | < $0.01 | $0.0004 | ☑ |
| 7 | Unmetered calls (provider usage vs. `llm_calls`) | 0 | None found internally: 273 logged calls, none estimated, none unpriced, none failed. Not yet compared with the providers' own usage pages. | ☐ pending that comparison |

## Cost estimate vs. actual
No estimates were written down before the build, so the Estimate column is blank except for the projection.

| Item | Estimate | Actual |
|---|---|---|
| Ingestion (embeddings, all runs including two full re-embeds) | — | $0.0021 |
| Build and test traffic (assistant and reviewer questions, excluding evals) | — | about $0.001 |
| One eval run (16 questions incl. judge) | — | about $0.11 (five runs cost $0.54 in total) |
| Projected monthly cost at 1,000 questions/agency × 6 agencies | about $2.40 (6,000 answers at $0.0004; excludes evals) | — |
| Supabase / Vercel | Free tier | Free tier (Supabase free, Vercel Hobby) |

## What we learned
- **Retrieval:** 11 of 12 in-scope questions found the right document in the top 6. The gains came from two fixes: embedding each chunk together with its document title (questions say "the AI Utilization Policy", but chunks rarely name their own document), and fixing keyword search, which had required every word of a long question to match. The remaining miss is the NIST question: EA-225 does cite NIST AI 100-1, but that chunk ranks below the top 6. The assistant said it could not confirm the framework rather than guessing. A reranking step is the next lever.
- **Generation:** Groundedness rose from 3.55 to 4.83. Telling the model to state only what the context says removed invented extras (for example "both documents are current"). The judge also had to see each source's header (title, status, what replaced it), or it marked correct statements about rescinded documents as fabricated.
- **Cost drivers (rewrite vs. embed vs. answer share):** Across all evals the Sonnet judge was 94% of spend, Haiku answers 6% and embeddings under 1%. Answering a question costs about $0.0004 including its embedding; judging one answer costs about $0.009, roughly 20 times as much, so measuring quality cost far more than serving it. The rewrite step was not measured because follow-up questions are not in the golden set.
- **Surprises:** (1) The first real eval exposed a blank-answer bug: Claude Haiku spent its whole 700-token budget on hidden reasoning and returned nothing, which was logged as a success. Thinking is now off for the fast tier and an empty reply is treated as an error. (2) EO 30 is a scanned image with a text layer on only one of its four pages, and the demo has no OCR, so most of its own wording is not searchable; its rescinded status and the EO 22 text that rescinds it still work. (3) The VITA FAQ page hides every answer in collapsed panels, so a plain print kept 944 of about 5,900 tokens. (4) Two of four official download links had moved, and copies came from Internet Archive snapshots. (5) The refusal cutoff (0.42) rests on a gap of only 0.08 between out-of-scope (highest 0.39) and in-scope (lowest 0.47) questions on 16 questions, so it should be re-measured as documents are added.

## Decision
☐ **Adopt** — criteria met; move to a pilot with one agency (Entra ID, agency tenant, API Management quotas)
☐ **Extend** — specific criteria missed; extend by ____ days to fix: ____
☐ **Stop** — value doesn't justify cost or risk because: ____

**Recommendation and reasoning (3 sentences):** _To be completed by the owner._

## Next steps if adopted
1. Register the use case in the Commonwealth's AI registry and complete an Algorithmic Impact Assessment.
2. Pilot with one agency's real policy library in its own tenant; add human review for public-facing use.
3. Put Azure API Management in front of models for central token quotas and chargeback.
4. Add a document-refresh pipeline and owner notifications.
