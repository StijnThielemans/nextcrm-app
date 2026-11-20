import { createHmac, timingSafeEqual } from "crypto";
import { isDevPasswordSignIn } from "@/lib/dev-password-sign-in";
import { fileLaunch, fileOpenUrl, publicRequestOrigin, type FileLaunch } from "@/lib/documents/open-file";

export type OpenTarget = "document" | "attachment";

/** Long enough for Word or Adobe to fetch the file, short enough to throw away. */
export const OPEN_TOKEN_TTL_MS = 10 * 60 * 1000;

type Payload = { v: 1; k: OpenTarget; id: string; exp: number };

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET ?? "";
  if (value.length < 16) throw new Error("open token secret missing");
  return value;
}

function signPayload(payload: string): string {
  return createHmac("sha256", secret()).update(`open-file.v1.${payload}`).digest("base64url");
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function signOpenToken(kind: OpenTarget, id: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ v: 1, k: kind, id, exp: now + OPEN_TOKEN_TTL_MS } satisfies Payload)).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

/** True only for this one file, this target, and an unexpired signature. */
export function verifyOpenToken(token: string, kind: OpenTarget, id: string, now = Date.now()): boolean {
  if (token.length < 20 || token.length > 512) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!sameText(signature, signPayload(payload))) return false;
  let body: Partial<Payload>;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Payload>;
  } catch {
    return false;
  }
  return body.v === 1 && body.k === kind && body.id === id && typeof body.exp === "number" && body.exp > now;
}

export function mintOpenUrl(
  request: { headers: { get(name: string): string | null }; nextUrl: { origin: string } },
  path: string,
  fileName: string,
  mime: string | null | undefined,
  kind: OpenTarget,
  id: string,
  isImage = false,
): { url: string; launch: FileLaunch } {
  const launch = fileLaunch(fileName, mime, isImage);
  const origin = publicRequestOrigin({
    originHeader: request.headers.get("origin"),
    nextOrigin: request.nextUrl.origin,
    configuredOrigin: process.env.BETTER_AUTH_URL ?? null,
    trustBrowserHost: isDevPasswordSignIn(),
  });
  return { launch, url: fileOpenUrl(origin, path, fileName, launch, signOpenToken(kind, id)) };
}
