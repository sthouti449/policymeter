// Looks for secrets in text that is shipped to the browser. Pure, so it is unit-tested.

/** Key shapes that must never appear in client code, whatever their value. */
const KEY_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Anthropic API key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI API key", re: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: "Supabase service-role JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "Supabase secret key", re: /sb_secret_[A-Za-z0-9_-]{20,}/ },
];

/** Environment variables whose VALUES must never reach the browser. */
export const SECRET_ENV_NAMES = [
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "AZURE_OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_TOKEN", "IP_HASH_SALT", "ALERT_WEBHOOK_URL",
];

export interface Finding { kind: string; detail: string }

/**
 * text: the contents of one client file. secretValues: the real secret values from the
 * environment (only values of 8+ characters are checked, so "change-me" noise is ignored).
 */
export function findSecrets(text: string, secretValues: { name: string; value: string }[]): Finding[] {
  const out: Finding[] = [];
  for (const p of KEY_PATTERNS) if (p.re.test(text)) out.push({ kind: "key pattern", detail: p.name });
  for (const s of secretValues) {
    if (s.value.length >= 8 && text.includes(s.value)) out.push({ kind: "secret value", detail: `${s.name} appears in the client bundle` });
  }
  return out;
}

/** NEXT_PUBLIC_ variables are inlined into the browser bundle, so none may look like a secret. */
export function riskyPublicVars(names: string[]): string[] {
  return names.filter((n) => n.startsWith("NEXT_PUBLIC_") && /(KEY|SECRET|TOKEN|PASSWORD|SERVICE_ROLE)/i.test(n));
}
