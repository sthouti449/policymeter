import fs from "node:fs";
import path from "node:path";
import { ArchitectureDiagram } from "@/components/architecture/ArchitectureDiagram";
import { Markdown } from "@/components/Markdown";
import { getPrice } from "@/lib/config";
import { getEnv } from "@/lib/env";
import { resolveChat, resolveEmbed } from "@/lib/llm/resolve";

export const metadata = { title: "Architecture" };

const PRODUCTION_PATH = [
  "Entra ID single sign-on with per-agency roles",
  "Azure AI Search, or Postgres inside each agency's tenant",
  "Azure API Management in front of the models for central token quotas and chargeback",
  "Azure Monitor / Log Analytics for traces",
  "A document refresh pipeline with change detection",
  "Registration of each use case in the Commonwealth's AI registry",
  "Human review for any answer that reaches the public",
];

const COST_FORMULA = `cost_usd = (input_tokens - cached_input_tokens - cache_write_tokens) / 1e6 * price.input
         + cached_input_tokens / 1e6 * price.cached_input
         + cache_write_tokens  / 1e6 * price.cache_write
         + output_tokens       / 1e6 * price.output

embedding cost = input_tokens / 1e6 * price.input
cost per answered question = sum of every call that shares a request_id
                             (rewrite + embedding + answer)
forecast = month-to-date spend / days elapsed * days in month`;

/** What this deployment actually runs on, read from configuration. */
function activeProviders(): { chat: string; embed: string } | null {
  try {
    const { env, providers } = getEnv();
    const label = (key: string) => { try { return getPrice(key).label; } catch { return key; } };
    const chat = resolveChat(env, providers.chat, "fast");
    const smart = resolveChat(env, providers.chat, "smart");
    const embed = resolveEmbed(env, providers.embed);
    return { chat: `${providers.chat}: ${label(chat.pricingKey)} (fast), ${label(smart.pricingKey)} (judge)`, embed: `${providers.embed}: ${label(embed.pricingKey)}` };
  } catch {
    return null;
  }
}

export default function ArchitecturePage() {
  const active = activeProviders();
  const scorecard = fs.readFileSync(path.join(process.cwd(), "docs", "POC_SCORECARD.md"), "utf8");

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-12">
      <header className="pb-2">
        <p className="eyebrow">Architecture</p>
        <h1 className="mt-1 text-3xl font-semibold text-ink-900 sm:text-4xl">How it works under the hood</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">How a question moves through PolicyMeter, how every call is metered, and what a production version would add.</p>
      </header>

      <section aria-labelledby="diagram" className="card p-4 sm:p-6"><h2 id="diagram" className="sr-only">Component diagram</h2><ArchitectureDiagram /></section>

      <section aria-labelledby="adapter" className="card space-y-3 p-6">
        <h2 id="adapter" className="text-xl font-semibold text-ink-900">One provider adapter</h2>
        <p className="leading-relaxed text-ink-700">
          All model calls go through <code className="rounded bg-neutral-100 px-1">lib/llm</code> (<code className="rounded bg-neutral-100 px-1">chat</code>, <code className="rounded bg-neutral-100 px-1">chatStream</code>, <code className="rounded bg-neutral-100 px-1">embed</code>); nothing else imports a model SDK.
          Chat and embeddings are chosen separately. With <code className="rounded bg-neutral-100 px-1">auto</code>, Azure OpenAI is used when configured, then OpenAI, then Anthropic for chat, and Azure then OpenAI for embeddings. Anthropic has no embeddings API.
          The adapter returns usage in one shape for every provider, and every call, including failures, is logged in a <code className="rounded bg-neutral-100 px-1">finally</code> block, so spend can&rsquo;t go unmetered.
        </p>
        {active ? (
          <p className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm leading-relaxed text-ink-800">
            <strong>This deployment:</strong> chat on {active.chat}; embeddings on {active.embed}.
            The Azure OpenAI path is built and unit-tested with recorded payloads, but this deployment does not run on it.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="cost" className="card space-y-3 p-6">
        <h2 id="cost" className="text-xl font-semibold text-ink-900">How cost is calculated</h2>
        <p className="leading-relaxed text-ink-700">Cost comes from the token counts the provider actually returns, priced from one file, <code className="rounded bg-neutral-100 px-1">config/pricing.json</code>. A missing price throws instead of costing $0, and the dashboard warns while any price in use is 0.</p>
        <pre className="overflow-x-auto rounded-xl bg-ink-900 p-4 font-mono text-xs leading-relaxed text-ink-100">{COST_FORMULA}</pre>
      </section>

      <section aria-labelledby="prod" className="card space-y-3 p-6">
        <h2 id="prod" className="text-xl font-semibold text-ink-900">Production path</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-ink-700 marker:text-brand-500">{PRODUCTION_PATH.map((p) => <li key={p}>{p}</li>)}</ul>
      </section>

      <section aria-labelledby="scorecard" className="card p-6">
        <h2 id="scorecard" className="text-xl font-semibold text-ink-900">POC scorecard</h2>
        <Markdown source={scorecard} headingOffset={1} dropTitle />
      </section>
    </main>
  );
}
