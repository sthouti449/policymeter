/**
 * A model call that returns no visible text is a failure, never an answer.
 *
 * It happens when a model spends its whole token budget on hidden "thinking" and runs out before writing
 * anything (the call still "succeeds" and is billed for every token). Without this check the user would see
 * a blank answer and the call would be logged as ok. With it, the adapter records an error and the caller
 * shows its normal "something went wrong" message instead.
 */
export class EmptyResponseError extends Error {
  readonly code = "empty_response";
  constructor(outputTokens: number, maxTokens: number) {
    super(`The model returned no text (${outputTokens} output tokens used of ${maxTokens}). It probably spent its whole budget on hidden reasoning.`);
    this.name = "EmptyResponseError";
  }
}

export function assertNonEmpty(text: string, outputTokens: number, maxTokens: number): void {
  if (!text.trim()) throw new EmptyResponseError(outputTokens, maxTokens);
}
