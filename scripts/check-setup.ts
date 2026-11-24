import "./_env";
import fs from "node:fs";
import { getSupabase } from "@/lib/db/supabase";

// Usage: npm run check:setup
// Read-only. Tells you what is missing before you ingest, evaluate or deploy:
// which settings are empty (names only, never values), whether Supabase is reachable,
// and whether every table, column and function the app needs exists.
interface Row { check: string; ok: boolean; fix: string }
const rows: Row[] = [];
const add = (check: string, ok: boolean, fix = "") => rows.push({ check, ok, fix });

const REQUIRED = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "IP_HASH_SALT", "ADMIN_TOKEN", "LLM_CHAT_PROVIDER", "LLM_EMBED_PROVIDER", "ANTHROPIC_MODEL_FAST", "ANTHROPIC_MODEL_SMART", "OPENAI_EMBED_MODEL"];

// table -> columns that must exist, and the migration that adds the newest ones
const SCHEMA: [string, string, string][] = [
  ["documents", "doc_id,corpus,title,status,replaced_by,file_hash,ingested_at", "supabase/schema.sql"],
  ["chunks", "document_id,corpus,page,content,embedding_model", "supabase/schema.sql"],
  ["llm_calls", "request_id,agency,use_case,cost_usd,simulated,top_similarity,feedback", "supabase/schema.sql"],
  ["llm_calls", "ttft_ms", "migration 001"],
  ["llm_calls", "trace", "migration 003"],
  ["alerts", "agency,period,level,spend_usd,budget_usd,simulated", "migration 001"],
  ["rate_limits", "ip_hash,window_start,count", "supabase/schema.sql"],
  ["eval_runs", "groundedness_avg,p50_latency_ms", "supabase/schema.sql"],
  ["eval_runs", "p50_ttft_ms,cost_per_answered_usd", "migration 004"],
  ["eval_results", "run_id,question_id,groundedness", "supabase/schema.sql"],
  ["eval_results", "misses,request_id", "migration 004"],
];

async function main() {
  const empty = REQUIRED.filter((k) => !process.env[k]);
  add("settings filled in", empty.length === 0, empty.length ? `empty in .env.local: ${empty.join(", ")}` : "");
  if (fs.existsSync(".env.local") && /^(ANTHROPIC_API_KEY|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY)=\s*["'].*["']\s*$/m.test(fs.readFileSync(".env.local", "utf8"))) {
    add("no quotes around keys", false, "remove the quote marks around the values in .env.local");
  }
  if (process.env.SUPABASE_URL && !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(process.env.SUPABASE_URL)) {
    add("SUPABASE_URL looks right", false, "it should look like https://abcdefgh.supabase.co (no /rest/v1, no dashboard link)");
  }
  if (empty.includes("SUPABASE_URL") || empty.includes("SUPABASE_SERVICE_ROLE_KEY")) return;

  const db = getSupabase();
  for (const [table, cols, fix] of SCHEMA) {
    const { error } = await db.from(table).select(cols).limit(1);
    add(`${table}: ${cols.split(",").length > 3 ? "tables and columns" : cols}`, !error, error ? `${error.message} -> run ${fix}` : "");
  }

  const zero = JSON.stringify(new Array(1536).fill(0));
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const calls: [string, () => PromiseLike<{ error: { message: string } | null }>, string][] = [
    ["function daily_spend", () => db.rpc("daily_spend", { p_since: since, p_scope: "global" }), "migration 001"],
    ["function month_spend", () => db.rpc("month_spend", { p_agency: "VITA", p_since: since, p_include_simulated: false }), "migration 001"],
    ["function match_chunks", () => db.rpc("match_chunks", { query_embedding: zero, match_corpus: "policy", match_count: 1, min_similarity: 0 }), "supabase/schema.sql"],
    ["function keyword_chunks", () => db.rpc("keyword_chunks", { query_text: "test", match_corpus: "policy", match_count: 1 }), "supabase/schema.sql"],
    ["function chunks_by_id", () => db.rpc("chunks_by_id", { query_embedding: zero, chunk_ids: [] }), "migration 002"],
    ["function dashboard_metrics", () => db.rpc("dashboard_metrics", { p_from: since, p_to: new Date().toISOString() }), "migration 003"],
    ["function budget_mtd", () => db.rpc("budget_mtd", { p_since: since, p_include_simulated: false }), "migration 003"],
  ];
  for (const [name, run, fix] of calls) {
    const { error } = await run();
    add(name, !error, error ? `${error.message} -> run ${fix}` : "");
  }

  const docs = await db.from("documents").select("id", { count: "exact", head: true }).eq("corpus", "policy");
  const about = await db.from("documents").select("id", { count: "exact", head: true }).eq("corpus", "about");
  add(`policy documents loaded (${docs.count ?? 0})`, (docs.count ?? 0) > 0, "run: npm run ingest");
  add(`about notes loaded (${about.count ?? 0})`, (about.count ?? 0) > 0, "run: npm run ingest:about");
  const pdfs = fs.existsSync("data/sources") ? fs.readdirSync("data/sources").filter((f) => f.endsWith(".pdf")).length : 0;
  add(`PDFs in data/sources (${pdfs})`, pdfs > 0, "see docs/DATA_SOURCES.md");
}

main()
  .catch((err) => add("check ran to the end", false, err instanceof Error ? err.message : String(err)))
  .finally(() => {
    for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.ok || !r.fix ? "" : `\n        ${r.fix}`}`);
    const bad = rows.filter((r) => !r.ok).length;
    console.log(`\n${bad ? `${bad} thing(s) to fix` : "Setup looks complete"}`);
    process.exit(bad ? 1 : 0);
  });
