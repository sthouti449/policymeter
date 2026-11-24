/** Build a tiny valid text PDF, one string array per page, so tests need no downloaded files. */
export function makePdf(pages: string[][]): Buffer {
  const objs: string[] = [];
  const add = (body: string) => objs.push(body) && objs.length; // returns the new object number
  const pageIds: number[] = [];
  add("<< /Type /Catalog /Pages 2 0 R >>"); // 1
  add(""); // 2 = Pages, filled in below
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"); // 3

  for (const lines of pages) {
    const text = lines.map((l, i) => `BT /F1 11 Tf 50 ${750 - i * 16} Td (${l.replace(/[()\\]/g, "")}) Tj ET`).join("\n");
    const content = add(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    pageIds.push(
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R >> >> >>`),
    );
  }
  objs[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
