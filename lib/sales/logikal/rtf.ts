const decoder = new TextDecoder("windows-1252");

/** Readable text from an RTF quote file. Control words are dropped. */
export function rtfToText(rtf: string): string {
  const decoded = rtf
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex: string) => decoder.decode(Uint8Array.of(Number.parseInt(hex, 16))))
    .replace(/\\u(-?\d+)\??/g, (_, raw: string) => {
      const code = Number(raw);
      const point = code < 0 ? code + 65536 : code;
      return Number.isFinite(point) ? String.fromCodePoint(point) : "";
    });
  const withBreaks = decoded.replace(/\\par[d]? ?/g, "\n").replace(/\\line ?/g, "\n").replace(/\\tab ?/g, "\t");
  const stripped = withBreaks.replace(/\\[a-zA-Z]+-?\d* ?/g, "").replace(/[{}]/g, "");
  return stripped.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
