import MsgReader, { type FieldsData } from "@kenjiuno/msgreader";
import { simpleParser, type Attachment, type ParsedMail } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { isDocumentKey } from "@/lib/documents/file-key";
import { SalesError } from "./errors";

export const MAX_MAIL_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 20;
export const MAX_BODY_CHARS = 100_000;
export const MAX_HTML_CHARS = 400_000;
const STORAGE_PREFIX = "documents/offertebox/";
const ATTACHMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MailImageRef = {
  id: string;
  contentId: string | null;
  isImage: boolean;
};

export type ParsedOfferteboxAttachment = {
  fileName: string;
  contentType: string;
  isImage: boolean;
  /** Drawn inside the message, so the file is not repeated in the attachment list. */
  inline: boolean;
  /** Content-ID without brackets. Empty when the part has none. */
  contentId: string;
  bytes: Buffer;
};

export type ParsedOfferteboxMail = {
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  /** Sanitized HTML. cid: sources stay until the stored image id is known. */
  html: string;
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

/** A value may be a colour, a length, or an ordinary http(s)/cid image. No scripts. */
const SAFE_CSS_VALUE =
  /^(?:rgb\(\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?\s*\)|rgba\(\s*(?:\d{1,3}%?\s*,\s*){3}(?:0|1|0?\.\d+)\s*\)|url\(\s*['"]?(?:https?:\/\/|cid:)[^)'"\s]+['"]?\s*\)|[^;{}()])+$/i;

const MAIL_STYLE_PROPS = [
  "color",
  "background",
  "background-color",
  "background-image",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-align",
  "text-decoration",
  "line-height",
  "vertical-align",
  "white-space",
  "width",
  "height",
  "max-width",
  "min-width",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-color",
  "border-width",
  "border-style",
  "border-collapse",
  "border-spacing",
  "border-radius",
  "display",
] as const;

const MAIL_SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "div", "span", "br", "hr", "blockquote", "pre", "center", "font",
    "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "small",
    "ul", "ol", "li",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
    "a", "img",
  ],
  allowedAttributes: {
    "*": ["style", "align", "title"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height", "border"],
    font: ["color", "face", "size"],
    table: ["width", "height", "border", "cellpadding", "cellspacing", "bgcolor"],
    thead: ["bgcolor"],
    tbody: ["bgcolor"],
    tr: ["bgcolor"],
    td: ["width", "height", "colspan", "rowspan", "valign", "bgcolor", "background"],
    th: ["width", "height", "colspan", "rowspan", "valign", "bgcolor", "background"],
    col: ["width", "span"],
  },
  allowedSchemes: ["http", "https", "mailto", "cid"],
  allowedSchemesByTag: { img: ["http", "https", "cid"] },
  allowedSchemesAppliedToAttributes: ["href", "src", "cite", "background"],
  allowProtocolRelative: false,
  allowedStyles: {
    "*": Object.fromEntries(MAIL_STYLE_PROPS.map((prop) => [prop, [SAFE_CSS_VALUE]])),
  },
  transformTags: {
    a: (tagName, attribs) => {
      const next = { ...attribs };
      if (next.target === "_blank") next.rel = "noopener noreferrer";
      else delete next.target;
      return { tagName, attribs: next };
    },
  },
};

