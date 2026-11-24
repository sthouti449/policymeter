"use client";
import { Download } from "lucide-react";
import { filtersToQuery, type Preset } from "@/lib/metrics/query-string";
import type { Filters } from "@/lib/metrics/types";

interface Option { value: string; label: string }
interface Props {
  filters: Filters;
  preset: Preset;
  agencies: Option[];
  useCases: Option[];
  models: Option[];
  showSimulatedBadge: boolean;
  onPreset: (p: Preset) => void;
  onChange: (patch: Partial<Filters>) => void;
}

const PRESETS: { id: Preset; label: string }[] = [{ id: "7d", label: "7 days" }, { id: "30d", label: "30 days" }, { id: "mtd", label: "Month to date" }];
const field = "rounded-md border bg-transparent px-2 py-1.5 text-sm";

/** One row of filters above the charts. Selection is shown with a filled button, not colour alone. */
export function FilterBar({ filters, preset, agencies, useCases, models, showSimulatedBadge, onPreset, onChange }: Props) {
  const style = { borderColor: "var(--viz-border)", color: "var(--viz-text-1)" };
  const select = (label: string, value: string | undefined, options: Option[], key: "agency" | "useCase" | "model") => (
    <label className="grid gap-1 text-xs" style={{ color: "var(--viz-text-2)" }}>{label}
      <select value={value ?? ""} onChange={(e) => onChange({ [key]: e.target.value || undefined })} className={field} style={style}>
        <option value="">All</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-end gap-4" role="search" aria-label="Dashboard filters">
      <div role="group" aria-label="Date range" className="flex overflow-hidden rounded-lg border border-ink-200 bg-ink-50 p-0.5">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => onPreset(p.id)} aria-pressed={preset === p.id}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${preset === p.id ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-white hover:text-ink-900"}`}>
            {p.label}
          </button>
        ))}
      </div>
      {select("Agency", filters.agency, agencies, "agency")}
      {select("Use case", filters.useCase, useCases, "useCase")}
      {select("Model", filters.model, models, "model")}
      <label className="flex items-center gap-2 pb-1.5 text-sm">
        <input type="checkbox" checked={filters.includeSimulated} onChange={(e) => onChange({ includeSimulated: e.target.checked })} />
        Include simulated traffic
      </label>
      {showSimulatedBadge && (
        <span className="chip mb-1.5 whitespace-nowrap !border-brand-200 !bg-brand-50 text-brand-800">Includes simulated traffic</span>
      )}
      <a href={`/api/calls${filtersToQuery(filters, { format: "csv" })}`} download className="btn btn-secondary ml-auto !px-4 !py-2" style={style}>
        <Download size={14} aria-hidden /> Export CSV
      </a>
    </div>
  );
}
