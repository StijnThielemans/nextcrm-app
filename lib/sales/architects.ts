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
    if (hits.length >= 20) break;
  }
  return hits;
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
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ArchitectDirectoryError();
  }
  const hits = parseArchitectSuggestions(body);
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
  const byNumber = await queryArchitectDirectory(cleanId);
  const found =
    byNumber.find((hit) => hit.id === cleanId && hit.name === cleanName) ??
    (await queryArchitectDirectory(cleanName)).find((hit) => hit.id === cleanId && hit.name === cleanName);
  if (!found) throw new ArchitectSelectionError();
  return { name: found.name, externalId: found.id };
}
