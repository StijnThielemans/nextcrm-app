/**
 * Zoekt architecten in het openbare register van de Orde van Architecten — Vlaamse Raad.
 * architect.be verwijst daarvoor naar https://vind.architect.be/.
 * De zoeker zelf is GET /api/suggestions?q=… en antwoordt met naam, stad en stamnummer.
 * Het register telt ruim 12.000 profielen. Die lijst blijft op hun server: we vragen
 * alleen de treffers op terwijl iemand typt, en bewaren een kort cache.
 */

const DIRECTORY = "https://vind.architect.be/api/suggestions";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const STAMNUMMER = /^[AB]\d{6}$/;
const CACHE_MS = 15 * 60 * 1000;
const CACHE_MAX = 200;

export type ArchitectHit = {
  id: string;
  name: string;
  city: string | null;
  postalCode: string | null;
  kind: string | null;
};

export class ArchitectDirectoryError extends Error {
  constructor() {
    super("architect-directory");
    this.name = "ArchitectDirectoryError";
  }
}

export class ArchitectSelectionError extends Error {
  constructor() {
    super("architect-selection");
    this.name = "ArchitectSelectionError";
  }
}

type CacheEntry = { at: number; hits: ArchitectHit[] };
const cache = new Map<string, CacheEntry>();

export function parseArchitectSuggestions(body: unknown): ArchitectHit[] {
  if (!body || typeof body !== "object") return [];
  const members = (body as { members?: { hits?: unknown } }).members;
  const rows = members && Array.isArray(members.hits) ? members.hits : [];
  const hits: ArchitectHit[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const id = typeof record.stamnummer === "string" ? record.stamnummer.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!STAMNUMMER.test(id) || !name || name.length > 200) continue;
    const city = typeof record.city === "string" ? record.city.trim() : "";
    const postalCode = typeof record.postal_code === "string" ? record.postal_code.trim() : "";
    hits.push({
      id,
      name,
      city: city || null,
      postalCode: postalCode || null,
      kind: typeof record.type === "string" ? record.type : null,
    });
  }
  return hits;
}

const SEARCH_PAGE = "https://vind.architect.be/zoek";
const MAX_RESULT_PAGES = 50;

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCodePoint(parseInt(digits, 16)))
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&");
}

function visibleText(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function htmlAttribute(html: string, name: string): string | null {
  const match = html.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decodeHtml(match[1]) : null;
}

/** Every architect card on a vind.architect.be search page, including the extra basic rows. */
export function parseArchitectSearchHtml(html: string): ArchitectHit[] {
  const hits: ArchitectHit[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string, city: string, kind: string | null) => {
    const cleanName = visibleText(name);
    const cleanCity = visibleText(city);
    if (!STAMNUMMER.test(id) || !cleanName || cleanName.length > 200 || seen.has(id)) return;
    seen.add(id);
    hits.push({
      id,
      name: cleanName,
      city: cleanCity || null,
      postalCode: null,
      kind,
    });
  };

  const primary = /data-member-stamnummer="([AB]\d{6})"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/g;
  for (const match of html.matchAll(primary)) {
    const type = html.slice(Math.max(0, match.index ?? 0), (match.index ?? 0) + 180).match(/data-member-type="([^"]*)"/);
    add(match[1], match[2], match[3], type ? decodeHtml(type[1]) : null);
  }

  const secondary = /<a href="\/[^"]+\/([AB]\d{6})"[^>]*>\s*<span class="font-medium[^"]*">([\s\S]*?)<\/span>[\s\S]*?<span class="text-gray-500">([\s\S]*?)<\/span>/g;
  for (const match of html.matchAll(secondary)) add(match[1], match[2], match[3], null);
  return hits;
}

function secondaryIsCollapsed(html: string): boolean {
  return /wire:click="expandSecondary"[\s\S]{0,800}?Toon\s+<strong>/.test(html);
}

function hasNextPage(html: string): boolean {
  const match = html.match(/Pagina\s+(\d+)\s+van\s+(\d+)/);
  return Boolean(match && Number(match[1]) < Number(match[2]));
}

type DirectorySession = { cookie: string; csrf: string; updateUri: string };

