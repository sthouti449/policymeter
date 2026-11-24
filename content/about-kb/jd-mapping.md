# How PolicyMeter maps to the role

<!-- EDIT: replace the left-column phrases with the exact wording from the VITA job description. -->

## Production chatbots and retrieval-augmented generation on Azure OpenAI
The Policy Assistant is a working RAG chatbot with cited answers, built Azure-first behind a provider adapter (this deployment runs Claude for chat and OpenAI for embeddings; the Azure OpenAI path is built and unit-tested but not run live), refusal when the documents are silent, superseded-document warnings, and an evaluation suite with measured retrieval, citation and groundedness scores.

## Token economics, tagging and cost allocation
Every model call, including ingestion, evaluations and this reviewer assistant, is logged with tokens, cost, agency tag and use case. The dashboard shows spend by agency, use case and model, cost per answered question, a month-end forecast, a model what-if comparison and a chargeback CSV export.

## Budget controls and alerting
Monthly budgets per agency raise alerts at 80% and 100%, optionally posted to a Teams or Slack webhook. A global daily cap and per-IP rate limit stop runaway spend before it happens.

## Choosing between AI agents, automation and no AI
The demo explains why it uses a deterministic retrieval pipeline instead of an agent for single-step policy lookup, and when an agent or an RPA workflow would be the better choice. The builder's AI Fit Evaluator applies the same judgment to new use cases, scoring security, human oversight, reliability and cost.

## Human oversight and responsible AI
Every answer shows an AI-assistance disclaimer that mirrors the Commonwealth's AI policy standard. Feedback buttons capture user judgment on each answer. The production path includes registration in the Commonwealth's AI registry and human review for any public-facing answer.

## Time-boxed proofs of concept
PolicyMeter itself was run as a POC: a four-day build, success criteria set before coding, an evaluation run, and a one-page scorecard with an adopt, extend or stop recommendation.

## Working in the customer's environment (forward-deployed engineering)
Azure-first design, a provider adapter for portability, observability through request traces, documented deployment and a handoff-ready README reflect how a forward-deployed engineer delivers inside a customer's stack.
