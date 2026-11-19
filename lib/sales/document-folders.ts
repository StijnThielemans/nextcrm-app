import {
  DOSSIER_DOCUMENT_CATEGORIES,
  DOSSIER_DOCUMENT_LABELS,
  documentCategoryLabel,
} from "./labels";

export type FolderDocument = {
  id: string;
  name: string;
  category: string | null;
};

export type DocumentFolder = {
  key: string;
  label: string;
  files: FolderDocument[];
};

const CATEGORY_ORDER = new Map<string, number>(
  DOSSIER_DOCUMENT_CATEGORIES.flatMap((category, index) => [
    [category, index],
    [DOSSIER_DOCUMENT_LABELS[category], index],
  ]),
);

/** Categories with no files are omitted. One file still gets its own folder. */
export function groupDocumentsIntoFolders(documents: FolderDocument[]): DocumentFolder[] {
  const groups = new Map<string, DocumentFolder & { order: number }>();

  for (const document of documents) {
    const label = documentCategoryLabel(document.category);
    const order = CATEGORY_ORDER.get(document.category ?? "")
      ?? CATEGORY_ORDER.get(label)
      ?? DOSSIER_DOCUMENT_CATEGORIES.length;
    const existing = groups.get(label);
    if (existing) {
      existing.files.push(document);
      continue;
    }
    groups.set(label, { key: label, label, files: [document], order });
  }

  return [...groups.values()]
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label, "nl"))
    .map(({ key, label, files }) => ({ key, label, files }));
}
