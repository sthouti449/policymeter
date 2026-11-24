import { Check, OctagonX, TriangleAlert } from "lucide-react";
import type { BudgetStatus } from "@/lib/metrics/types";

const CONFIG = {
  OK: { Icon: Check, color: "var(--viz-good)" },
  Warning: { Icon: TriangleAlert, color: "var(--viz-warning)" },
  Breached: { Icon: OctagonX, color: "var(--viz-critical)" },
} as const;

/** Status colours are reserved and never carry meaning alone: icon + label always. Text stays in ink. */
export function StatusPill({ status }: { status: BudgetStatus }) {
  const { Icon, color } = CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: "var(--viz-border)", color: "var(--viz-text-1)" }}>
      <Icon size={13} aria-hidden style={{ color }} />
      {status}
    </span>
  );
}
