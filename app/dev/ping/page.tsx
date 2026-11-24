import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getAgencies } from "@/lib/config";
import { runPing } from "@/lib/dev/ping";
import { INTERNAL_USE_CASES } from "@/lib/guardrails/input";

// TEMPORARY page: proves the adapter, metering and guardrails work with real
// numbers. Removed in Stage 7. Blocked in production so nobody can spend your money.
export const dynamic = "force-dynamic";

type Params = { go?: string; agency?: string; useCase?: string };

export default async function Ping({ searchParams }: { searchParams: Promise<Params> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { go, agency = "VITA", useCase = "policy-qa" } = await searchParams;
  const cfg = getAgencies();

  let result: { status: number; body: Record<string, unknown> } | null = null;
  let configError: string | null = null;
  if (go) {
    try {
      result = await runPing({ headers: await headers() }, agency, useCase);
    } catch (e) {
      configError = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8 font-mono text-sm">
      <h1 className="mb-4 text-lg font-semibold">/dev/ping (temporary)</h1>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">Agency
          <select name="agency" defaultValue={agency} className="rounded border p-2">
            {cfg.agencies.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
          </select>
        </label>
        <label className="grid gap-1">Use case
          <select name="useCase" defaultValue={useCase} className="rounded border p-2">
            {cfg.use_cases.filter((u) => !INTERNAL_USE_CASES.includes(u.code)).map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}
          </select>
        </label>
        <button name="go" value="1" className="rounded bg-black px-4 py-2 text-white">Ping (1 chat + 1 embedding)</button>
      </form>
      {configError && <pre className="mt-4 whitespace-pre-wrap text-red-600">{configError}</pre>}
      {result && (
        <pre className="mt-4 whitespace-pre-wrap rounded bg-neutral-100 p-4">
          {`HTTP ${result.status}\n${JSON.stringify(result.body, null, 2)}`}
        </pre>
      )}
    </main>
  );
}
