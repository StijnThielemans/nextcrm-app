export const TABLE_IDS = ["customers", "dossiers", "quotes"] as const;

export type TableId = (typeof TABLE_IDS)[number];

export const TABLE_COLUMNS: Record<TableId, readonly string[]> = {
  customers: ["name", "account_role", "office_phone", "mobile_phone", "email", "vat_choice", "vat", "address", "actions"],
  dossiers: [
    "number",
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
  quotes: ["name", "gross", "date", "sent", "dossier", "project", "customer", "seller", "status", "won"],
};

const LOCKED: Record<TableId, readonly string[]> = {
  customers: ["name", "actions"],
  dossiers: ["number"],
  quotes: ["name"],
};

export type SavedLayout = {
  order: string[];
  hidden: string[];
};

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Keep only known columns, append any the user has not placed, and never hide a locked column. */
export function sanitizeLayout(tableId: TableId, input: unknown): SavedLayout | null {
  if (!input || typeof input !== "object") return null;
  const record = input as { order?: unknown; hidden?: unknown };
  if (!isStringList(record.order)) return null;
  const allowed = TABLE_COLUMNS[tableId];
  const locked = new Set(LOCKED[tableId]);
  const seen = new Set<string>();
  const order = record.order.filter((id) => {
    if (!allowed.includes(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  for (const id of allowed) {
    if (!seen.has(id)) order.push(id);
  }
  const hidden = isStringList(record.hidden)
    ? record.hidden.filter((id) => allowed.includes(id) && !locked.has(id))
    : [];
  return { order, hidden };
}
