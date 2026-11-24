import { readPdfPageWords } from "@/lib/raamstudio/pdf-page-words";

const LABEL = /voorgevel|achtergevel|rechtergevel|linkergevel|façade|facade|snede|coupe|doorsnede|gelijkvloers|rez-de-chaussée|verdieping|étage|kelder|sous-sol/i;

/** Words already written in the PDF. This does not detect windows and does not invent sizes. */
export async function readPlanLayer(bytes: Buffer, page: number): Promise<{ figures: string[]; labels: string[] }> {
  const sheets = await readPdfPageWords(bytes, [page]);
  const sheet = sheets.get(page);
  if (!sheet) return { figures: [], labels: [] };
  const figures = [...new Set(sheet.words.map((word) => word.text).filter((text) => /^\d{2,5}$/.test(text)))].slice(0, 40);
  const labels = [...new Set(sheet.words.map((word) => word.text).filter((text) => LABEL.test(text)))].slice(0, 20);
  return { figures, labels };
}
