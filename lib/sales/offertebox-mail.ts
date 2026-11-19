import { simpleParser, type Attachment, type ParsedMail } from "mailparser";
import { isDocumentKey } from "@/lib/documents/file-key";
import { SalesError } from "./errors";

export const MAX_MAIL_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 20;
export const MAX_BODY_CHARS = 100_000;
const STORAGE_PREFIX = "documents/offertebox/";

export type ParsedOfferteboxAttachment = {
  fileName: string;
  contentType: string;
  isImage: boolean;
  bytes: Buffer;
};

export type ParsedOfferteboxMail = {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: Date;
  attachments: ParsedOfferteboxAttachment[];
};

/** Key we generate ourselves. Never built from the uploaded filename. */
export function offerteboxStorageKey(id: string): string {
  const key = `${STORAGE_PREFIX}${id}`;
  if (!isDocumentKey(key) || key.includes("..") || !key.startsWith(STORAGE_PREFIX)) {
    throw new SalesError("mailInvalid");
  }
  return key;
}

export function isOfferteboxStorageKey(key: string): boolean {
  return isDocumentKey(key) && key.startsWith(STORAGE_PREFIX) && !key.includes("..");
}

/** Last path segment only, so a mail cannot smuggle a path into the stored name. */
export function safeFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").replace(/^\.+/, "").slice(0, 180).trim();
  return cleaned || "bijlage";
}

export function attachmentDisposition(fileName: string, inline: boolean): string {
  const safe = safeFileName(fileName);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(safe).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Raster images only. SVG and HTML are never treated as a preview. */
export function imageContentType(bytes: Buffer): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6) {
    const head = bytes.subarray(0, 6).toString("ascii");
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function readableMailBody(text: string | null | undefined, html: string | null | undefined): string {
  const plain = (text ?? "").replace(/\u0000/g, "").trim();
  const body = plain || htmlToText(html ?? "");
  return body.slice(0, MAX_BODY_CHARS);
}

export async function parseOfferteboxMail(fileName: string, bytes: Buffer): Promise<ParsedOfferteboxMail> {
  if (bytes.length === 0) throw new SalesError("mailInvalid");
  if (bytes.length > MAX_MAIL_BYTES) throw new SalesError("mailTooLarge");
  if (!acceptedMailFile(fileName, bytes)) throw new SalesError("mailInvalid");

  let mail: ParsedMail;
  try {
    mail = await simpleParser(unwrapEmlx(fileName, bytes));
  } catch {
    throw new SalesError("mailInvalid");
  }

  const from = mail.from?.value?.[0];
  const fromName = cleanHeader(from?.name ?? "", 200);
  const fromEmail = cleanHeader(from?.address ?? "", 320);
  const subject = cleanHeader(mail.subject ?? "", 500).replace(/\s+/g, " ").trim();
  const html = typeof mail.html === "string" ? mail.html : "";
  const body = readableMailBody(mail.text, html);
  const attachments = collectAttachments(mail.attachments ?? []);
  if (!fromName && !fromEmail && !subject && !body && attachments.length === 0) {
    throw new SalesError("mailInvalid");
  }

  return {
    fromName,
    fromEmail,
    subject: subject || "(geen onderwerp)",
    body,
    receivedAt: receivedAt(mail.date),
    attachments,
  };
}

function acceptedMailFile(fileName: string, bytes: Buffer): boolean {
  const name = safeFileName(fileName).toLowerCase();
  if (name.endsWith(".eml") || name.endsWith(".emlx") || name.endsWith(".mime")) return true;
  if (bytes.length >= 4) {
    const sig = bytes.subarray(0, 4).toString("latin1");
    if (sig === "%PDF" || sig.startsWith("\x89PNG") || sig.startsWith("PK")) return false;
  }
  const head = bytes.subarray(0, Math.min(bytes.length, 8192)).toString("latin1");
  if (head.includes("\u0000")) return false;
  return /^(from |return-path:|received:|mime-version:|from:|subject:|date:|delivered-to:|to:)/im.test(head);
}

/** Apple Mail stores a byte count on the first line of an .emlx file, then the RFC 822 message. */
function unwrapEmlx(fileName: string, bytes: Buffer): Buffer {
  if (!safeFileName(fileName).toLowerCase().endsWith(".emlx")) return bytes;
  const newline = bytes.indexOf(0x0a);
  if (newline <= 0 || newline > 20) return bytes;
  const first = bytes.subarray(0, newline).toString("ascii").trim();
  return /^\d+$/.test(first) ? bytes.subarray(newline + 1) : bytes;
}

function collectAttachments(list: Attachment[]): ParsedOfferteboxAttachment[] {
  const chosen = list.filter(isListedAttachment);
  if (chosen.length > MAX_ATTACHMENTS) throw new SalesError("mailTooLarge");
  let total = 0;
  return chosen.map((attachment, index) => {
    const bytes = attachment.content;
    if (bytes.length > MAX_ATTACHMENT_BYTES) throw new SalesError("mailTooLarge");
    total += bytes.length;
    if (total > MAX_MAIL_BYTES) throw new SalesError("mailTooLarge");
    const image = imageContentType(bytes);
    return {
      fileName: attachment.filename ? safeFileName(attachment.filename) : `bijlage-${index + 1}`,
      contentType: image ?? sanitizeContentType(attachment.contentType),
      isImage: image !== null,
      bytes,
    };
  });
}

function isListedAttachment(attachment: Attachment): boolean {
  if (!Buffer.isBuffer(attachment.content) || attachment.content.length === 0) return false;
  const disposition = (attachment.contentDisposition || "").toLowerCase();
  if (attachment.related && disposition !== "attachment") return false;
  if (disposition === "inline" && !attachment.filename) return false;
  return true;
}

function sanitizeContentType(value: string | undefined): string {
  const mime = (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) ? mime : "application/octet-stream";
}

function cleanHeader(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

function receivedAt(date: Date | undefined): Date {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    const year = date.getUTCFullYear();
    if (year >= 1990 && year <= 2100) return date;
  }
  return new Date();
}

function htmlToText(html: string): string {
  if (!html) return "";
  const source = html.slice(0, MAX_BODY_CHARS * 2);
  const stripped = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d|li|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d{1,7});/g, (_, digits: string) => codePoint(Number(digits)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex: string) => codePoint(parseInt(hex, 16)));
}

function codePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  if (code < 32 && code !== 9 && code !== 10 && code !== 13) return "";
  return String.fromCodePoint(code);
}
