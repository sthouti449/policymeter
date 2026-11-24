# 5-minute demo script

**Opening line (15 s):** "Before an agency scales a chatbot, two questions come up: can we trust the answers, and who pays for the tokens? PolicyMeter answers both in one system, on Azure OpenAI, using public Virginia AI policy."

## 1. Trustworthy answers — `/chat` (90 s)
1. Agency = **DMV**, use case = **Policy Q&A**. Ask: *"What disclaimer must AI-generated outputs include?"*
   - Point to the [1] citation → click it → the source text and page.
   - Point to the disclaimer line under the answer: "The app follows the same rule it's answering about."
2. Ask: *"Is Executive Order 30 still in effect?"*
   - "It cites EO 30, flags it as rescinded, and names EO 22, and notes that policies under EO 30 stay in effect until replaced. Stale policy is a real risk with RAG; status metadata handles it."
3. Ask: *"What's VDOT's FY2027 budget?"* → refusal.
   - "No supporting text, so it refuses. And because it refused before the chat call, that question cost only an embedding — fractions of a cent."

## 2. Token economics — `/dashboard` (90 s)
1. Point to the **cost chip** from the last answer, then the KPI **cost per answered question**.
2. Spend by agency and use case → "Every call is tagged at the source, so chargeback is a query, not a spreadsheet." Click **Export CSV**.
3. **Budget table:** show the agency in Warning/Breached and the alert. "Alerts fire once at 80% and 100% and can post to Teams."
4. **Model what-if:** switch to the stronger model. "Same traffic, X times the cost. That's the conversation I'd have with an agency before approving a model."
5. Mention the **daily cap and rate limit**: "This public demo can't run up a bill."
6. Be upfront: "The 30-day history is simulated traffic, labeled with this badge; today's calls are real."

## 3. Proof, not screenshots — `/evals` (45 s)
- Scorecard vs. targets: retrieval hit rate, citation rate, groundedness, refusals. "Targets were set before I wrote code. Every bad answer becomes a new test."
- Total eval cost shown, because evaluation spend is real spend too.

## 4. Scale and judgment — `/architecture` (45 s)
- Provider adapter: "Azure first, portable by configuration."
- Production path: Entra ID, API Management for central token quotas, agency-tenant search, AI registry, human review.
- Agent vs. automation: "I chose a pipeline, not an agent, because this is a single bounded step. I'd use an agent for citizen-request triage with a human approval step."

## 5. Close (15 s)
Open the **Ask about this demo** widget and click "How would this scale to 60+ agencies?" → "And if you have questions after today, this assistant answers them, and its own usage shows up on the dashboard under DEMO."

---

## Likely panel questions (have these ready)
- **How accurate is token counting?** Costs come from provider-reported usage, not estimates; estimated rows are flagged; `check-metering` reconciles against Azure Cost Management.
- **What about PII?** No personal data in the corpus; stored questions are redacted and truncated; production would add Azure AI Content Safety and data-loss-prevention policies.
- **Why pgvector, not Azure AI Search?** Speed and cost for a POC; the retrieval interface is one function, and Azure AI Search is the production swap.
- **What would make you stop this POC?** Groundedness under 4.0 after two iterations, or cost per answer above the value of the staff time saved.
- **How do you keep documents current?** File hashing re-ingests changed documents; production adds a scheduled crawler and change alerts to document owners.
