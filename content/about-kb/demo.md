# About PolicyMeter

## What PolicyMeter is
PolicyMeter is a working proof of concept that combines two things state IT teams need before scaling generative AI: a policy assistant whose answers can be trusted, and a cost meter that shows who is spending what. It answers staff questions about public Virginia AI policy documents with numbered citations, and it logs every model call with its tokens, cost, agency tag and use case. It is an independent portfolio demo built by Suresh Thouti. It is not affiliated with or endorsed by VITA or the Commonwealth of Virginia, and it uses only public documents.

## Which documents the Policy Assistant uses
The assistant is built on public documents: VITA's AI Utilization Policy (EA400, June 2026), the EA-225 AI technology standard, the 2024 Policy Standards for the Utilization of AI, Executive Order 22 (September 2026), Executive Directive 6 (October 2026), the rescinded Executive Order 30, VITA's AI FAQs, the Algorithmic Impact Assessment template, and the EO 30 Task Force report. Each document carries a status of current, rescinded or historical, and the assistant warns the user when it cites a rescinded document.

## How the RAG pipeline works
A question passes guardrails first (input validation, a per-IP rate limit and a daily spending cap). Follow-up questions are rewritten into standalone questions. The question is embedded and matched against document chunks in Postgres with pgvector, blended with keyword search using reciprocal rank fusion. If no chunk is similar enough, the assistant says it can't find the answer and makes no chat call, so a refusal costs only the embedding. Otherwise the top six chunks go into a prompt that requires a citation for every claim. Citations that don't match a retrieved chunk are removed before the answer is shown.

## How hallucinations are controlled
Four controls work together: a similarity threshold that triggers a refusal, a system prompt that allows only cited claims from the context, post-processing that strips invalid citations, and an evaluation suite. The suite measures retrieval hit rate, citation rate, groundedness scored by a stronger model acting as judge, and correct refusals on out-of-scope and prompt-injection questions. Retrieved text is treated as data, never as instructions.

## How cost is calculated
Each call's cost is computed from the token usage the provider actually returns, priced from a single configuration file: uncached input tokens times the input price, plus cached input tokens times the cached price, plus output tokens times the output price, all per million tokens. Embedding calls are priced on input tokens. All calls for one question share a request ID, so the dashboard reports the true cost per answered question, including the rewrite, embedding and answer steps. Ingestion, evaluations and this reviewer assistant are metered too.

## Tagging, chargeback and budgets
Every call carries an agency tag and a use-case tag. The dashboard shows spend by agency, use case and model, and exports a chargeback-ready CSV. Each agency has a monthly budget. An alert fires once when an agency crosses 80% and again at 100%, and it can post to a Teams or Slack webhook. A month-end forecast uses the run rate. A model what-if panel re-prices the same logged tokens on another model, which turns model selection into a cost decision with numbers behind it.

## Why Azure OpenAI first
Azure OpenAI is the stack named in the role, and it keeps data inside a Microsoft tenant that state agencies already govern. The app uses a provider adapter: Azure OpenAI when configured, with OpenAI or Anthropic Claude as fallbacks. The cost model and logging are identical across providers, so switching providers is a configuration change, not a rewrite.

## Guardrails
The demo enforces a global daily spending cap and a per-IP rate limit before any model call. It redacts emails, phone numbers and SSN-like patterns from stored questions and keeps at most 500 characters. API keys stay on the server. Every answer shows an AI-assistance disclaimer, which mirrors the disclaimer requirement in the Commonwealth's AI policy standard.

## Agent versus automation
This demo deliberately uses a retrieval pipeline, not an autonomous agent. The task is a single, well-bounded step (find and cite policy text), so a deterministic pipeline is cheaper, faster and easier to audit than an agent. An agent becomes the right tool when a task needs multiple steps with decisions between them, such as triaging a citizen request, pulling the relevant policy, drafting a reply and routing it to a human for approval. A rules-based automation or RPA is the right tool when the steps are fixed and need no language understanding.

## How this would scale to 60+ agencies
In production: Entra ID single sign-on with per-agency roles; documents in each agency's tenant through Azure AI Search or Postgres; Azure API Management in front of the models to enforce token quotas and produce chargeback by agency; traces in Azure Monitor; a document refresh pipeline with change detection; registration of each use case in the Commonwealth's AI registry; and human review for any answer that reaches the public. The tagging scheme in this demo is the same one that would feed central chargeback.

## The POC process behind it
PolicyMeter was run as a time-boxed POC: four days to build and one day to evaluate, with success criteria set before coding (retrieval hit rate of at least 85%, citations on at least 95% of in-scope answers, groundedness of at least 4.2 out of 5, all out-of-scope questions refused, and a measured cost per answered question). The scorecard on the Architecture page records the results and an adopt, extend or stop decision.

## Tech stack
Next.js 15 with TypeScript, Tailwind and Recharts; Supabase Postgres with pgvector; Azure OpenAI, with OpenAI and Anthropic fallbacks; deployed on Vercel. Built with Claude Code using staged prompts.
