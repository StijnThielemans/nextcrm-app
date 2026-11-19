jest.mock("@/lib/auth-server", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: { findUnique: jest.fn() },
    documents: { findFirst: jest.fn() },
  },
}));
// Raw row (stored URL as written), not the client-facing mapped one.
jest.mock("@/lib/prisma-base", () => ({
  prismaBase: { documents: { findUnique: jest.fn() } },
}));
jest.mock("@/lib/minio", () => ({
  MINIO_BUCKET: "nextcrm",
  MINIO_PUBLIC_URL: "https://files.example",
  MINIO_ENDPOINT: "http://minio:9000",
  minioClient: { send: jest.fn() },
}));

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { prismaBase } from "@/lib/prisma-base";
import { minioClient } from "@/lib/minio";
import { GET } from "../route";

const gs = getSession as jest.MockedFunction<typeof getSession>;
const fu = prismadb.users.findUnique as jest.MockedFunction<typeof prismadb.users.findUnique>;
const scopeCheck = prismadb.documents.findFirst as jest.MockedFunction<
  typeof prismadb.documents.findFirst
>;
const fd = prismaBase.documents.findUnique as jest.MockedFunction<
  typeof prismaBase.documents.findUnique
>;

/** Object key the route asked S3 to read (the external storage boundary). */
function fetchedKey() {
  const calls = (minioClient.send as jest.Mock).mock.calls;
  return calls.length ? calls[0][0].input.Key : undefined;
}

function storedBytes(bytes: string) {
  (minioClient.send as jest.Mock).mockResolvedValue({
    ContentLength: Buffer.byteLength(bytes),
    Body: {
      transformToWebStream: () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.from(bytes));
            controller.close();
          },
        }),
    },
  });
}

function call() {
  return GET(new NextRequest("http://localhost/api/documents/d1/file"), {
    params: Promise.resolve({ documentId: "d1" }),
  });
}

function signedIn(role = "user") {
  gs.mockResolvedValue({ user: { id: "u" } } as any);
  fu.mockResolvedValue({ id: "u", role } as any);
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/documents/[documentId]/file", () => {
  it("401 when not signed in", async () => {
    gs.mockResolvedValue(null as any);
    const res = await call();
    expect(res.status).toBe(401);
  });

  it("404 when the user may not read the document", async () => {
    signedIn("user");
    scopeCheck.mockResolvedValue(null);
    fd.mockResolvedValue({ key: "documents/a.pdf", document_file_url: "" } as any);
    const res = await call();
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("readable PDF: returns the file inline from its key", async () => {
    signedIn("user");
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({
      key: "documents/a.pdf",
      document_name: "Offerte.pdf",
      document_file_mimeType: "application/pdf",
      document_file_url: "https://files.example/nextcrm/documents/a.pdf",
    } as any);
    storedBytes("%PDF-1.4 offerte");
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(res.headers.get("content-disposition")).toContain('filename="Offerte.pdf"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe("%PDF-1.4 offerte");
    expect(fetchedKey()).toBe("documents/a.pdf");
  });

  it("image: opens inline; a word file downloads under its name", async () => {
    signedIn("user");
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({
      key: "images/foto.png",
      document_name: "foto.png",
      document_file_mimeType: "image/png",
      document_file_url: "https://files.example/nextcrm/images/foto.png",
    } as any);
    storedBytes("png");
    const image = await call();
    expect(image.headers.get("content-type")).toBe("image/png");
    expect(image.headers.get("content-disposition")).toContain("inline");

    fd.mockResolvedValue({
      key: "documents/plan.docx",
      document_name: "plan.docx",
      document_file_mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      document_file_url: "https://files.example/nextcrm/documents/plan.docx",
    } as any);
    storedBytes("docx");
    const word = await call();
    expect(word.status).toBe(200);
    expect(word.headers.get("content-type")).toBe("application/octet-stream");
    expect(word.headers.get("content-disposition")).toContain("attachment");
    expect(word.headers.get("content-disposition")).toContain('filename="plan.docx"');
  });

  it("legacy row without key: key comes from the stored public URL", async () => {
    signedIn("user");
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({
      key: null,
      document_name: "b c.png",
      document_file_mimeType: "image/png",
      document_file_url: "https://files.example/nextcrm/images/b%20c.png",
    } as any);
    storedBytes("png");
    const res = await call();
    expect(res.status).toBe(200);
    expect(fetchedKey()).toBe("images/b c.png");
  });

  it("legacy row holding the internal MINIO_ENDPOINT URL: key derived too", async () => {
    signedIn("user");
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({
      key: null,
      document_name: "old.pdf",
      document_file_mimeType: "application/pdf",
      document_file_url: "http://minio:9000/nextcrm/documents/old.pdf",
    } as any);
    storedBytes("%PDF");
    await call();
    expect(fetchedKey()).toBe("documents/old.pdf");
  });

  it("legacy row with a foreign-host URL: no key derived, 404", async () => {
    signedIn("user");
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({
      key: null,
      document_file_url: "https://other.example/nextcrm/documents/victim.pdf",
    } as any);
    const res = await call();
    expect(res.status).toBe(404);
    expect(minioClient.send).not.toHaveBeenCalled();
  });

  it.each([
    "https://utfs.io/f/abc123-offer.pdf",
    "https://uploadthing.com/f/abc123-offer.pdf",
    "https://x1y2z3.ufs.sh/f/abc123-offer.pdf",
  ])("old UploadThing file (%s): redirects to the stored URL", async (url) => {
    signedIn("user");
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({ key: "abc123-offer.pdf", document_file_url: url } as any);
    const res = await call();
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get("location")).toBe(url);
    expect(minioClient.send).not.toHaveBeenCalled();
  });

  it.each(["https://evil.example/phish", "https://utfs.io.evil.example/f/x"])(
    "any other stored host (%s): 404, no open redirect",
    async (url) => {
      signedIn("user");
      scopeCheck.mockResolvedValue({ id: "d1" } as any);
      fd.mockResolvedValue({ key: null, document_file_url: url } as any);
      const res = await call();
      expect(res.status).toBe(404);
      expect(res.headers.get("location")).toBeNull();
    },
  );

  // key and url come from the client at upload time; a document must not
  // become a way to read invoices or other objects in the same bucket.
  it.each([
    ["invoices/i1.pdf", ""],
    ["documents/../invoices/i1.pdf", ""],
    [null, "https://files.example/nextcrm/invoices/i1.pdf"],
  ])("404 for a key outside the upload folders (key=%s url=%s)", async (key, url) => {
    signedIn("admin");
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({ key, document_file_url: url } as any);
    const res = await call();
    expect(res.status).toBe(404);
    expect(minioClient.send).not.toHaveBeenCalled();
  });
});
