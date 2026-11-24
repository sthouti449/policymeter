import { notFound } from "next/navigation";
import { chat, embed } from "@/lib/llm";
import { getEnv } from "@/lib/env";
import { getPrice } from "@/lib/config";

// TEMPORARY Stage 0 page: proves the adapter works with real usage numbers.
// Removed in Stage 7. It is blocked in production so nobody can spend your money.
export const dynamic = "force-dynamic";

async function run() {
  const meta = { requestId: crypto.randomUUID(), agency: "VITA", useCase: "dev-ping" };
  const out: Record<string, unknown> = { providers: getEnv().providers };
  try {
    const res = await chat({ messages: [{ role: "user", content: "Reply with OK" }], tier: "fast", maxTokens: 50, meta });
    out.chat = { text: res.text, provider: res.provider, model: res.model, latencyMs: res.latencyMs, usage: res.usage, price: getPrice(res.model) };
  } catch (e) {
    out.chat = { error: e instanceof Error ? e.message : String(e) };
  }
  try {
    const res = await embed(["ping"], meta);
    out.embed = { model: res.model, dims: res.vectors[0]?.length, usage: res.usage };
  } catch (e) {
    out.embed = { error: e instanceof Error ? e.message : String(e) };
  }
  return out;
}

export default async function Ping({ searchParams }: { searchParams: Promise<{ go?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { go } = await searchParams;
  let result: Record<string, unknown> | null = null;
  let configError: string | null = null;
  if (go) {
    try {
      result = await run();
    } catch (e) {
      configError = e instanceof Error ? e.message : String(e);
    }
  }
  return (
    <main className="mx-auto max-w-2xl p-8 font-mono text-sm">
      <h1 className="mb-4 text-lg font-semibold">/dev/ping (Stage 0 only)</h1>
      <form method="get">
        <button name="go" value="1" className="rounded bg-black px-4 py-2 text-white">Send &ldquo;Reply with OK&rdquo; (fast tier) + 1 embedding</button>
      </form>
      {configError && <pre className="mt-4 whitespace-pre-wrap text-red-600">{configError}</pre>}
      {result && <pre className="mt-4 whitespace-pre-wrap rounded bg-neutral-100 p-4">{JSON.stringify(result, null, 2)}</pre>}
    </main>
  );
}
