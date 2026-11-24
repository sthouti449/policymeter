"use client";
import { Download } from "lucide-react";
import { filtersToQuery, type Preset } from "@/lib/metrics/query-string";
import type { Filters } from "@/lib/metrics/types";

interface Option { value: string; label: string }
interface Props {
  apiBase: string;
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
export function FilterBar({ apiBase, filters, preset, agencies, useCases, models, showSimulatedBadge, onPreset, onChange }: Props) {
  const style = { borderColor: "var(--viz-border)", color: "var(--viz-text-1)" };
  const select = (label: string, value: string | undefined, options: Option[], key: "agency" | "useCase" | "model") => (
    <label className="grid gap-1 text-xs" style={{ color: "var(--viz-text-2)" }}>{label}
      <select value={value ?? ""} onChange={(e) => onChange({ [key]: e.target.value || undefined })} className={field} style={style}>
        <option value="" style={{ color: "#0b0b0b" }}>All</option>
        {options.map((o) => <option key={o.value} value={o.value} style={{ color: "#0b0b0b" }}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="flex flex-wrap items-end gap-4" role="search" aria-label="Dashboard filters">
      <div role="group" aria-label="Date range" className="flex overflow-hidden rounded-md border" style={style}>
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => onPreset(p.id)} aria-pressed={preset === p.id}
            className="px-3 py-1.5 text-sm" style={preset === p.id ? { background: "var(--viz-text-1)", color: "var(--viz-surface)" } : undefined}>
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
        <span className="mb-1.5 rounded-full border px-2.5 py-0.5 text-xs" style={style}>Includes simulated traffic</span>
      )}
      <a href={`${apiBase}/calls${filtersToQuery(filters, { format: "csv" })}`} download className="ml-auto flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm" style={style}>
        <Download size={14} aria-hidden /> Export CSV
      </a>
    </div>
  );
}
