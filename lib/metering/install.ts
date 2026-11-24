import "server-only";
import { registerOnComplete } from "@/lib/llm/hook";
import { logCall } from "./logCall";

// Imported (for its side effect) by lib/llm/index.ts, so any code that can call a
// model is automatically metered. There is no way to get an unmetered call.
registerOnComplete(logCall);
