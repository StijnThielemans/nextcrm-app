import { Prisma } from "@prisma/client";
import { documentContentDisposition, inlineDocumentType, withDocumentFileRoutes } from "../file-key";

const MINIO = "https://files.example/nextcrm/documents/a.pdf";

describe("withDocumentFileRoutes (applied to every prismadb result)", () => {
  it("replaces the stored URL with the route, at any depth", () => {
    const account = {
      id: "acc1",
      documents: [
        { document_id: "d1", document: { id: "d1", document_file_url: MINIO } },
        { document_id: "d2", document: { id: "d2", document_file_url: MINIO } },
      ],
    };
    expect(withDocumentFileRoutes(account)).toEqual({
      id: "acc1",
      documents: [
        { document_id: "d1", document: { id: "d1", document_file_url: "/api/documents/d1/file" } },
        { document_id: "d2", document: { id: "d2", document_file_url: "/api/documents/d2/file" } },
      ],
    });
  });

  it("selected without id: never leaks the stored URL", () => {
    expect(withDocumentFileRoutes([{ document_file_url: MINIO }])).toEqual([
      { document_file_url: "" },
    ]);
  });

  it("leaves other values alone (dates, decimals, null, counts)", () => {
    const date = new Date("2026-10-18T00:00:00Z");
    const budget = new Prisma.Decimal("10.5");
    const out = withDocumentFileRoutes({ id: "o1", close_date: date, budget, note: null }) as any;
    expect(out.close_date).toBe(date);
    expect(out.budget).toBe(budget);
    expect(out.note).toBeNull();
    expect(withDocumentFileRoutes(3)).toBe(3);
    expect(withDocumentFileRoutes(null)).toBeNull();
  });

  it("shows a PDF or image and downloads every other type", () => {
    expect(inlineDocumentType("application/pdf")).toBe("application/pdf");
    expect(inlineDocumentType("image/png; charset=binary")).toBe("image/png");
    expect(inlineDocumentType("image/svg+xml")).toBeNull();
    expect(inlineDocumentType("text/plain")).toBeNull();
    expect(documentContentDisposition('Offerte "A".pdf', true)).toContain("inline");
    expect(documentContentDisposition('Offerte "A".pdf', true)).toContain('filename="Offerte A .pdf"');
    expect(documentContentDisposition("plan.docx", false)).toContain("attachment");
    expect(documentContentDisposition("mét meting.pdf", true)).toContain("filename*=UTF-8''m%C3%A9t%20meting.pdf");
  });

  it("returns plain objects (RSC can pass them to client components)", () => {
    const out = withDocumentFileRoutes({ id: "d1", document_file_url: MINIO }) as object;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.getOwnPropertySymbols(out)).toEqual([]);
  });
});
