// Shared by the eval runner, the API and the /evals page. No server-only imports.

/** The per-question result, in the shape stored in eval_results. */
export interface ItemResult {
  questionId: string;
  question: string;
  answer: string;
  expectedDocIds: string[];
  retrievedDocIds: string[];
  shouldRefuse: boolean;
  refused: boolean;
  hit: boolean | null; // null for questions that should be refused (no expected document)
  cited: boolean | null; // null for questions that should be refused
  groundedness: number | null; // 1-5; null when not judged (refusals, judge failure)
  judgeReason: string | null;
  misses: string[]; // must_mention groups the answer did not satisfy (shown as "a / b")
  ttftMs: number | null;
  latencyMs: number;
  costUsd: number; // the whole question, plus its judge call
  requestId: string;
}

export interface RunSummary {
  questions: number;
  inScope: number;
  outOfScope: number;
  retrievalHitRate: number | null;
  citationRate: number | null;
  groundednessAvg: number | null;
  refusalAccuracy: number | null; // share of should-refuse questions that were refused
  falseRefusals: number; // in-scope questions the assistant refused
  mentionMisses: number; // in-scope answers missing a must_mention phrase
  judgeFailures: number;
  p50TtftMs: number | null;
  p50LatencyMs: number | null;
  totalCostUsd: number;
  answeredCostUsd: number | null; // mean cost of answered (not refused) in-scope questions, judge call excluded
}

export interface TargetResult {
  key: string;
  label: string;
  target: string; // human text, e.g. ">= 85%"
  value: string; // formatted result, or "n/a"
  pass: boolean | null; // null = not measurable in this run
}

export interface RunRow {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  questions: number;
  retrievalHitRate: number | null;
  citationRate: number | null;
  groundednessAvg: number | null;
  refusalAccuracy: number | null;
  p50LatencyMs: number | null;
  p50TtftMs: number | null;
  totalCostUsd: number | null;
  answeredCostUsd: number | null;
  notes: string | null;
}

export interface ResultRow extends ItemResult { id: number }
