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
  quotes: ["name", "gross", "date", "sent", "dossier", "executionProjectNumber", "project", "customer", "seller", "status", "won"],
  projects: ["projectNumber", "dossierNumber", "name", "customer", "seller"],
};

/** Keep a newly added column beside its anchor instead of parking it at the end of a saved order. */
const PIN_AFTER: Partial<Record<TableId, Record<string, string>>> = {
  dossiers: { executionProjectNumber: "number" },
  quotes: { executionProjectNumber: "dossier" },
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

/** Keep only known columns, pin a new column beside its anchor, append the rest, and never hide a locked column. */
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
    if (seen.has(id)) continue;
    const after = PIN_AFTER[tableId]?.[id];
    const index = after ? order.indexOf(after) : -1;
    if (index >= 0) order.splice(index + 1, 0, id);
    else order.push(id);
    seen.add(id);
  }
  const hidden = isStringList(record.hidden)
    ? record.hidden.filter((id) => allowed.includes(id) && !locked.has(id))
    : [];
  return { order, hidden };
}
