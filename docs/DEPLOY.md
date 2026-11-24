# Deploy runbook — Azure OpenAI, Supabase, Vercel

Portal labels change often; if a button name differs, look for the closest match.

## 1. Azure OpenAI (do this first; access can take time)
1. In the Azure portal, create a resource group (e.g. `rg-policymeter`).
2. Create an **Azure OpenAI** resource (or an Azure AI Foundry project with Azure OpenAI) in a US region that offers the models you want, such as East US 2.
3. Open **Azure AI Foundry → Deployments** and create three deployments:
   - a small, cheap chat model → name it `gpt-mini-fast` (this serves the chat and reviewer bot)
   - a stronger chat model → name it `gpt-smart` (used only by the eval judge)
   - `text-embedding-3-small` → name it `embed-small`
   Use **Standard / pay-as-you-go**. Keep the tokens-per-minute quota low (e.g. 30K) as an extra spend guard.
4. From **Keys and Endpoint**, copy the endpoint and a key into `.env.local`.
5. Set the `*_PRICING_KEY` values in `.env.local` to the base models you deployed, and add matching entries to `config/pricing.json` with current prices.
6. **Budget alert:** Cost Management → Budgets → create a monthly budget (e.g. $20) on the resource group with an email alert at 80%.

No Azure access yet? Set `LLM_PROVIDER=openai` (or leave `auto` with only `OPENAI_API_KEY` set). Switch to Azure later without code changes.

## 2. Supabase
1. Create a project at supabase.com (free tier, region near Virginia such as us-east-1). Save the database password.
2. **SQL Editor → New query** → paste `supabase/schema.sql` → Run. Confirm the tables appear under Table Editor.
3. **Project Settings → API:** copy the Project URL to `SUPABASE_URL` and the `service_role` key to `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service-role key to the browser.
4. Free-tier projects pause after a period of inactivity. Open the project before a demo, or upgrade for the interview week.

## 3. Local setup
```bash
mkdir policymeter && cd policymeter
# copy this kit's files in, then:
git init && git add . && git commit -m "kit"
cp .env.example .env.local    # fill it in
# put the PDFs from docs/DATA_SOURCES.md into data/sources/
claude                         # paste the Master prompt, then Stage 0…
```
Add to `.gitignore` (Claude Code will create it in Stage 0; check it includes): `.env*.local`, `data/sources/*.pdf` (optional — the PDFs are public, but keeping them out keeps the repo small), `.vercel`.

## 4. Vercel (Stage 7)
1. Push the repo to GitHub (`sureshkumarthouti-lang/policymeter`).
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: Next.js.
3. **Settings → Environment Variables:** add every variable from `.env.local` for Production (and Preview if you use preview deployments). Do not add `NEXT_PUBLIC_` to any key.
4. Deploy. Then run locally against production data once: ingestion writes straight to Supabase, so `npm run ingest` and `npm run ingest:about` only need to run once from your machine, not on Vercel.
5. Seed and evaluate:
   ```bash
   npm run seed            # simulated traffic, labeled
   npm run eval            # real eval run, metered
   npx tsx scripts/smoke.ts https://YOUR-APP.vercel.app
   ```
6. Optional: add a custom domain in Vercel → Domains.

## 5. Before every demo (5-minute checklist)
- [ ] Open the Supabase project (wakes it if paused).
- [ ] Load the production URL; ask one starter question; confirm the cost chip shows a non-zero cost.
- [ ] Dashboard: no zero-price banner; at least one Warning or Breached budget visible (lower one budget in `config/agencies.json` and redeploy if needed).
- [ ] `/evals` shows the latest run in green.
- [ ] `DAILY_SPEND_CAP_USD` is high enough for the session (e.g. $2) and Azure budget alert is on.

## 6. Troubleshooting
| Symptom | Likely cause | Fix |
|---|---|---|
| `DeploymentNotFound` | Deployment name in env doesn't match Azure | Copy the exact deployment name from Azure AI Foundry |
| Cost shows $0.0000 | Price missing or 0 in `pricing.json`, or pricing key mismatch | Check the banner; match `*_PRICING_KEY` to a key in `pricing.json` |
| Every question refused | Threshold too high or embeddings model changed | Run `scripts/try-retrieve.ts`; lower `RAG_MIN_SIMILARITY` to 0.25; re-ingest if the model changed |
| Vercel function timeout | Long stream or eval run | Set `maxDuration = 60` on those routes |
| 429 immediately | Daily cap reached (including seeded calls?) | Seeded rows are simulated and excluded from the cap; check `dailyCap.ts` filters `simulated = false` |
