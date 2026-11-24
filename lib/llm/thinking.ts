// How much hidden "thinking" Claude may do before it writes an answer. Thinking tokens are billed as output
// and count against max_tokens, so with a small cap (700 for answers) a model that thinks first can use the
// whole budget and never write a word. See empty.ts.
//
//   disabled  no thinking. Fastest and cheapest; right for the fast tier. (Claude Haiku 5.5 accepts it at
//             low and medium effort. Claude Sonnet 5.5 REJECTS it with a 400, so never use it there.)
//   adaptive  the model decides how much to think.
//   omit      send nothing and use the model's own default.
export type ThinkingMode = "disabled" | "adaptive" | "omit";

export function thinkingParam(mode: ThinkingMode): { thinking?: { type: "disabled" | "adaptive" } } {
  return mode === "omit" ? {} : { thinking: { type: mode } };
}
