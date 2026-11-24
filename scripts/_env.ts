// Scripts run outside Next.js, so nothing loads .env.local for them. Import this
// file FIRST in every script: imports run in order, so the env is ready before any
// lib/ module reads it.
try {
  process.loadEnvFile(".env.local");
} catch {
  console.warn("No .env.local found; using the current environment only.");
}
