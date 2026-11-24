/**
 * An agency's colour follows the agency, never its rank: slot = its position in
 * agencies.json. A filter that hides agencies must not repaint the others.
 * Slots 1-7 exist (CSS variables --viz-series-N); a configured 8th+ would fold to muted grey.
 */
export function agencyColor(code: string, agencies: string[]): string {
  const i = agencies.indexOf(code);
  return i >= 0 && i < 7 ? `var(--viz-series-${i + 1})` : "var(--viz-muted)";
}
