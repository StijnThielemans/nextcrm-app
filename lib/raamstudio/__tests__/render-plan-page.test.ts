import { renderPlanClip, renderPlanPage } from "../render-plan-page";

function minimalPdf(width: number, height: number): Buffer {
  const stream = "BT /F1 18 Tf 40 80 Td (Scherp) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}

describe("renderPlanPage", () => {
  const pdf = minimalPdf(400, 200);

  it("rasters the page at the requested size instead of a small thumbnail", async () => {
    const small = await renderPlanPage(pdf, 1, 512);
    const large = await renderPlanPage(pdf, 1, 2048);

    expect(small.png.readUInt32BE(0)).toBe(0x89504e47);
    expect(Math.max(small.width, small.height)).toBeGreaterThanOrEqual(500);
    expect(Math.max(small.width, small.height)).toBeLessThanOrEqual(530);
    expect(Math.max(large.width, large.height)).toBeGreaterThan(1800);
    expect(large.width).toBeGreaterThan(large.height);
    expect(large.png.length).toBeGreaterThan(small.png.length);
  }, 20_000);

  it("draws a clip at the requested size instead of a slice of a small page", async () => {
    const clip = await renderPlanClip(pdf, 1, { x: 0, y: 0.15, w: 0.45, h: 0.7 }, 1024);
    expect(Math.max(clip.width, clip.height)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(clip.width, clip.height)).toBeLessThanOrEqual(1040);
    expect(Math.min(clip.width, clip.height)).toBeGreaterThan(400);
    expect(clip.png.readUInt32BE(0)).toBe(0x89504e47);
  }, 20_000);
});
