import "server-only";
import { PDFParse } from "pdf-parse";

/**
 * Text of each page, in order (index 0 = page 1). Page numbers matter because
 * every citation shows one. Scanned PDFs return little or no text; the ingest
 * script warns about those instead of trying OCR.
 */
export async function extractPages(data: Buffer): Promise<string[]> {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    const result = await parser.getText();
    const pages: string[] = Array.from({ length: result.total }, () => "");
    for (const p of result.pages) pages[p.num - 1] = p.text;
    return pages;
  } finally {
    await parser.destroy();
  }
}
