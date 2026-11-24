import { defineConfig } from "vitest/config";
import path from "node:path";

// "server-only" throws when imported outside Next's server bundle, so tests
// swap it for an empty module. Everything else resolves like the app does.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
