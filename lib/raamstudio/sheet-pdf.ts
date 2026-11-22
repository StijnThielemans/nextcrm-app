/**
 * A PDF made of JPEG pages. The pictures are the numbered ground plans
 * and the numbered facades, in that order. Measures and onderaansluitingen
 * are only the ones already drawn on those pictures.
 */

export type SheetJpeg = {
  jpeg: Uint8Array;
  width: number;
  height: number;
};

const PAGE_W = 842;
const PAGE_H = 595;
const MARGIN = 28;

function fmt(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

/**
 * Pages for the on-screen preview and the PDF.
 * Numbered ground plans stay first, numbered facades after them.
 * A set that is not in the project is left out. The other set is kept.
 */
export function sheetsForPreview(ground: readonly SheetJpeg[], facades: readonly SheetJpeg[]): SheetJpeg[] {
  const pages = [...ground, ...facades];
  if (!pages.length) throw new Error("Geen plan om te tonen.");
  return pages;
}

/** One landscape A4 page per picture, fitted inside the page. */
export function pdfFromJpegs(pages: readonly SheetJpeg[]): Uint8Array {
  if (!pages.length) throw new Error("Geen plan om te tonen.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  const offsets = [0];
  const encoder = new TextEncoder();

  function push(data: Uint8Array) {
    chunks.push(data);
    length += data.length;
  }
  function text(value: string) {
    push(encoder.encode(value));
  }
  function startObject() {
    const id = offsets.length;
    offsets.push(length);
    text(`${id} 0 obj\n`);
    return id;
  }
  function endObject() {
    text("endobj\n");
  }

  text("%PDF-1.4\n");
  const pageIds = pages.map((_, index) => 3 + index * 3);
  startObject();
  text("<< /Type /Catalog /Pages 2 0 R >>\n");
  endObject();
  startObject();
  text(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>\n`);
  endObject();

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    if (offsets.length !== pageId) throw new Error("pdf");
    const fit = Math.min((PAGE_W - MARGIN * 2) / page.width, (PAGE_H - MARGIN * 2) / page.height);
    const drawW = page.width * fit;
    const drawH = page.height * fit;
    const x = (PAGE_W - drawW) / 2;
    const y = (PAGE_H - drawH) / 2;
    const content = `q ${fmt(drawW)} 0 0 ${fmt(drawH)} ${fmt(x)} ${fmt(y)} cm /Im0 Do Q`;
    startObject();
    text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /XObject << /Im0 ${imageId} 0 R >> >> >>\n`);
    endObject();
    startObject();
    text(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream\n`);
    endObject();
    startObject();
    text(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
    push(page.jpeg);
    text("\nendstream\n");
    endObject();
  });

  const xrefAt = length;
  text(`xref\n0 ${offsets.length}\n`);
  text("0000000000 65535 f \n");
  for (let index = 1; index < offsets.length; index += 1) {
    text(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  text(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}
