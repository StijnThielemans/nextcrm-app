export const TABLE_IDS = ["customers", "dossiers", "quotes", "projects"] as const;

export type TableId = (typeof TABLE_IDS)[number];

export const TABLE_COLUMNS: Record<TableId, readonly string[]> = {
  customers: ["name", "account_role", "office_phone", "mobile_phone", "email", "vat_choice", "vat", "address", "actions"],
  dossiers: [
    "number",
    "executionProjectNumber",
    "name",
    "customer",
    "contactType",
    "email",
    "phone",
    "mobile",
    "vat",
    "address",
    "seller",
    "architect",
    "projectGroup",
    "priceRequestDate",
    "siteAddress",
    "status",
    "followUp",
  ],
  quotes: ["dossier", "executionProjectNumber", "name", "gross", "date", "sent", "project", "customer", "seller", "status", "won"],
  projects: ["projectNumber", "dossierNumber", "name", "customer", "seller"],
};

/** Offertedossiernummer and the 10-digit project number stay the first two columns. */
const LEADING: Partial<Record<TableId, readonly string[]>> = {
  dossiers: ["number", "executionProjectNumber"],
  quotes: ["dossier", "executionProjectNumber"],
};

const LOCKED: Record<TableId, readonly string[]> = {
  customers: ["name", "actions"],
  dossiers: ["number"],
  quotes: ["name"],
  projects: ["projectNumber"],
};

export type SavedLayout = {
  order: string[];
  hidden: string[];
};

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Keep known columns, keep the two numbers in front, and never hide a locked column. */
export function sanitizeLayout(tableId: TableId, input: unknown): SavedLayout | null {
  if (!input || typeof input !== "object") return null;
  const record = input as { order?: unknown; hidden?: unknown };
  if (!isStringList(record.order)) return null;
  const allowed = TABLE_COLUMNS[tableId];
  const locked = new Set(LOCKED[tableId]);
  const leadingIds = LEADING[tableId] ?? [];
  const leading = new Set(leadingIds);
  const seen = new Set<string>();
  const order = record.order.filter((id) => {
    if (!allowed.includes(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const id of allowed) {
    if (seen.has(id)) continue;
    order.push(id);
    seen.add(id);
  }
  const ordered = leadingIds.length
    ? [...leadingIds.filter((id) => seen.has(id)), ...order.filter((id) => !leading.has(id))]
    : order;
  const hidden = isStringList(record.hidden)
    ? record.hidden.filter((id) => allowed.includes(id) && !locked.has(id) && !leading.has(id))
    : [];
  return { order: ordered, hidden };
}
