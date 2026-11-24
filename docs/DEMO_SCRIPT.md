# 5-minute demo script

Live site: https://policymeter-mu.vercel.app

Every step below was tried against the live site. Numbers and behaviours are what it actually does, not what it should do. Anything the demo does **not** do is listed at the end under "Do not claim".

| Part | Page | Time |
|---|---|---|
| Opening | | 15 s |
| 1. Can we trust the answers? | `/chat` | 90 s |
| 2. Who pays for the tokens? | `/dashboard` | 90 s |
| 3. Proof, not screenshots | `/evals` | 45 s |
| 4. Scale and judgment | `/architecture` | 45 s |
| Close | the "Ask about this demo" widget | 15 s |

## Before you start (5 minutes before)
- [ ] **Wake the database.** Open your Supabase project in a browser tab. Free projects pause when idle, and a paused one makes every page fail.
- [ ] Open four tabs: `/chat`, `/dashboard`, `/evals`, `/architecture`.
- [ ] **Warm up once.** Ask any question on `/chat` (the first answer after a quiet spell is slower). It costs about a hundredth of a cent.
- [ ] The scorecard on `/architecture` has blanks for the dates, the Adopt/Extend/Stop decision and the recommendation. **Fill them in first**, or be ready to say they are yours to complete.
- [ ] Spending limits are set in the Anthropic and OpenAI consoles.
- [ ] Browser at 100 to 110% zoom, window wide enough that the dashboard shows two columns.
- [ ] **Pace yourself:** the site allows 8 questions a minute per visitor. This script asks 4. If you rehearse, wait a minute between runs.
- [ ] Do not press **Run evals** live. It takes about a minute, close to the 60-second function limit, and it has not been tested on Vercel.

## Opening (15 s)
> "Before an agency scales a chatbot, two questions come up: can we trust the answers, and who pays for the tokens? PolicyMeter answers both in one working system, over public Virginia AI policy documents. I built it Azure-first, and I'll be upfront about what it runs on today when we get to the architecture."

## 1. Trustworthy answers: `/chat` (90 s)
Choose **Agency = DMV** and **Use case = Policy Q&A**.

1. **Ask:** *What disclaimer must AI-generated outputs include?*
   - **Show:** the answer quotes the required wording. Click the blue **[1]** to open the source panel with the exact text and page. Point to the grey disclaimer line under the answer.
   - **Say:** "Every sentence is cited, and the app shows the same disclaimer the policy requires. Under the answer is the cost chip: about four hundredths of a cent for the whole question."
2. **Ask:** *What did Executive Order 30 direct VITA to publish?*
   - **Show:** the answer appears with a **red notice** that it cites a rescinded document and what replaced it.
   - **Say:** "Stale policy is a real risk with retrieval. Every document carries a status, and when an answer relies on a rescinded one, the app says so and names the replacement."
3. **Ask:** *Is Executive Order 30 still in effect?*
   - **Show:** a short answer: rescinded by Executive Order 22, but the policies published under it remain in effect unless or until replaced. (No red notice this time, because the answer cites EO 22, which is current.)
   - **Say:** "It reads the nuance directly from EO 22."
4. **Ask:** *What is VDOT's FY2027 budget?*
   - **Show:** "I can't find that in the loaded documents."
   - **Say:** "The documents don't cover it, so it refuses. It refused before any chat model was called, so that question cost only an embedding, under a hundredth of a cent."

## 2. Token economics: `/dashboard` (90 s)
1. **Show the KPI row.** Point to **Cost per answered question**.
   - **Say:** "Every model call is logged with its tokens, cost, agency tag and use case. This counts the whole question: rewrite, embedding and answer."
2. **Spend by agency, use case and model.** Click **Export CSV**.
   - **Say:** "Every call is tagged where it happens, so chargeback is a query, not a spreadsheet exercise."
3. **Be upfront about the data.** Point to the **Includes simulated traffic** badge, then untick **Include simulated traffic**.
   - **Say:** "The 30-day history is simulated traffic, labelled as such. Today's calls and the eval runs are real. Switch simulated off and you see only the real ones." Tick it back on.
