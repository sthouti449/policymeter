// Shared by the API route and the browser, so this file has no server-only imports.

export interface Source {
  n: number; // the [n] number used in the answer
  chunkId: number;
  docId: string;
  title: string;
  page: number | null;
  status: "current" | "rescinded" | "historical";
  replacedBy: string | null;
  url: string | null;
  content: string;
  similarity: number;
}

export interface CostInfo {
  inputTokens: number; // answer call
  outputTokens: number; // answer call
  costUsd: number; // WHOLE question: rewrite + embedding + answer, same as the llm_calls rows
  latencyMs: number; // time until the answer finished
  ttftMs: number | null;
  model: string; // human label, e.g. "Claude Haiku 5.5"
  provider: string;
}

export type RefusalReason = "injection" | "low_similarity" | "model";

export type ChatEvent =
  | { type: "delta"; text: string }
  | {
      type: "final";
      requestId: string;
      answer: string; // cleaned: invalid [n] markers removed
      refused: boolean;
      refusalReason?: RefusalReason;
      sources: Source[];
      citationsUsed: number[];
      rescindedCited: Source[];
      cost: CostInfo;
    }
  | { type: "error"; message: string };

export interface ChatTurn { role: "user" | "assistant"; content: string }
