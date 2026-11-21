/** What the aanvraag page may show without leaving the form. SVG stays a download. */
export function attachmentOpensInline(
  fileName: string,
  contentType: string,
  isImage: boolean,
): "image" | "pdf" | null {
  if (isImage) return "image";
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type.startsWith("image/") && type !== "image/svg+xml") return "image";
  if (type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) return "pdf";
  return null;
}

export function pdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

/** Image type comes from the magic-byte check. A PDF may be shown; anything else is a download. */
export function inlineAttachmentType(image: string | null, bytes: Uint8Array): string | null {
  if (image) return image;
  return pdfBytes(bytes) ? "application/pdf" : null;
}

/** HTML wins when it survived sanitizing. Plain text is the fallback, never a blank body. */
export function mailPanelBody(html: string, text: string): { kind: "html" | "text" | "empty"; value: string } {
  const rich = html.trim();
  if (rich) return { kind: "html", value: html };
  const plain = text.trim();
  if (plain) return { kind: "text", value: text };
  return { kind: "empty", value: "" };
}
