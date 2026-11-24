import type { CallRow } from "./types";

/**
 * One CSV cell. Quotes values containing commas, quotes or newlines. Values that
 * start with = + - @ are prefixed with ' so Excel never runs them as formulas
 * (CSV injection). Plain numbers pass through unchanged so they stay numeric.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS: [header: string, pick: (r: CallRow) => string | number | boolean | null][] = [
  ["date_utc", (r) => r.createdAt],
  ["agency", (r) => r.agency],
  ["use_case", (r) => r.useCase],
  ["model", (r) => r.model],
  ["operation", (r) => r.operation],
  ["input_tokens", (r) => r.inputTokens],
  ["cached_input_tokens", (r) => r.cachedInputTokens],
  ["output_tokens", (r) => r.outputTokens],
  ["cost_usd", (r) => r.costUsd.toFixed(8)],
  ["status", (r) => r.status],
  ["simulated", (r) => r.simulated],
  ["request_id", (r) => r.requestId],
];

/** Chargeback-ready CSV. Starts with a BOM so Excel opens it as UTF-8. No question text is exported. */
export function callsToCsv(rows: CallRow[]): string {
  const lines = [COLUMNS.map(([h]) => h).join(",")];
  for (const r of rows) lines.push(COLUMNS.map(([, pick]) => csvCell(pick(r))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
