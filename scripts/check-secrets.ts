import "./_env";
import fs from "node:fs";
import path from "node:path";
import { findSecrets, riskyPublicVars, SECRET_ENV_NAMES } from "@/lib/secret-scan";

// Usage: npm run build && npm run check:bundle
// Scans everything the browser can download (.next/static) for API keys and for the
// real secret values in your environment. Exit code 1 if anything is found.
function* files(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else yield p;
  }
}

const root = path.join(process.cwd(), ".next", "static");
if (!fs.existsSync(root)) {
  console.error("No .next/static folder. Run `npm run build` first.");
  process.exit(1);
}

const secrets = SECRET_ENV_NAMES.flatMap((name) => (process.env[name] ? [{ name, value: process.env[name]! }] : []));
console.log(`Checking client files against ${secrets.length} secret value(s) from the environment and known key patterns...`);

let scanned = 0;
const problems: string[] = [];
for (const file of files(root)) {
  if (!/\.(js|css|html|json|map|txt)$/.test(file)) continue;
  scanned++;
  for (const f of findSecrets(fs.readFileSync(file, "utf8"), secrets)) problems.push(`${path.relative(process.cwd(), file)}: ${f.detail}`);
}

const example = fs.existsSync(".env.example") ? fs.readFileSync(".env.example", "utf8") : "";
const names = [...example.matchAll(/^\s*#?\s*([A-Z0-9_]+)=/gm)].map((m) => m[1]);
for (const n of riskyPublicVars(names)) problems.push(`.env.example: ${n} is NEXT_PUBLIC_ (shipped to browsers) but looks like a secret`);

console.log(`Scanned ${scanned} client file(s).`);
if (!secrets.length) console.warn("Warning: no secret env values were loaded, so only key patterns were checked. Load .env.local to check real values.");
if (problems.length) {
  console.error(`\nFAIL: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("PASS: no secrets found in the client bundle.");
