import {
  collectFiledAttachmentKeys,
  documentCopyKey,
  documentMimeForAttachment,
  normalizeFilingAssignments,
  offerteboxAttachmentIdFromTags,
} from "../offertebox-filing";
import { SalesError } from "../errors";

const ATTACHMENT = "4e6016aa-7098-4620-a3ea-f4c1440b74c9";
const OTHER = "11111111-2222-4333-8444-555555555555";

describe("offertebox filing", () => {
  it("keeps the category empty until the caller chooses one", () => {
    expect(() => normalizeFilingAssignments([])).toThrow(SalesError);
    expect(() =>
      normalizeFilingAssignments([{ attachmentId: ATTACHMENT, category: "" as "OPMETING" }]),
    ).toThrow(SalesError);
    expect(normalizeFilingAssignments([{ attachmentId: ATTACHMENT, category: "OPMETING" }])).toEqual([
      { attachmentId: ATTACHMENT, category: "OPMETING" },
    ]);
  });

  it("refuses the same attachment twice in one save", () => {
    expect(() =>
      normalizeFilingAssignments([
        { attachmentId: ATTACHMENT, category: "OPMETING" },
        { attachmentId: ATTACHMENT, category: "PLANNEN" },
      ]),
    ).toThrow(SalesError);
  });

  it("reads a filed attachment id only from the document tag", () => {
    expect(offerteboxAttachmentIdFromTags({ offerteboxAttachmentId: ATTACHMENT })).toBe(ATTACHMENT);
    expect(offerteboxAttachmentIdFromTags({ name: "opmeting.pdf" })).toBeNull();
    expect(offerteboxAttachmentIdFromTags(null)).toBeNull();
  });

  it("treats a copy as filed only while it sits on that dossier", () => {
    const keys = collectFiledAttachmentKeys([
      { tags: { offerteboxAttachmentId: ATTACHMENT }, dossierIds: ["dossier-1"] },
      { tags: { offerteboxAttachmentId: OTHER }, dossierIds: ["dossier-2"] },
      { tags: { offerteboxAttachmentId: ATTACHMENT }, dossierIds: [] },
    ]);
    expect(keys.has(`dossier-1:${ATTACHMENT}`)).toBe(true);
    expect(keys.has(`dossier-2:${ATTACHMENT}`)).toBe(false);
    expect(keys.has(`dossier-2:${OTHER}`)).toBe(true);
  });

  it("sniffs a pdf and stores the copy outside the offertebox folder", () => {
    const stored = documentMimeForAttachment("opmeting ramen gasmeterlaan 101.pdf", "application/octet-stream", Buffer.from("%PDF-1.4"));
    expect(stored).toEqual({ mimeType: "application/pdf", extension: "pdf" });
    const key = documentCopyKey(stored.extension);
    expect(key.startsWith("documents/")).toBe(true);
    expect(key.includes("/offertebox/")).toBe(false);
    expect(key.endsWith(".pdf")).toBe(true);
  });

  it("keeps a jpeg that the mail marked as an image", () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    expect(documentMimeForAttachment("foto.jpg", "application/octet-stream", bytes)).toEqual({
      mimeType: "image/jpeg",
      extension: "jpg",
    });
  });
});
