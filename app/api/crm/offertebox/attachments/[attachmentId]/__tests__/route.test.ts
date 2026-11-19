jest.mock("@/lib/auth-server", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: { findUnique: jest.fn() },
    crm_OfferteboxAttachments: { findUnique: jest.fn() },
  },
}));
jest.mock("@/lib/minio", () => ({
  MINIO_BUCKET: "nextcrm",
  minioClient: { send: jest.fn() },
}));

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { minioClient } from "@/lib/minio";
import { signOpenToken } from "@/lib/documents/open-token";
import { GET } from "../route";

const gs = getSession as jest.MockedFunction<typeof getSession>;
const fu = prismadb.users.findUnique as jest.MockedFunction<typeof prismadb.users.findUnique>;
const fa = prismadb.crm_OfferteboxAttachments.findUnique as jest.MockedFunction<
  typeof prismadb.crm_OfferteboxAttachments.findUnique
>;

const previousSecret = process.env.BETTER_AUTH_SECRET;
beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-open-token-secret";
});
afterAll(() => {
  if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = previousSecret;
});
beforeEach(() => jest.clearAllMocks());

function stored(bytes: string) {
  (minioClient.send as jest.Mock).mockResolvedValue({
    Body: { transformToByteArray: async () => Buffer.from(bytes) },
  });
}

function call(open?: string) {
  const url = new URL("http://localhost/api/crm/offertebox/attachments/a1");
  if (open) url.searchParams.set("open", open);
  return GET(new NextRequest(url), { params: Promise.resolve({ attachmentId: "a1" }) });
}

describe("GET /api/crm/offertebox/attachments/[attachmentId]", () => {
  it("401 without a session or a token", async () => {
    gs.mockResolvedValue(null as any);
    expect((await call()).status).toBe(401);
  });

  it("open token: PDF is inline and a Word file is not an attachment", async () => {
    gs.mockResolvedValue(null as any);
    fa.mockResolvedValue({
      file_name: "Offerte.pdf",
      content_type: "application/pdf",
      storage_key: "documents/offertebox/a1",
      is_image: false,
    } as any);
    stored("%PDF-1.4");
    const pdf = await call(signOpenToken("attachment", "a1"));
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")?.startsWith("inline")).toBe(true);

    fa.mockResolvedValue({
      file_name: "plan.docx",
      content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storage_key: "documents/offertebox/a1",
      is_image: false,
    } as any);
    stored("docx");
    const word = await call(signOpenToken("attachment", "a1"));
    expect(word.status).toBe(200);
    expect(word.headers.get("content-disposition")?.startsWith("inline")).toBe(true);
    expect(word.headers.get("content-disposition")).not.toContain("attachment;");
    expect(word.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("a document token does not open an attachment", async () => {
    gs.mockResolvedValue(null as any);
    expect((await call(signOpenToken("document", "a1"))).status).toBe(401);
    expect(minioClient.send).not.toHaveBeenCalled();
  });

  it("a signed-in download of a word file stays an attachment", async () => {
    gs.mockResolvedValue({ user: { id: "u" } } as any);
    fu.mockResolvedValue({ id: "u", role: "user" } as any);
    fa.mockResolvedValue({
      file_name: "plan.docx",
      content_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storage_key: "documents/offertebox/a1",
      is_image: false,
    } as any);
    stored("docx");
    const url = new URL("http://localhost/api/crm/offertebox/attachments/a1?download=1");
    const res = await GET(new NextRequest(url), { params: Promise.resolve({ attachmentId: "a1" }) });
    expect(res.headers.get("content-disposition")?.startsWith("attachment")).toBe(true);
  });
});
