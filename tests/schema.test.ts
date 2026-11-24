import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const schema = read("supabase/schema.sql");
const migrations = fs.readdirSync(path.join(process.cwd(), "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
const functionNames = (sql: string) => [...sql.matchAll(/create or replace function\s+(\w+)/gi)].map((m) => m[1]);
const dollarQuotes = (sql: string) => (sql.match(/\$\$/g) ?? []).length;

// A function body is wrapped in $$ ... $$. A past bug turned both into a single $ (a JavaScript
// string-replace treats "$$" as an escape), which made the whole schema fail in Supabase.
describe("supabase/schema.sql", () => {
  it("never uses a lone $ to open or close a function body", () => {
    expect(schema).not.toMatch(/\bas \$\s*$/m);
    expect(schema).not.toMatch(/^\$;\s*$/m);
  });

  it("has balanced $$ quoting: every function body opens and closes", () => {
    expect(dollarQuotes(schema) % 2).toBe(0);
    expect(dollarQuotes(schema)).toBe(functionNames(schema).length * 2 - (schema.match(/create or replace function[^;]*\bas '/gi)?.length ?? 0) * 2);
  });

  it("contains every function the migrations define, so a fresh install has them all", () => {
    const inSchema = new Set(functionNames(schema));
    for (const f of migrations) {
      for (const name of functionNames(read(`supabase/migrations/${f}`))) expect(inSchema.has(name), `${name} (from ${f}) missing from schema.sql`).toBe(true);
    }
  });

  it("uses the same $$ quoting as each migration it mirrors", () => {
    for (const f of migrations) {
      const sql = read(`supabase/migrations/${f}`);
      expect(dollarQuotes(sql) % 2, f).toBe(0);
      expect(sql, f).not.toMatch(/\bas \$\s*$/m);
    }
  });

  it("lets only the server key (service_role) use the tables, never the public roles", () => {
    for (const sql of [schema, read("supabase/migrations/005_grants.sql")]) {
      expect(sql).toMatch(/grant all on all tables in schema public to service_role/);
      expect(sql).not.toMatch(/\bto\s+(anon|authenticated|public)\b/i);
    }
    expect(schema).toMatch(/alter table documents\s+enable row level security/); // RLS stays on
  });

  it("combined ALL_MIGRATIONS.sql matches the individual migrations", () => {
    const all = read("supabase/ALL_MIGRATIONS.sql");
    expect(dollarQuotes(all)).toBe(migrations.reduce((n, f) => n + dollarQuotes(read(`supabase/migrations/${f}`)), 0));
    for (const f of migrations) for (const name of functionNames(read(`supabase/migrations/${f}`))) expect(all).toContain(name);
  });
});
