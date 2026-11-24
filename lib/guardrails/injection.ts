// A cheap first line of defence against obvious prompt-injection and prompt-
// extraction attempts. It is NOT the only defence: the system prompt also treats
// everything as data, and the similarity threshold refuses off-topic questions.
// Catching the obvious ones here costs nothing, because no model is called.
const PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|your|all|these)\b.{0,40}\b(instructions?|rules?|prompts?|guidelines?)\b/i,
  /\b(reveal|print|show|repeat|output|display|leak|tell me)\b.{0,40}\b(system|hidden|initial|original)\b.{0,20}\b(prompt|instructions?|message)\b/i,
  /\b(your|the)\s+(full\s+)?system\s+prompt\b/i,
  /\byou\s+are\s+now\b.{0,60}\b(unrestricted|jailbroken|dan|developer mode|no rules)\b/i,
  /\b(developer|debug|god)\s+mode\b/i,
  /\bpretend\b.{0,30}\b(no|without)\s+(rules|restrictions|guidelines)\b/i,
];

export function looksLikeInjection(text: string): boolean {
  return PATTERNS.some((re) => re.test(text));
}
