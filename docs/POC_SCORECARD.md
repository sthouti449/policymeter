# POC Scorecard — PolicyMeter (Policy Assistant + Token Cost Meter)

| Field | Entry |
|---|---|
| **Objective** | Show that an Azure OpenAI RAG assistant can answer agency staff questions about Virginia AI policy with cited, grounded answers, while metering cost per agency and use case well enough to support chargeback and budget control. |
| **Time box** | 4 days build + 1 day evaluation (started: ____ , ended: ____ ) |
| **Scope** | 9 public policy documents; 6 simulated agency tags; single-turn and follow-up questions; no user accounts |
| **Owner** | Suresh Thouti |

## Success criteria (set before build)
| # | Criterion | Target | Result | Pass? |
|---|---|---|---|---|
| 1 | Retrieval hit rate (expected document in top 6) | ≥ 85% | ____ | ☐ |
| 2 | In-scope answers with ≥ 1 valid citation | ≥ 95% | ____ | ☐ |
| 3 | Groundedness (LLM judge, 1–5) | ≥ 4.2 avg | ____ | ☐ |
| 4 | Correct refusals (out-of-scope + injection) | 100% | ____ | ☐ |
| 5 | p50 time to first token | ≤ 4 s | ____ | ☐ |
| 6 | Cost per answered question (fast deployment) | < $0.01 | $____ | ☐ |
| 7 | Unmetered calls (provider usage vs. `llm_calls`) | 0 | ____ | ☐ |

## Cost estimate vs. actual
| Item | Estimate | Actual |
|---|---|---|
| Ingestion (one-time embeddings) | $____ | $____ |
| Build and test traffic | $____ | $____ |
| One eval run (16 questions incl. judge) | $____ | $____ |
| Projected monthly cost at 1,000 questions/agency × 6 agencies | $____ | — |
| Supabase / Vercel | Free tier | Free tier |

## What we learned
- Retrieval: ____
- Generation: ____
- Cost drivers (rewrite vs. embed vs. answer share): ____
- Surprises: ____

## Decision
☐ **Adopt** — criteria met; move to a pilot with one agency (Entra ID, agency tenant, API Management quotas)
☐ **Extend** — specific criteria missed; extend by ____ days to fix: ____
☐ **Stop** — value doesn't justify cost or risk because: ____

**Recommendation and reasoning (3 sentences):** ____

## Next steps if adopted
1. Register the use case in the Commonwealth's AI registry and complete an Algorithmic Impact Assessment.
2. Pilot with one agency's real policy library in its own tenant; add human review for public-facing use.
3. Put Azure API Management in front of models for central token quotas and chargeback.
4. Add a document-refresh pipeline and owner notifications.
