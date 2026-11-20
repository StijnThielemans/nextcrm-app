// How a stored file should open on the user's computer. Pure helpers: no env,
// no database, safe to import from a client component.

export type FileLaunch = "pdf" | "word" | "excel" | "powerpoint" | "image" | "download";

const LAUNCHES = new Set<FileLaunch>(["pdf", "word", "excel", "powerpoint", "image", "download"]);

export function isFileLaunch(value: unknown): value is FileLaunch {
  return typeof value === "string" && LAUNCHES.has(value as FileLaunch);
}

const EXTENSION_LAUNCH: Record<string, FileLaunch> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  docm: "word",
  dot: "word",
  dotx: "word",
  xls: "excel",
  xlsx: "excel",
  xlsm: "excel",
  xlsb: "excel",
  ppt: "powerpoint",
  pptx: "powerpoint",
  pptm: "powerpoint",
  pps: "powerpoint",
  ppsx: "powerpoint",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
};

const MIME_LAUNCH: Record<string, FileLaunch> = {
  "application/pdf": "pdf",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/vnd.ms-word.document.macroenabled.12": "word",
  "application/vnd.ms-excel": "excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.ms-excel.sheet.macroenabled.12": "excel",
  "application/vnd.ms-powerpoint": "powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "powerpoint",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12": "powerpoint",
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  docm: "application/vnd.ms-word.document.macroEnabled.12",
  dot: "application/msword",
  dotx: "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xlsb: "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pptm: "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
  pps: "application/vnd.ms-powerpoint",
  ppsx: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
};

const DEFAULT_EXTENSION: Partial<Record<FileLaunch, string>> = {
  pdf: "pdf",
  word: "docx",
  excel: "xlsx",
  powerpoint: "pptx",
};

const OFFICE_SCHEME = {
  word: "ms-word",
  excel: "ms-excel",
  powerpoint: "ms-powerpoint",
} as const;

export function bareMime(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

function extensionOf(fileName: string): string {
  const base = fileName.split("/").pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

/** PDF, Office, and images open in a program. SVG and anything unknown download. */
export function fileLaunch(
  fileName: string,
  mime: string | null | undefined,
  isImage = false,
): FileLaunch {
  if (isImage && bareMime(mime) !== "image/svg+xml") return "image";
  const extension = extensionOf(fileName);
  const fromExtension = EXTENSION_LAUNCH[extension];
  if (fromExtension) return fromExtension;
  return MIME_LAUNCH[bareMime(mime)] ?? "download";
}

export function isOfficeLaunch(launch: FileLaunch): launch is "word" | "excel" | "powerpoint" {
  return launch === "word" || launch === "excel" || launch === "powerpoint";
}

/** One path segment. The extension is what Word, Excel, PowerPoint, and the OS look at. */
export function openFileSegment(fileName: string, launch: FileLaunch): string {
  const base = (fileName.replace(/\\/g, "/").split("/").pop() ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120) || "bestand";
  const extension = extensionOf(base);
  if (EXTENSION_LAUNCH[extension] === launch) return base;
  const fallback = DEFAULT_EXTENSION[launch];
  return fallback ? `${base}.${fallback}` : base;
}

export function officeMime(launch: "word" | "excel" | "powerpoint", fileName: string, mime: string | null | undefined): string {
  const fromExtension = MIME_BY_EXTENSION[extensionOf(fileName)];
  if (fromExtension && fileLaunch(fileName, fromExtension) === launch) return fromExtension;
  const stored = bareMime(mime);
  if (MIME_LAUNCH[stored] === launch) return stored;
  const segment = openFileSegment(fileName, launch);
  return MIME_BY_EXTENSION[extensionOf(segment)] ?? "application/octet-stream";
}

function imageMime(mime: string | null | undefined): string | null {
  const value = bareMime(mime);
  return value === "image/jpeg" || value === "image/png" || value === "image/gif" || value === "image/webp"
    ? value
    : null;
}

/**
 * Headers for a desktop app fetching the open-token URL.
 * Null means this file still downloads (unknown type).
 * Office files are inline: Word fetches the URL itself, and an attachment
 * disposition is the download the user reported.
 */
export function desktopOpenHeaders(
  fileName: string,
  mime: string | null | undefined,
  options?: { isImage?: boolean },
): { contentType: string; inline: true } | null {
  const launch = fileLaunch(fileName, mime, options?.isImage);
  if (launch === "pdf") return { contentType: "application/pdf", inline: true };
  if (launch === "image") {
    const contentType = imageMime(mime);
    return contentType ? { contentType, inline: true } : null;
  }
  if (isOfficeLaunch(launch)) return { contentType: officeMime(launch, fileName, mime), inline: true };
  return null;
}

/** `ms-word:ofe|u|<absolute-url>` and the Excel and PowerPoint equivalents. */
export function officeProtocol(launch: FileLaunch, absoluteUrl: string): string | null {
  if (!isOfficeLaunch(launch) || !isHttpUrl(absoluteUrl)) return null;
  return `${OFFICE_SCHEME[launch]}:ofe|u|${absoluteUrl}`;
}

/**
 * Address for a new browser tab. PDF and images stay the file URL so the
 * browser shows them inline. Word, Excel and PowerPoint use their Office link.
 * The current page is never the target.
 */
export function fileOpenDestination(launch: FileLaunch, absoluteUrl: string): string {
  return officeProtocol(launch, absoluteUrl) ?? absoluteUrl;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function httpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isTunnelOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

/**
 * Origin the user's PC can fetch. The page the browser is on wins: the
 * configured app, the local dev server, or (on a dev server) whichever
 * trycloudflare tunnel that page is using. A stored BETTER_AUTH_URL can name
 * a tunnel that is already gone. An unrelated host is ignored.
 */
export function publicRequestOrigin(input: {
  originHeader: string | null;
  nextOrigin: string;
  configuredOrigin: string | null;
  /** Dev server: follow a trycloudflare page even when BETTER_AUTH_URL is older. */
  trustBrowserHost?: boolean;
}): string {
  const configured = httpOrigin(input.configuredOrigin);
  const sent = httpOrigin(input.originHeader);
  if (sent && configured && sent === configured) return sent;
  if (sent && isLoopbackOrigin(sent)) return sent;
  if (sent && input.trustBrowserHost && isTunnelOrigin(sent)) return sent;
  if (configured) return configured;
  return httpOrigin(input.nextOrigin) ?? "http://127.0.0.1:3000";
}

/** Same file path and token, on the host of the page the user is looking at. */
export function fileUrlOnPage(fileUrl: string, pageOrigin: string): string {
  const page = httpOrigin(pageOrigin);
  if (!page) return fileUrl;
  let parsed: URL;
  try {
    parsed = new URL(fileUrl, page);
  } catch {
    return fileUrl;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return fileUrl;
  if (!parsed.pathname.startsWith("/api/")) return fileUrl;
  return `${page}${parsed.pathname}${parsed.search}`;
}

export function fileOpenUrl(
  origin: string,
  path: string,
  fileName: string,
  launch: FileLaunch,
  token: string,
): string {
  const root = httpOrigin(origin);
  if (!root || !path.startsWith("/") || path.includes("?") || path.includes("#")) {
    throw new Error("open url");
  }
  const segment = encodeURIComponent(openFileSegment(fileName, launch));
  return `${root}${path}/${segment}?open=${encodeURIComponent(token)}`;
}
