import { randomUUID } from "node:crypto";
import type { ParsedPosition } from "./parse-export";

export type StoredPosition = {
  id: string;
  elevationKey: string;
  name: string;
  quantity: number;
  quoteText: string | null;
  description: string;
  drawingKey: string | null;
  drawingName: string | null;
  drawingMime: string | null;
  sortOrder: number;
};

export type ExistingPosition = { drawingKey: string | null };

export type ImportDeps = {
  listExisting: () => Promise<ExistingPosition[]>;
  put: (key: string, body: Buffer, mime: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
  replace: (rows: StoredPosition[], importedAt: Date) => Promise<void>;
};

function safePart(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  return cleaned || "position";
}

/**
 * Uploads drawings first. The previous rows are replaced only inside `replace`.
 * If that step throws, the new objects are removed and the caller keeps the old list.
 */
export async function importLogikalPositions(
  deps: ImportDeps,
  dossierId: string,
  positions: ParsedPosition[],
  now = new Date(),
): Promise<StoredPosition[]> {
  const existing = await deps.listExisting();
  const batch = randomUUID();
  const uploaded: string[] = [];
  const rows: StoredPosition[] = [];
  try {
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      let drawingKey: string | null = null;
      let drawingName: string | null = null;
      let drawingMime: string | null = null;
      if (position.drawing) {
        drawingName = safePart(position.drawing.fileName);
        drawingMime = position.drawing.mime;
        drawingKey = `logikal/${dossierId}/${batch}/${safePart(position.elevationKey)}/${drawingName}`;
        await deps.put(drawingKey, position.drawing.bytes, drawingMime);
        uploaded.push(drawingKey);
      }
      rows.push({
        id: randomUUID(),
        elevationKey: position.elevationKey,
        name: position.name.slice(0, 200),
        quantity: position.quantity,
        quoteText: position.quoteText,
        description: position.description.slice(0, 4000),
        drawingKey,
        drawingName: position.drawing?.fileName.slice(0, 200) ?? null,
        drawingMime,
        sortOrder: index,
      });
    }
    await deps.replace(rows, now);
  } catch (error) {
    await Promise.all(uploaded.map((key) => deps.remove(key).catch(() => undefined)));
    throw error;
  }
  const kept = new Set(rows.map((row) => row.drawingKey).filter((key): key is string => Boolean(key)));
  await Promise.all(existing.map(async (row) => {
    if (row.drawingKey && !kept.has(row.drawingKey)) await deps.remove(row.drawingKey).catch(() => undefined);
  }));
  return rows;
}
