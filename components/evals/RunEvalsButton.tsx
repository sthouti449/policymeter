"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";

const KEY = "pm-admin-token"; // sessionStorage only: gone when the tab closes, never sent anywhere but this API

/** Asks for the admin token, runs the golden set on the server, then refreshes the page. */
export function RunEvalsButton() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { try { setToken(sessionStorage.getItem(KEY) ?? ""); } catch { /* storage blocked: the field just starts empty */ } }, []);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      try { sessionStorage.setItem(KEY, token); } catch { /* ignore */ }
      const res = await fetch("/api/evals/run", { method: "POST", headers: { "x-admin-token": token, "content-type": "application/json" }, body: "{}" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "The eval run failed.");
      router.push(`/evals?run=${body.runId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The eval run failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs" style={{ color: "var(--viz-text-2)" }}>Admin token
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" className="rounded-md border bg-transparent px-2 py-1.5 text-sm" style={{ borderColor: "var(--viz-border)", color: "var(--viz-text-1)" }} />
      </label>
      <button disabled={busy || !token} className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm disabled:opacity-40" style={{ background: "var(--viz-text-1)", color: "var(--viz-surface)" }}>
        <Play size={14} aria-hidden />{busy ? "Running (about a minute)..." : "Run evals"}
      </button>
      {error && <p role="alert" className="basis-full text-sm">{error}</p>}
      {!error && <p className="basis-full text-xs" style={{ color: "var(--viz-muted)" }}>Runs the golden set with real model calls, which costs a few cents.</p>}
    </form>
  );
}
