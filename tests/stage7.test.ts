import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { assertProductionSecrets, ConfigError, envSchema } from "@/lib/env";
import { isSameOrigin } from "@/lib/guardrails/origin";
import { findSecrets, riskyPublicVars } from "@/lib/secret-scan";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

const req = (headers: Record<string, string>) => ({ headers: new Headers(headers) });

describe("security headers", () => {
  const names = (prod: boolean) => Object.fromEntries(securityHeaders(prod).map((h) => [h.key, h.value]));

  it("always sends the basic hardening headers", () => {
    const h = names(false);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toMatch(/camera=\(\)/);
  });

  it("adds the CSP and HSTS only for production builds (dev needs eval)", () => {
    expect(names(false)["Content-Security-Policy"]).toBeUndefined();
    expect(names(true)["Content-Security-Policy"]).toBeDefined();
    expect(names(true)["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
  });

  it("allows only this site for scripts, API calls, framing and forms", () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'"); // the browser never talks to Supabase or a model provider
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toMatch(/https?:\/\//); // no third-party origins at all
    expect(csp).not.toContain("unsafe-eval");
  });
});

describe("isSameOrigin", () => {
  it("allows requests with no Origin (curl, smoke test)", () => expect(isSameOrigin(req({ host: "app.example.com" }))).toBe(true));
  it("allows a matching Origin, including behind a proxy's forwarded host", () => {
    expect(isSameOrigin(req({ origin: "https://app.example.com", host: "app.example.com" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://app.example.com", host: "internal:3000", "x-forwarded-host": "app.example.com" }))).toBe(true);
  });
  it("blocks another site, a look-alike host and a malformed Origin", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "app.example.com" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://app.example.com.evil.example", host: "app.example.com" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "not a url", host: "app.example.com" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://app.example.com" }))).toBe(false); // no host to compare with
  });
});

describe("findSecrets", () => {
  const secrets = [{ name: "ADMIN_TOKEN", value: "super-secret-token-123" }, { name: "SHORT", value: "abc" }];

  it("finds real key shapes", () => {
    expect(findSecrets(`const k="sk-ant-api03-${"a".repeat(40)}"`, [])[0].detail).toMatch(/Anthropic/);
    expect(findSecrets(`x="sk-proj-${"B".repeat(40)}"`, []).length).toBeGreaterThan(0);
    const jwt = `eyJ${"a".repeat(20)}.eyJ${"b".repeat(20)}.${"c".repeat(20)}`;
    expect(findSecrets(`token:"${jwt}"`, [])[0].detail).toMatch(/Supabase/);
  });
  it("finds the actual secret value from the environment", () => {
    expect(findSecrets("...super-secret-token-123...", secrets)[0]).toMatchObject({ kind: "secret value" });
  });
  it("ignores very short values and clean code", () => {
    expect(findSecrets("function abc() { return 'abc' }", secrets)).toEqual([]);
    expect(findSecrets("const el = document.querySelector('#root'); // sk- is a prefix", [])).toEqual([]);
  });
});

describe("riskyPublicVars", () => {
  it("flags NEXT_PUBLIC_ names that look like secrets", () => {
    expect(riskyPublicVars(["NEXT_PUBLIC_API_KEY", "NEXT_PUBLIC_SERVICE_ROLE", "ANTHROPIC_API_KEY", "NEXT_PUBLIC_SITE_NAME"])).toEqual(["NEXT_PUBLIC_API_KEY", "NEXT_PUBLIC_SERVICE_ROLE"]);
  });
  it("passes the project's real .env.example", () => {
    const text = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    const names = [...text.matchAll(/^\s*#?\s*([A-Z0-9_]+)=/gm)].map((m) => m[1]);
    expect(names).toContain("NEXT_PUBLIC_SITE_NAME");
    expect(riskyPublicVars(names)).toEqual([]);
  });
});

describe("production secret check", () => {
  const env = (salt?: string) => envSchema.parse(salt === undefined ? {} : { IP_HASH_SALT: salt });
  it("rejects the default or a short salt in production", () => {
    expect(() => assertProductionSecrets(env(), "production")).toThrow(ConfigError);
    expect(() => assertProductionSecrets(env("short"), "production")).toThrow(/IP_HASH_SALT/);
    expect(() => assertProductionSecrets(env("change-me-to-a-random-string"), "production")).toThrow(ConfigError);
  });
  it("accepts a real salt, and does not apply in development", () => {
    expect(() => assertProductionSecrets(env("a-long-random-string-1234"), "production")).not.toThrow();
    expect(() => assertProductionSecrets(env(), "development")).not.toThrow();
  });
});

describe("what ships", () => {
  const exists = (p: string) => fs.existsSync(path.join(process.cwd(), p));
  it("has none of the temporary dev routes", () => {
    for (const p of ["app/dev", "app/api/dev", "lib/dev"]) expect(exists(p), `${p} should be gone`).toBe(false);
  });
  it("has an error boundary, a 404 page and a loading state", () => {
    for (const p of ["app/error.tsx", "app/not-found.tsx", "app/loading.tsx"]) expect(exists(p), p).toBe(true);
  });
  it("keeps every state-changing and expensive route behind the same-origin check, and caps maxDuration", () => {
    for (const r of ["chat", "ask-demo", "feedback", "evals/run"]) {
      expect(fs.readFileSync(path.join(process.cwd(), "app/api", r, "route.ts"), "utf8"), r).toContain("isSameOrigin");
    }
    for (const r of ["chat", "evals/run"]) expect(fs.readFileSync(path.join(process.cwd(), "app/api", r, "route.ts"), "utf8"), r).toMatch(/maxDuration = 60/);
  });
  it("puts the read rate limit on every dashboard endpoint", () => {
    for (const r of ["metrics", "calls", "trace/[requestId]"]) expect(fs.readFileSync(path.join(process.cwd(), "app/api", r, "route.ts"), "utf8"), r).toContain("readGuard");
  });
  it("never imports a model SDK or the service-role client from a client component", () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const clientFiles = [...walk("components"), ...walk("app")].filter((f) => /\.tsx?$/.test(f) && fs.readFileSync(f, "utf8").trimStart().startsWith('"use client"'));
    expect(clientFiles.length).toBeGreaterThan(5);
    for (const f of clientFiles) {
      expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/from "(openai|@anthropic-ai\/sdk|@supabase\/supabase-js)"|lib\/db\/supabase|lib\/llm"/);
    }
  });
});
