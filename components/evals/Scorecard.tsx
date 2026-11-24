import { Check, Minus, X } from "lucide-react";
import type { TargetResult } from "@/lib/evals/types";

/** Pass or fail is an icon plus a word, never colour alone. Green/red only tint the icon. */
function Verdict({ pass }: { pass: boolean | null }) {
  const { Icon, label, color } = pass == null ? { Icon: Minus, label: "Not measured", color: "var(--viz-text-2)" }
    : pass ? { Icon: Check, label: "Pass", color: "var(--viz-good)" } : { Icon: X, label: "Fail", color: "var(--viz-critical)" };
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: "var(--viz-border)" }}>
      <Icon size={13} aria-hidden style={{ color }} />{label}
    </span>
  );
}

export function Scorecard({ targets, totalCostUsd, questions, when }: { targets: TargetResult[]; totalCostUsd: number | null; questions: number; when: string }) {
  const passed = targets.filter((t) => t.pass === true).length;
  const measured = targets.filter((t) => t.pass != null).length;
  return (
    <section className="space-y-3" aria-label="Scorecard">
      <p className="text-sm" style={{ color: "var(--viz-text-2)" }}>
        {passed} of {measured} targets met &middot; {questions} questions &middot; run cost {totalCostUsd == null ? "n/a" : `$${totalCostUsd.toFixed(4)}`} &middot; {when}
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {targets.map((t) => (
          <div key={t.key} className="viz-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>{t.label}</p>
              <Verdict pass={t.pass} />
            </div>
            <p className="mt-2 text-2xl font-semibold">{t.value}</p>
            <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>target {t.target}</p>
          </div>
        ))}
      </div>
      <p className="text-xs" style={{ color: "var(--viz-text-2)" }}>The seventh target, unmetered calls, is checked separately with <code>npm run check:metering</code>.</p>
    </section>
  );
}
