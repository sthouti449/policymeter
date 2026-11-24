// Privacy (CLAUDE.md rule 9): stored question text never contains emails, phone
// numbers or SSN-like numbers, and is at most 500 characters.
export const MAX_STORED_QUESTION_CHARS = 500;

// Order matters: SSNs first, so the phone pattern can't eat part of one.
const PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // 123-45-6789
  /\b\d{9}\b/g, // 123456789
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // emails
  /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g, // US phone numbers
];

export function redact(text: string): string {
  let out = text;
  for (const re of PATTERNS) out = out.replace(re, "[REDACTED]");
  return out;
}

/** Redact first, then truncate, so a cut can never expose half of a pattern. */
export function redactQuestion(text: string): string {
  return redact(text).slice(0, MAX_STORED_QUESTION_CHARS);
}
