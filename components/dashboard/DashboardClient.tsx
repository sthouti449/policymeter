"use client";
import { useEffect, useState } from "react";
import { filtersToQuery, presetRange, type Preset } from "@/lib/metrics/query-string";
import type { Filters, MetricsPayload } from "@/lib/metrics/types";
import { AlertsPanel } from "./AlertsPanel";
import { BarCard } from "./BarCard";
import { BudgetTable } from "./BudgetTable";
import { CallsTable } from "./CallsTable";
import { DailyCard } from "./DailyCard";
import { FilterBar } from "./FilterBar";
import { KpiRow } from "./KpiRow";
import { TraceDrawer } from "./TraceDrawer";
import { WhatIfCard } from "./WhatIfCard";

interface Option { value: string; label: string }
interface Props { agencies: Option[]; useCases: Option[]; models: Option[] }

export function DashboardClient({ agencies, useCases, models }: Props) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [filters, setFilters] = useState<Filters>(() => ({ ...presetRange("30d"), includeSimulated: true }));
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [traceId, setTraceId] = useState<string | null>(null);

  const query = filtersToQuery(filters);
  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/metrics${query}`, { signal: ctl.signal })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? "Could not load the dashboard."))))
      .then((d: MetricsPayload) => { setData(d); setLoading(false); })
      .catch((e: Error) => { if (e.name !== "AbortError") { setError(e.message); setLoading(false); } });
    return () => ctl.abort();
  }, [query]);

  const agencyCodes = agencies.map((a) => a.value);
  const labelOf = (m: string) => data?.modelLabels[m] ?? m;
  const useCaseLabel = (k: string) => useCases.find((u) => u.value === k)?.label ?? k;

  return (
    <div className="viz-root min-h-screen">
      <main className="mx-auto max-w-7xl space-y-4 p-4 pt-8 md:p-6 md:pt-10">
        <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
          <div>
            <p className="eyebrow">Cost Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink-900 sm:text-3xl">Every call, by agency and use case</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-ink-600">Agency tags are simulated labels for cost allocation.</p>
          </div>
          <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-mint-600" aria-hidden /> Live data</span>
        </header>

        <div className="viz-card p-4"><FilterBar filters={filters} preset={preset} agencies={agencies} useCases={useCases} models={models}
          showSimulatedBadge={filters.includeSimulated && !!data?.hasSimulated}
          onPreset={(p) => { setPreset(p); setFilters((f) => ({ ...f, ...presetRange(p) })); }}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))} /></div>

        {data && data.zeroPricedModels.length > 0 && (
          <div role="alert" className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--viz-warning)", background: "var(--viz-surface)" }}>
            Some model prices are 0 in config/pricing.json; costs for those models are understated: {data.zeroPricedModels.map(labelOf).join(", ")}.
          </div>
        )}
        {error && <div role="alert" className="viz-card p-4 text-sm">{error}</div>}
        {loading && !data && <p className="py-16 text-center text-sm" style={{ color: "var(--viz-text-2)" }}>Loading&hellip;</p>}

        {data && (
          <div className={loading ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"} aria-busy={loading}>
            <KpiRow kpis={data.kpis} />
            <div className="grid gap-4 lg:grid-cols-2">
              <BarCard title="Spend by agency" keyLabel="Agency" rows={data.byAgency} />
              <BarCard title="Spend by use case" keyLabel="Use case" rows={data.byUseCase} labelOf={useCaseLabel} />
              <BarCard title="Spend by model" keyLabel="Model" rows={dedupeModels(data)} labelOf={labelOf} />
              <DailyCard rows={data.daily} from={data.filters.from} to={data.filters.to} agencies={agencyCodes} />
            </div>
            <BudgetTable rows={data.budgets} />
            <div className="grid gap-4 lg:grid-cols-2">
              <AlertsPanel alerts={data.alerts} />
              <WhatIfCard key={data.chatModels.length} data={data} />
            </div>
            <CallsTable filters={filters} modelLabels={data.modelLabels} onTrace={setTraceId} />
          </div>
        )}
      </main>
      {traceId && <TraceDrawer requestId={traceId} onClose={() => setTraceId(null)} />}
    </div>
  );
}

/** by_model is grouped by model AND operation; the chart wants one bar per model. */
function dedupeModels(d: MetricsPayload) {
  const m = new Map<string, MetricsPayload["byAgency"][number]>();
  for (const r of d.byModel) {
    const cur = m.get(r.key) ?? { key: r.key, calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
    m.set(r.key, { ...cur, calls: cur.calls + r.calls, costUsd: cur.costUsd + r.costUsd, inputTokens: cur.inputTokens + r.inputTokens, outputTokens: cur.outputTokens + r.outputTokens });
  }
  return [...m.values()].sort((a, b) => b.costUsd - a.costUsd);
}
