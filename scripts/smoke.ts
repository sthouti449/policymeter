// Post-deploy smoke test. Talks to a running site over HTTP only (no keys needed here).
// Usage: npx tsx scripts/smoke.ts https://YOUR-APP.vercel.app
// It spends a few cents: one policy answer, one refusal and one reviewer answer.

interface Check { name: string; ok: boolean; detail: string }
// The parts of the final server-sent event this test looks at.
interface FinalEvent { type: string; refused?: boolean; refusalReason?: string; citationsUsed?: number[]; cost?: { costUsd?: number }; message?: string }
const checks: Check[] = [];
const record = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); };

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: npx tsx scripts/smoke.ts https://YOUR-APP.vercel.app");
  process.exit(2);
}

/** POST /api/chat and collect the server-sent events. */
async function chat(question: string) {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: question }], agency: "VITA", useCase: "policy-qa" }),
  });
  if (!res.ok) return { status: res.status, final: undefined as FinalEvent | undefined, text: await res.text() };
  const text = await res.text();
  let final: FinalEvent | undefined;
  for (const frame of text.split("\n\n")) {
    if (frame.startsWith("data: ")) {
      const ev = JSON.parse(frame.slice(6)) as FinalEvent;
      if (ev.type === "final") final = ev;
      if (ev.type === "error") record("chat stream", false, ev.message ?? "stream error");
    }
  }
  return { status: res.status, final, text };
}

async function main() {
  // 1. A policy question gets a cited answer with a real cost.
  const a = await chat("What disclaimer must AI-generated outputs include?");
  record("policy answer", a.status === 200 && !!a.final && !a.final.refused, a.final ? `refused=${a.final.refused}` : `HTTP ${a.status}`);
  record("answer has a valid citation", (a.final?.citationsUsed?.length ?? 0) > 0, `citations: ${JSON.stringify(a.final?.citationsUsed ?? [])}`);
  record("answer shows a non-zero cost", (a.final?.cost?.costUsd ?? 0) > 0, `cost $${a.final?.cost?.costUsd ?? "n/a"}`);

  // 2. An out-of-scope question is refused.
  const r = await chat("What's the weather in Richmond tomorrow?");
  record("out-of-scope refused", r.status === 200 && r.final?.refused === true, r.final ? `reason=${r.final.refusalReason}` : `HTTP ${r.status}`);

  // 3. The reviewer assistant answers about the demo.
  const d = await fetch(`${base}/api/ask-demo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "How is cost calculated?" }) });
  const demo = d.ok ? await d.json() : null;
  record("reviewer answer", !!demo && demo.refused === false && demo.answer.length > 20, demo ? `${demo.answer.slice(0, 60)}...` : `HTTP ${d.status}`);

  // 4. The dashboard API serves the calls we just made.
  const m = await fetch(`${base}/api/metrics`);
  const metrics = m.ok ? await m.json() : null;
  record("metrics endpoint", !!metrics && metrics.kpis.calls > 0, metrics ? `${metrics.kpis.calls} calls, $${metrics.kpis.spendUsd.toFixed(4)}` : `HTTP ${m.status}`);

  // 5. Hardening is in place on the deployed site.
  const home = await fetch(base);
  record("security headers", !!home.headers.get("content-security-policy") && home.headers.get("x-content-type-options") === "nosniff" && home.headers.get("x-frame-options") === "DENY", "CSP, nosniff, frame deny");
  record("no framework banner", !home.headers.get("x-powered-by"), "x-powered-by absent");
  for (const p of ["/dev/ping", "/api/dev/ping", "/dev/dashboard-preview"]) {
    const res = await fetch(`${base}${p}`);
    record(`${p} is gone`, res.status === 404, `HTTP ${res.status}`);
  }
  const evil = await fetch(`${base}/api/ask-demo`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ question: "hi" }) });
  record("cross-site POST blocked", evil.status === 403, `HTTP ${evil.status}`);
  const noToken = await fetch(`${base}/api/evals/run`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  record("evals need the admin token", noToken.status === 401 || noToken.status === 503, `HTTP ${noToken.status}`);
}

main()
  .catch((err) => record("smoke test ran to the end", false, err instanceof Error ? err.message : String(err)))
  .finally(() => {
    console.log(`\nSmoke test: ${base}\n`);
    for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name.padEnd(34)} ${c.detail}`);
    const failed = checks.filter((c) => !c.ok).length;
    console.log(`\n${failed ? `${failed} FAILED` : "All checks passed"} (${checks.length} checks)`);
    process.exit(failed ? 1 : 0);
  });
