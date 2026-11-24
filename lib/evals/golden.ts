import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const itemSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  expected_doc_ids: z.array(z.string()),
  must_mention: z.array(z.array(z.string().min(1))),
  should_refuse: z.boolean(),
});
const schema = z.object({ version: z.number(), items: z.array(itemSchema).min(1) });
export type GoldenItem = z.infer<typeof itemSchema>;

export function loadGoldenSet(): GoldenItem[] {
  const file = path.join(process.cwd(), "evals", "golden-set.json");
  const parsed = schema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.success) throw new Error(`evals/golden-set.json is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  const ids = parsed.data.items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) throw new Error("evals/golden-set.json has duplicate question ids");
  return parsed.data.items;
}
