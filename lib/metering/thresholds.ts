export type BudgetLevel = "warning" | "breached";

// Compare at 1e-8 dollars (the DB's precision) so 2.4 of a 3.0 budget counts as
// exactly 80% instead of failing on floating-point noise.
const units = (usd: number) => Math.round(usd * 1e8);

/**
 * Which alert levels have been reached. A single big call can jump straight past
 * 100%, so this returns every level crossed; the DB's unique key dedupes later.
 */
export function levelsCrossed(spendUsd: number, budgetUsd: number, warnAt: number, breachAt: number): BudgetLevel[] {
  const out: BudgetLevel[] = [];
  if (units(spendUsd) >= units(budgetUsd * warnAt)) out.push("warning");
  if (units(spendUsd) >= units(budgetUsd * breachAt)) out.push("breached");
  return out;
}

/** True once spend has reached the cap. Used for the global and the widget caps. */
export const isCapReached = (spentUsd: number, capUsd: number) => units(spentUsd) >= units(capUsd);
