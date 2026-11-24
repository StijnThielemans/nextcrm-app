"use server";

import { Prisma } from "@prisma/client";
import { prismadb } from "@/lib/prisma";
import { requireAuthenticated } from "@/lib/authz";
import {
  TABLE_IDS,
  sanitizeLayout,
  type SavedLayout,
  type TableId,
} from "@/lib/sales/table-layout";

function isTableId(value: string): value is TableId {
  return (TABLE_IDS as readonly string[]).includes(value);
}

export async function loadTableLayout(tableId: TableId): Promise<SavedLayout | null> {
  const user = await requireAuthenticated();
  const row = await prismadb.users.findUnique({
    where: { id: user.id },
    select: { table_layouts: true },
  });
  const stored = row?.table_layouts;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  return sanitizeLayout(tableId, (stored as Record<string, unknown>)[tableId]);
}

export async function saveTableLayout(tableId: TableId, layout: SavedLayout | null) {
  if (!isTableId(tableId)) return;
  const user = await requireAuthenticated();
  const row = await prismadb.users.findUnique({
    where: { id: user.id },
    select: { table_layouts: true },
  });
  const current =
    row?.table_layouts && typeof row.table_layouts === "object" && !Array.isArray(row.table_layouts)
      ? { ...(row.table_layouts as Record<string, unknown>) }
      : {};
  const clean = layout ? sanitizeLayout(tableId, layout) : null;
  if (clean) current[tableId] = clean;
  else delete current[tableId];
  await prismadb.users.update({
    where: { id: user.id },
    data: { table_layouts: current as Prisma.InputJsonValue },
  });
}
