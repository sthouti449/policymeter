import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const docSchema = z.object({
  doc_id: z.string(),
  file: z.string(),
  title: z.string(),
  issuer: z.string().nullable().optional(),
  published: z.string().nullable().optional(),
  status: z.enum(["current", "rescinded", "historical"]),
  replaced_by: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  optional: z.boolean().optional(),
});
const manifestSchema = z.object({ corpus: z.literal("policy"), documents: z.array(docSchema) });

export type ManifestDoc = z.infer<typeof docSchema>;
export const SOURCES_DIR = path.join(process.cwd(), "data", "sources");

export function loadManifest(): ManifestDoc[] {
  const file = path.join(process.cwd(), "config", "sources.manifest.json");
  const parsed = manifestSchema.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!parsed.success) {
    throw new Error(`config/sources.manifest.json is invalid: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  return parsed.data.documents;
}

export const sourcePath = (doc: ManifestDoc) => path.join(SOURCES_DIR, doc.file);
