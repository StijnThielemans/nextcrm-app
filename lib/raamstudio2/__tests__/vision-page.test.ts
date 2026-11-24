import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const python = path.join(process.cwd(), "services/raamstudio-vision/.venv/bin/python");
const script = path.join(process.cwd(), "services/raamstudio-vision/analyze.py");
const hasVision = fs.existsSync(python) && fs.existsSync(script);

function rectanglePdf(): Buffer {
  const stream = Buffer.from("100 600 36 18 re S\n", "latin1");
  const objects = [
    Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    Buffer.from("2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n"),
    Buffer.from("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 4 0 R >>\nendobj\n"),
    Buffer.concat([Buffer.from(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream\nendobj\n")]),
  ];
  const out = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  let cursor = out[0].length;
  for (const object of objects) {
    offsets.push(cursor);
    out.push(object);
    cursor += object.length;
  }
  const body = Buffer.concat(out);
  const rows = ["0000000000 65535 f "];
  for (const offset of offsets.slice(1)) rows.push(`${String(offset).padStart(10, "0")} 00000 n `);
  const xref = `xref\n0 ${offsets.length}\n${rows.join("\n")}\ntrailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF\n`;
  return Buffer.concat([body, Buffer.from(xref)]);
}

(hasVision ? describe : describe.skip)("pdfplumber page analysis", () => {
  it("returns the drawn rectangle and no measurement", () => {
    const result = spawnSync(python, [script, "1"], { input: rectanglePdf() });
    expect(result.status).toBe(0);
    const page = JSON.parse(result.stdout.toString("utf8")) as { engines: string[]; openings: { source: string; w: number; widthMm: string | null; heightMm: string | null }[] };
    expect(page.engines).toContain("pdfplumber");
    expect(page.openings).toHaveLength(1);
    expect(page.openings[0]?.source).toBe("pdfplumber");
    expect(page.openings[0]?.w).toBeCloseTo(0.06, 2);
    expect(page.openings[0]?.widthMm).toBeNull();
    expect(page.openings[0]?.heightMm).toBeNull();
  });
});