function storeCookies(session: DirectorySession, response: Response) {
  const lines = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (lines.length === 0) return;
  const jar = new Map<string, string>();
  for (const part of session.cookie.split(";")) {
    const pair = part.trim();
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  for (const line of lines) {
    const pair = line.split(";")[0]?.trim() ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  session.cookie = [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function livewireCall(
  session: DirectorySession,
  snapshot: string,
  method: string,
  params: string[],
): Promise<{ html: string; snapshot: string }> {
  const response = await fetch(session.updateUri, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Referer: SEARCH_PAGE,
      "X-Livewire": "true",
      "X-CSRF-TOKEN": session.csrf,
      Cookie: session.cookie,
    },
    body: JSON.stringify({
      _token: session.csrf,
      components: [{ snapshot, updates: {}, calls: [{ method, params, metadata: {} }] }],
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  storeCookies(session, response);
  if (!response.ok) throw new ArchitectDirectoryError();
  const body = await response.json() as { components?: { snapshot?: unknown; effects?: { html?: unknown } }[] };
  const component = body.components?.[0];
  const html = component?.effects?.html;
  const nextSnapshot = component?.snapshot;
  if (typeof html !== "string" || typeof nextSnapshot !== "string") throw new ArchitectDirectoryError();
  return { html, snapshot: nextSnapshot };
}

async function suggestArchitects(rawQuery: string): Promise<ArchitectHit[]> {
  const query = rawQuery.trim();
  if (query.length < 2 || query.length > 80) return [];
  let response: Response;
  try {
    response = await fetch(`${DIRECTORY}?q=${encodeURIComponent(query)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        Referer: "https://vind.architect.be/",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    throw new ArchitectDirectoryError();
  }
  if (!response.ok) throw new ArchitectDirectoryError();
  try {
    return parseArchitectSuggestions(await response.json());
  } catch (error) {
    if (error instanceof ArchitectDirectoryError) throw error;
    throw new ArchitectDirectoryError();
  }
}

async function searchArchitectPages(query: string): Promise<ArchitectHit[]> {
  let response: Response;
  try {
    response = await fetch(`${SEARCH_PAGE}?term=${encodeURIComponent(query)}`, {
      headers: {
        Accept: "text/html",
        "User-Agent": USER_AGENT,
        Referer: "https://vind.architect.be/",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    throw new ArchitectDirectoryError();
  }
  if (!response.ok) throw new ArchitectDirectoryError();
  let html: string;
  try {
    html = await response.text();
  } catch {
    throw new ArchitectDirectoryError();
  }
  const session: DirectorySession = {
    cookie: "",
    csrf: htmlAttribute(html, "data-csrf") ?? "",
    updateUri: htmlAttribute(html, "data-update-uri") ?? "",
  };
  storeCookies(session, response);
  let snapshot = htmlAttribute(html, "wire:snapshot");
  const collected = new Map<string, ArchitectHit>();
  const addAll = (page: string) => {
    for (const hit of parseArchitectSearchHtml(page)) collected.set(hit.id, collected.get(hit.id) ?? hit);
  };
  addAll(html);

  const call = async (method: string, params: string[]) => {
    if (!session.csrf || !session.updateUri || !snapshot) throw new ArchitectDirectoryError();
    const next = await livewireCall(session, snapshot, method, params);
    html = next.html;
    snapshot = next.snapshot;
    addAll(html);
  };

  if (secondaryIsCollapsed(html)) await call("expandSecondary", []);
  for (let page = 1; hasNextPage(html) && page < MAX_RESULT_PAGES; page += 1) {
    await call("nextPage", ["pagina"]);
  }
  return [...collected.values()];
}

export async function queryArchitectDirectory(rawQuery: string): Promise<ArchitectHit[]> {
  const query = rawQuery.trim();
  if (query.length < 2 || query.length > 80) return [];
  const key = query.toLocaleLowerCase("nl");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    cache.delete(key);
    cache.set(key, cached);
    return cached.hits;
  }
  const hits = STAMNUMMER.test(query) ? await suggestArchitects(query) : await searchArchitectPages(query);
  cache.set(key, { at: Date.now(), hits });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  return hits;
}

export async function resolveArchitect(
  name: string | undefined,
  externalId: string | undefined,
): Promise<{ name: string; externalId: string } | null> {
  const cleanName = (name ?? "").trim();
  const cleanId = (externalId ?? "").trim();
  if (!cleanName && !cleanId) return null;
  if (!cleanName || !STAMNUMMER.test(cleanId) || cleanName.length > 200) {
    throw new ArchitectSelectionError();
  }
  const byNumber = await suggestArchitects(cleanId);
  const found =
    byNumber.find((hit) => hit.id === cleanId && hit.name === cleanName) ??
    (await suggestArchitects(cleanName)).find((hit) => hit.id === cleanId && hit.name === cleanName);
  if (!found) throw new ArchitectSelectionError();
  return { name: found.name, externalId: found.id };
}