/** Outlook often hides the picture in VML. Turn that into a normal image before the sanitizer drops VML. */
function promoteEmbeddedImages(html: string): string {
  return html.replace(/<v:imagedata\b[^>]*\bsrc\s*=\s*(["'])(cid:[^"']+)\1[^>]*>/gi, '<img src="$2" alt="" />');
}

export function normalizeContentId(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .replace(/^cid:/i, "")
    .replace(/^</, "")
    .replace(/>$/, "")
    .trim()
    .slice(0, 500);
}

function htmlReferencesCid(html: string, contentId: string): boolean {
  if (!html || !contentId) return false;
  const haystack = html.toLowerCase();
  const needle = contentId.toLowerCase();
  if (haystack.includes(`cid:${needle}`)) return true;
  const encoded = encodeURIComponent(contentId).toLowerCase();
  return encoded !== needle && haystack.includes(`cid:${encoded}`);
}

function isInlineImage(bytes: Buffer, contentId: string, disposition: string, html: string): boolean {
  if (disposition === "attachment") return false;
  if (!contentId || imageContentType(bytes) === null) return false;
  return htmlReferencesCid(html, contentId);
}

const MAX_DATA_URL_CHARS = 500_000;

function rasterDataBytes(dataUrl: string): Buffer | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const bytes = Buffer.from(dataUrl.slice(comma + 1), "base64");
  return bytes.length > 0 ? bytes : null;
}

/**
 * A mailbox may already have stored the picture as a data URL. Keep only a real
 * raster image, and park it while the sanitizer runs so a data: URL cannot sneak
 * a script through.
 */
function parkRasterDataUrls(html: string): { html: string; parked: Array<{ token: string; url: string }> } {
  const parked: Array<{ token: string; url: string }> = [];
  const next = html.replace(
    /\bsrc\s*=\s*(["'])(data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\r\n]+)\1/gi,
    (match, quote: string, dataUrl: string) => {
      const compact = dataUrl.replace(/\s/g, "");
      if (compact.length > MAX_DATA_URL_CHARS) return match;
      const bytes = rasterDataBytes(compact);
      if (!bytes || imageContentType(bytes) === null) return match;
      const token = `cid:obxdata${parked.length}z`;
      parked.push({ token, url: compact });
      return `src=${quote}${token}${quote}`;
    },
  );
  return { html: next, parked };
}

/** Scripts, event handlers and javascript: URLs are removed. cid: and ordinary http(s) images stay. */
export function sanitizeMailHtml(html: string | null | undefined): string {
  const raw = promoteEmbeddedImages((html ?? "").replace(/\u0000/g, "")).slice(0, MAX_HTML_CHARS);
  if (!raw.trim()) return "";
  const parked = parkRasterDataUrls(raw);
  let clean = sanitizeHtml(parked.html, MAIL_SANITIZE).trim();
  for (const item of parked.parked) {
    clean = clean.replace(item.token, item.url);
  }
  return clean;
}

function unescapeAttr(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function cidLookupKey(value: string): string {
  const decoded = unescapeAttr(value);
  try {
    return normalizeContentId(decodeURIComponent(decoded)).toLowerCase();
  } catch {
    return normalizeContentId(decoded).toLowerCase();
  }
}

/** Point each cid: image at the stored file. An unknown cid is removed so the browser does not request the page itself. */
export function rewriteCidSources(html: string, images: MailImageRef[]): string {
  const byCid = new Map<string, string>();
  for (const image of images) {
    if (!image.isImage || !image.contentId || !ATTACHMENT_ID.test(image.id)) continue;
    byCid.set(normalizeContentId(image.contentId).toLowerCase(), `/api/crm/offertebox/attachments/${image.id}`);
  }
  const urlFor = (rawCid: string) => byCid.get(cidLookupKey(rawCid)) ?? "";
  const withAttrs = html.replace(
    /(\s(?:src|background)\s*=\s*)(["'])cid:([^"']*)\2/gi,
    (_match, prefix: string, quote: string, cid: string) => {
      const url = urlFor(cid);
      return url ? `${prefix}${quote}${url}${quote}` : "";
    },
  );
  return withAttrs.replace(
    /url\(\s*(['"]?)cid:([^)'"]*)\1\s*\)/gi,
    (_match, quote: string, cid: string) => {
      const url = urlFor(cid);
      return url ? `url(${quote}${url}${quote})` : "none";
    },
  );
}

export function displayMailHtml(html: string | null | undefined, images: MailImageRef[]): string {
  const clean = sanitizeMailHtml(html);
  if (!clean) return "";
  return rewriteCidSources(clean, images);
}

export function readableMailBody(text: string | null | undefined, html: string | null | undefined): string {
  const plain = (text ?? "").replace(/\u0000/g, "").trim();
  const body = plain || htmlToText(html ?? "");
  return body.slice(0, MAX_BODY_CHARS);
}

export async function parseOfferteboxMail(
  fileName: string,
  bytes: Buffer,
  contentType?: string,
): Promise<ParsedOfferteboxMail> {
  if (bytes.length === 0) throw new SalesError("mailInvalid");
  if (bytes.length > MAX_MAIL_BYTES) throw new SalesError("mailTooLarge");
  if (isOutlookMessage(fileName, bytes, contentType)) {
    try {
      return parseOutlookMessage(bytes);
    } catch (error) {
      const compound = bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
      if (compound || !(error instanceof SalesError)) throw error;
    }
  }
  if (!acceptedMailFile(fileName, bytes)) {
    const dropped = outlookTextDrop(fileName, bytes);
    if (dropped) return dropped;
    throw new SalesError("mailInvalid");
  }

  let mail: ParsedMail;
  try {
    mail = await simpleParser(unwrapEmlx(fileName, bytes), { skipImageLinks: true });
  } catch {
    throw new SalesError("mailInvalid");
  }

  const from = mail.from?.value?.[0];
  const fromName = cleanHeader(from?.name ?? "", 200);
  const fromEmail = cleanHeader(from?.address ?? "", 320);
  const subject = cleanHeader(mail.subject ?? "", 500).replace(/\s+/g, " ").trim();
  const rawHtml = typeof mail.html === "string" ? mail.html : "";
  const html = sanitizeMailHtml(rawHtml);
  const body = readableMailBody(mail.text, rawHtml);
  const attachments = collectAttachments(mail.attachments ?? [], html);
  if (!fromName && !fromEmail && !subject && !body && !html && attachments.length === 0) {
    throw new SalesError("mailInvalid");
  }

  return {
    fromName,
    fromEmail,
    subject: subject || "(geen onderwerp)",
    body,
    html,
    receivedAt: receivedAt(mail.date),
    attachments,
  };
}

/** Outlook drag-and-drop is a .msg compound file, often without a useful MIME type. */
function isOutlookMessage(fileName: string, bytes: Buffer, contentType?: string): boolean {
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true;
  const name = safeFileName(fileName).toLowerCase();
  if (name.endsWith(".msg")) return true;
  const mime = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return mime === "application/vnd.ms-outlook";
}

function parseOutlookMessage(bytes: Buffer): ParsedOfferteboxMail {
  let info: FieldsData;
  let reader: MsgReader;
  try {
    reader = new MsgReader(bytes);
    info = reader.getFileData();
  } catch {
    throw new SalesError("mailInvalid");
  }
  if (info.error || info.dataType === null) throw new SalesError("mailInvalid");

  const fromName = cleanHeader(info.senderName ?? "", 200);
  const fromEmail = outlookEmail(info);
  const subject = cleanHeader(info.subject ?? "", 500).replace(/\s+/g, " ").trim();
  const plain = (info.body ?? "").replace(/\u0000/g, "").replace(/\r\n/g, "\n");
  const rawHtml = outlookHtml(info);
  const html = sanitizeMailHtml(rawHtml);
  const body = readableMailBody(plain, rawHtml);
  const attachments = collectMsgAttachments(reader, info.attachments ?? [], html);
  if (!fromName && !fromEmail && !subject && !body && !html && attachments.length === 0) {
    throw new SalesError("mailInvalid");
  }

  return {
    fromName,
    fromEmail,
    subject: subject || "(geen onderwerp)",
    body,
    html,
    receivedAt: outlookDate(info.messageDeliveryTime || info.clientSubmitTime),
    attachments,
  };
}

function outlookEmail(info: FieldsData): string {
  const candidates = [info.senderSmtpAddress, info.sentRepresentingSmtpAddress, info.senderEmail];
  for (const candidate of candidates) {
    const cleaned = cleanHeader(candidate ?? "", 320);
    if (cleaned.includes("@")) return cleaned;
  }
  return cleanHeader(info.senderEmail ?? "", 320);
}

function outlookHtml(info: FieldsData): string {
  if (typeof info.bodyHtml === "string") return info.bodyHtml;
  const binary = info.html;
  if (binary instanceof Uint8Array) return Buffer.from(binary).toString("utf8");
  return "";
}

/** Outlook sometimes drops the message as HTML or plain text under a .msg name. */
function outlookTextDrop(fileName: string, bytes: Buffer): ParsedOfferteboxMail | null {
  const name = safeFileName(fileName).toLowerCase();
  if (!name.endsWith(".msg") && !name.endsWith(".html") && !name.endsWith(".htm")) return null;
  if (bytes.includes(0)) return null;
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (!/<\s*(html|body|div|p|table)\b/i.test(text.slice(0, 4000))) return null;
  const html = sanitizeMailHtml(text);
  const body = readableMailBody("", text);
  if (!body && !html) return null;
  const subject = cleanHeader(safeFileName(fileName).replace(/\.(msg|html?)$/i, ""), 500);
  return {
    fromName: "",
    fromEmail: "",
    subject: subject || "(geen onderwerp)",
    body,
    html,
    receivedAt: new Date(),
    attachments: [],
  };
}

function outlookDate(value: string | undefined): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return receivedAt(Number.isNaN(date.getTime()) ? undefined : date);
}

function collectMsgAttachments(reader: MsgReader, list: FieldsData[], html: string): ParsedOfferteboxAttachment[] {
  const chosen = list.filter((item) => typeof item.dataId === "number");
  let total = 0;
  const attachments: ParsedOfferteboxAttachment[] = [];
  chosen.forEach((item, index) => {
    let content: Uint8Array;
    try {
      content = reader.getAttachment(item).content;
    } catch {
      return;
    }
    const raw = Buffer.from(content);
    const size = typeof item.contentLength === "number" ? Math.min(Math.max(item.contentLength, 0), raw.length) : raw.length;
    const bytes = raw.subarray(0, size);
    if (bytes.length === 0) return;
    const image = imageContentType(bytes);
    const contentId = normalizeContentId(item.pidContentId);
    if (item.attachmentHidden === true && image === null) return;
    if (bytes.length > MAX_ATTACHMENT_BYTES) throw new SalesError("mailTooLarge");
    total += bytes.length;
    if (total > MAX_MAIL_BYTES || attachments.length >= MAX_ATTACHMENTS) throw new SalesError("mailTooLarge");
    const name = item.fileName || item.fileNameShort || `bijlage-${index + 1}`;
    attachments.push({
      fileName: safeFileName(name),
      contentType: image ?? sanitizeContentType(item.attachMimeTag),
      isImage: image !== null,
      inline: isInlineImage(bytes, contentId, "", html),
      contentId,
      bytes,
    });
  });
  return attachments;
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

function collectAttachments(list: Attachment[], html: string): ParsedOfferteboxAttachment[] {
  const chosen = list.filter(isStoredPart);
  if (chosen.length > MAX_ATTACHMENTS) throw new SalesError("mailTooLarge");
  let total = 0;
  return chosen.map((attachment, index) => {
    const bytes = attachment.content;
    if (bytes.length > MAX_ATTACHMENT_BYTES) throw new SalesError("mailTooLarge");
    total += bytes.length;
    if (total > MAX_MAIL_BYTES) throw new SalesError("mailTooLarge");
    const image = imageContentType(bytes);
    const contentId = normalizeContentId(attachment.cid || attachment.contentId);
    const disposition = (attachment.contentDisposition || "").toLowerCase();
    return {
      fileName: attachment.filename ? safeFileName(attachment.filename) : `bijlage-${index + 1}`,
      contentType: image ?? sanitizeContentType(attachment.contentType),
      isImage: image !== null,
      inline: isInlineImage(bytes, contentId, disposition, html),
      contentId,
      bytes,
    };
  });
}

function isStoredPart(attachment: Attachment): boolean {
  if (!Buffer.isBuffer(attachment.content) || attachment.content.length === 0) return false;
  if (imageContentType(attachment.content) !== null) return true;
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
