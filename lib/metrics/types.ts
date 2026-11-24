// Shapes shared by the API routes and the dashboard. No server-only imports.

export interface Filters {
  from: string; // YYYY-MM-DD, inclusive (UTC)
  to: string; // YYYY-MM-DD, inclusive (UTC)
  agency?: string;
  useCase?: string;
  model?: string;
  includeSimulated: boolean;
}

export interface Kpis {
  spendUsd: number;
  calls: number;
  answeredQuestions: number;
  costPerAnsweredQuestion: number | null;
  avgAnswerLatencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
}

export interface GroupRow { key: string; calls: number; costUsd: number; inputTokens: number; outputTokens: number }
export interface ModelRow extends GroupRow { operation: "chat" | "embed"; cachedInputTokens: number }
export interface DailyRow { day: string; agency: string; calls: number; costUsd: number }

export type BudgetStatus = "OK" | "Warning" | "Breached";
export interface BudgetRow {
  agency: string;
  budgetUsd: number;
  mtdSpendUsd: number;
  pct: number; // 0..n (1 = 100%)
  status: BudgetStatus;
  forecastMonthEndUsd: number;
}

export interface AlertRow {
  id: number;
  createdAt: string;
  agency: string;
  period: string;
  level: "warning" | "breached" | "daily_cap";
  spendUsd: number;
  budgetUsd: number;
  message: string;
  simulated: boolean;
}

/** Chat model prices, for the what-if card. USD per 1M tokens. */
export interface PriceInfo { key: string; label: string; input: number; cachedInput: number; output: number }

export interface MetricsPayload {
  filters: Filters;
  kpis: Kpis;
  hasSimulated: boolean;
  byAgency: GroupRow[];
  byUseCase: GroupRow[];
  byModel: ModelRow[];
  daily: DailyRow[];
  budgets: BudgetRow[];
  alerts: AlertRow[];
  zeroPricedModels: string[];
  chatModels: PriceInfo[];
  modelLabels: Record<string, string>;
}

export interface CallRow {
  id: number;
  requestId: string;
  createdAt: string;
  agency: string;
  useCase: string;
  model: string;
  operation: "chat" | "embed";
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number | null;
  ttftMs: number | null;
  status: string;
  simulated: boolean;
  feedback: number | null;
}

export interface TraceChunk {
  chunkId: number; docId: string; title: string; page: number | null; status: string; similarity: number; usedInPrompt: boolean;
}
export interface TracePayload { requestId: string; calls: CallRow[]; totalCostUsd: number; retrieval: TraceChunk[] }
