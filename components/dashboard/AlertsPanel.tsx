import { OctagonX, TriangleAlert, Zap } from "lucide-react";
import type { AlertRow } from "@/lib/metrics/types";

const ICON = {
  warning: { Icon: TriangleAlert, color: "var(--viz-warning)", label: "Warning" },
  breached: { Icon: OctagonX, color: "var(--viz-critical)", label: "Breached" },
  daily_cap: { Icon: Zap, color: "var(--viz-critical)", label: "Daily cap" },
} as const;

/** Latest 20 alerts. Each fired once for its period. */
export function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  return (
    <section className="viz-card p-4" aria-label="Alerts">
      <h2 className="font-semibold">Alerts</h2>
      <p className="mb-3 text-xs" style={{ color: "var(--viz-text-2)" }}>Budget crossings and daily-cap hits. Each fires once per period.</p>
      {alerts.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--viz-text-2)" }}>No alerts yet.</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-auto">
          {alerts.map((a) => {
            const { Icon, color, label } = ICON[a.level];
            return (
              <li key={a.id} className="flex gap-2 text-sm">
                <Icon size={16} aria-hidden className="mt-0.5 shrink-0" style={{ color }} />
                <div>
                  <p><span className="font-medium">{label}</span> &middot; {a.agency}{a.simulated && <span style={{ color: "var(--viz-text-2)" }}> &middot; simulated</span>}</p>
                  <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>{a.message}</p>
                  <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>{new Date(a.createdAt).toLocaleString()}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