4. **Budgets table.**
   - **Say:** "Each agency has a monthly budget. Alerts fire once at 80% and once at 100%, and can post to Teams or Slack. Everyone is under budget right now, so nothing is firing." (If you want to show an alert, lower one agency's budget in `config/agencies.json` beforehand and redeploy.)
5. **Model what-if.** First set the **Use case** filter to **Policy Q&A**, then choose **Claude Sonnet 5.5** in the what-if card.
   - **Show:** "would cost … vs … actual", about **1,900% more**.
   - **Say:** "Same traffic on the bigger model costs 20 times as much. That's the conversation I'd have with an agency before approving a model." (Without the filter the figure is muddied, because the eval judge already runs on Sonnet.)
6. **Guardrails, in one sentence.** "A daily spend cap and a per-visitor rate limit mean this public demo cannot run up a bill."

## 3. Proof, not screenshots: `/evals` (45 s)
- **Show:** the scorecard, all six measured targets green, then the **Run history** chart.
- **Say:** "I set the targets before writing code. My first real run failed three of six, with groundedness at 3.55. The evals found three real problems: my own judge could not see which sources were rescinded, keyword search was matching nothing, and one answer came back blank because the model spent its whole token budget thinking. I fixed them, and groundedness went to 4.83. This is the fifth run, so it is a tuned result on a small set, not an independent test."
- **Show:** the **Questions** table and the one row marked "needs a look" (the NIST question). Open it.
- **Say:** "It still misses one: the right passage exists but ranks below the top six. It answered honestly that it couldn't confirm, instead of guessing. The next lever would be reranking."
- **Say:** "A full eval costs about eleven cents, and 94% of that is the judge model. Evaluation spend is real spend too, and it costs about 20 times more than answering."

## 4. Scale and judgment: `/architecture` (45 s)
- **Show:** the diagram, then the **"This deployment"** box.
- **Say (honest version):** "I built it Azure-first behind one provider adapter. Today it runs Claude for chat and OpenAI for embeddings, because that is what I had access to in the time box. The Azure OpenAI path is built and unit-tested with recorded payloads, but I have not run it against a live Azure resource. Switching is configuration, not a rewrite, and I'd prove that in the first week of a pilot."
- **Show:** the **Production path** list. **Say:** "Entra ID, API Management for central token quotas and chargeback, search in the agency's tenant, registry registration, human review for anything public."
- **Say (agent vs automation):** "I chose a pipeline, not an agent, because this is one bounded step: find and cite policy text. An agent earns its place when there are decisions between steps, such as triaging a citizen request with a human approval."

## Close (15 s)
Click **Ask about this demo**, then the chip **How would this scale to 60+ agencies?**
> "If you have questions after today, this assistant answers them from my notes only. Its usage shows up on the dashboard under the DEMO agency, and it has its own spending cap so it can never be locked out."

---

## Likely panel questions

**Why Claude when the role says Azure OpenAI?**
"I designed for Azure and kept the model layer behind one adapter. In the time box I used the providers I had keys for. The Azure path is written and tested against recorded responses, but not run live. That is the first thing I'd verify in a pilot."

**How do you know the answers are good?**
"A 16-question golden set scored for retrieval, citations, groundedness by a judge model, and refusals. The numbers are on `/evals`. The honest limits: it is small, I tuned between runs, and the judge is itself a model, so it needs spot-checking by a person."

**What went wrong along the way?**
"Three things, all caught by the evals. My judge could not see source headers, so it marked correct rescinded-document answers as fabricated. Keyword search required every word of a long question to match, so it was effectively off. And Claude Haiku once spent all 700 tokens thinking and returned a blank answer that was logged as a success. Now thinking is off for the fast tier, and an empty reply is treated as an error."

**How accurate is the token counting?**
"Costs come from the usage the provider returns, not estimates, and any estimated row is flagged. Internally the log has no estimated, unpriced or failed calls. I have not yet compared the totals with the Anthropic and OpenAI consoles. `check:metering` prints the numbers to compare, and I'd call that item pending."

**Is the refusal threshold reliable?**
"It was measured, not guessed: out-of-scope questions topped out at 0.39 similarity and in-scope ones started at 0.47, so I set the cutoff at 0.42. That gap is narrow and it comes from 16 questions. I'd re-measure with `npm run calibrate` whenever documents change."

**What about PII?**
"There is no personal data in the corpus. Stored questions are redacted for emails, phone numbers and SSN-like numbers, capped at 500 characters, and question text is never shown on the dashboard or in the export. A production version would add content-safety and data-loss-prevention policies."

**Could someone abuse the public site?**
"There is a global daily spend cap, a separate smaller one for the reviewer assistant, a per-visitor rate limit, a same-origin check on every state-changing call, an admin token for evals, and strict security headers. If the database is unreachable it fails closed."

**Why pgvector and not Azure AI Search?**
"Speed and cost for a proof of concept. Retrieval is one function, so Azure AI Search is a contained swap for production."

**How do you keep documents current?**
"Files are hashed, so only changed documents re-embed, and a status change costs nothing. Two limits to know: EO 30 is a scanned image with text on only one of four pages, and there is no OCR in this demo, so most of its own wording isn't searchable. Production would add OCR and a scheduled refresh with change alerts."

**What would make you stop?**
"Groundedness stuck below 4.0 after two rounds of fixes, or a cost per answer above the value of the staff time it saves. Today it is $0.0004 per answer and groundedness is 4.83."

**What would you do next?**
"Add reranking for the miss I showed, put follow-up questions into the golden set, re-measure the refusal cutoff on real agency questions, run on Azure OpenAI in the agency's tenant, and add sign-in with per-agency roles."

## Do not claim
- That it runs on Azure OpenAI today (it does not).
- That token counts are reconciled with the providers (not yet done).
- That the answers are always right. It is a tuned result on 16 questions.
- That EO 30 is fully searchable (it is mostly a scan).
- That follow-up questions are tested (the rewrite step exists, but the golden set has none).
- That the Run evals button works on the live site (untested).

## If something goes wrong
| What you see | What to do |
|---|---|
| Every page shows an error, or "temporarily unavailable" | The Supabase project is paused. Open it in the dashboard, wait a minute, reload. |
| "The demo has hit its spending limit for today" | The daily cap was reached. Say so: that limit is one of the guardrails being demonstrated. |
| "Too many requests" | You asked more than 8 in a minute. Wait a minute. |
| A question is refused that should be answered | Rephrase it, or use one of the questions above, which are known to work. |
| First answer is slow | The server was idle. The next ones take about a second. |
