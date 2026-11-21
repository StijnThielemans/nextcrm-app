jest.mock("@/lib/auth-server", () => ({ getSession: jest.fn() }));
jest.mock("@/lib/prisma", () => ({
  prismadb: {
    users: { findUnique: jest.fn() },
    documents: { findFirst: jest.fn() },
  },
}));
jest.mock("@/lib/prisma-base", () => ({
  prismaBase: { documents: { findUnique: jest.fn() } },
}));

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { prismaBase } from "@/lib/prisma-base";
import { officeProtocol } from "@/lib/documents/open-file";
import { verifyOpenToken } from "@/lib/documents/open-token";
import { POST } from "../route";

const gs = getSession as jest.MockedFunction<typeof getSession>;
const fu = prismadb.users.findUnique as jest.MockedFunction<typeof prismadb.users.findUnique>;
const scopeCheck = prismadb.documents.findFirst as jest.MockedFunction<typeof prismadb.documents.findFirst>;
const fd = prismaBase.documents.findUnique as jest.MockedFunction<typeof prismaBase.documents.findUnique>;

const TUNNEL = "https://consequences-relationship-auditor-fundamental.trycloudflare.com";
const previousUrl = process.env.BETTER_AUTH_URL;
const previousSecret = process.env.BETTER_AUTH_SECRET;

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-open-token-secret";
  process.env.BETTER_AUTH_URL = TUNNEL;
});

afterAll(() => {
  if (previousUrl === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = previousUrl;
  if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = previousSecret;
});

beforeEach(() => jest.clearAllMocks());

function post(origin: string) {
  return POST(
    new NextRequest("http://localhost:3000/api/documents/d1/open", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
    }),
    { params: Promise.resolve({ documentId: "d1" }) },
  );
}

describe("POST /api/documents/[documentId]/open", () => {
  it("401 when not signed in", async () => {
    gs.mockResolvedValue(null as any);
    expect((await post(TUNNEL)).status).toBe(401);
  });

  it("gives a partner a Word link on the public origin, scoped to that file", async () => {
    gs.mockResolvedValue({ user: { id: "u" } } as any);
    fu.mockResolvedValue({ id: "u", role: "partner" } as any);
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({
      document_name: "plan.docx",
      document_file_mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    } as any);
    const res = await post(TUNNEL);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.launch).toBe("word");
    expect(body.url).toMatch(new RegExp(`^${TUNNEL}/api/documents/d1/file/plan\\.docx\\?open=`));
    const token = new URL(body.url).searchParams.get("open") ?? "";
    expect(verifyOpenToken(token, "document", "d1")).toBe(true);
    expect(verifyOpenToken(token, "document", "other")).toBe(false);
    expect(officeProtocol(body.launch, body.url)).toBe(`ms-word:ofe|u|${body.url}`);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("ignores a foreign Origin and still uses the app origin", async () => {
    gs.mockResolvedValue({ user: { id: "u" } } as any);
    fu.mockResolvedValue({ id: "u", role: "user" } as any);
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({ document_name: "Offerte.pdf", document_file_mimeType: "application/pdf" } as any);
    const res = await post("https://evil.example");
    const body = await res.json();
    expect(body.launch).toBe("pdf");
    expect(body.url.startsWith(`${TUNNEL}/`)).toBe(true);
  });

  it("follows the tunnel the page is on when the stored app URL is an older tunnel", async () => {
    const current = "https://wishlist-silicon-delivering-broad.trycloudflare.com";
    const previous = process.env.BETTER_AUTH_URL;
    const previousEnv = process.env.NODE_ENV;
    process.env.BETTER_AUTH_URL = TUNNEL;
    process.env.NODE_ENV = "development";
    gs.mockResolvedValue({ user: { id: "u" } } as any);
    fu.mockResolvedValue({ id: "u", role: "user" } as any);
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({ document_name: "plan.pdf", document_file_mimeType: "application/pdf" } as any);
    try {
      const res = await post(current);
      const body = await res.json();
      expect(body.url.startsWith(`${current}/api/documents/d1/file/`)).toBe(true);
    } finally {
      process.env.BETTER_AUTH_URL = previous;
      process.env.NODE_ENV = previousEnv;
    }
  });

  it("uses the local dev origin when the page is on the dev server", async () => {
    gs.mockResolvedValue({ user: { id: "u" } } as any);
    fu.mockResolvedValue({ id: "u", role: "user" } as any);
    scopeCheck.mockResolvedValue({ id: "d1" } as any);
    fd.mockResolvedValue({ document_name: "Offerte.pdf", document_file_mimeType: "application/pdf" } as any);
    const res = await post("http://127.0.0.1:3000");
    const body = await res.json();
    expect(body.url.startsWith("http://127.0.0.1:3000/api/documents/d1/file/")).toBe(true);
  });
});
