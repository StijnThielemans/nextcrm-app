import { fileLaunch, fileOpenDestination, fileOpenUrl, fileUrlOnPage, officeProtocol, openFileSegment, publicRequestOrigin, desktopOpenHeaders } from "../open-file";
import { OPEN_TOKEN_TTL_MS, signOpenToken, verifyOpenToken } from "../open-token";

describe("file open target", () => {
  it("sends each office type to its program and keeps images in the browser", () => {
    expect(fileLaunch("Offerte.pdf", "application/octet-stream")).toBe("pdf");
    expect(fileLaunch("plan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("word");
    expect(fileLaunch("plan.doc", "application/msword")).toBe("word");
    expect(fileLaunch("prijzen.xlsx", "application/octet-stream")).toBe("excel");
    expect(fileLaunch("prijzen.xls", "application/vnd.ms-excel")).toBe("excel");
    expect(fileLaunch("deck.pptx", "application/octet-stream")).toBe("powerpoint");
    expect(fileLaunch("deck.ppt", "application/vnd.ms-powerpoint")).toBe("powerpoint");
    expect(fileLaunch("foto.png", "image/png")).toBe("image");
    expect(fileLaunch("foto.jpg", "image/jpeg; charset=binary")).toBe("image");
    expect(fileLaunch("scan", "application/pdf")).toBe("pdf");
    expect(fileLaunch("logo.svg", "image/svg+xml")).toBe("download");
    expect(fileLaunch("notities.txt", "text/plain")).toBe("download");
    expect(fileLaunch("bijlage.bin", "application/octet-stream", true)).toBe("image");
  });

  it("builds the Office URI and a public file URL that ends in the real extension", () => {
    const url = fileOpenUrl(
      "https://consequences-relationship-auditor-fundamental.trycloudflare.com",
      "/api/documents/d1/file",
      "plan.docx",
      "word",
      "tok",
    );
    expect(url).toBe(
      "https://consequences-relationship-auditor-fundamental.trycloudflare.com/api/documents/d1/file/plan.docx?open=tok",
    );
    expect(officeProtocol("word", url)).toBe(`ms-word:ofe|u|${url}`);
    expect(officeProtocol("excel", "https://app.example/a.xlsx")).toBe("ms-excel:ofe|u|https://app.example/a.xlsx");
    expect(officeProtocol("powerpoint", "https://app.example/a.pptx")).toBe("ms-powerpoint:ofe|u|https://app.example/a.pptx");
    expect(officeProtocol("pdf", url)).toBeNull();
    expect(fileOpenDestination("pdf", url)).toBe(url);
    expect(fileOpenDestination("image", url)).toBe(url);
    expect(fileOpenDestination("download", url)).toBe(url);
    expect(fileOpenDestination("word", url)).toBe(`ms-word:ofe|u|${url}`);
    expect(fileOpenDestination("excel", "https://app.example/a.xlsx")).toBe(
      "ms-excel:ofe|u|https://app.example/a.xlsx",
    );
    expect(fileOpenDestination("powerpoint", "https://app.example/a.pptx")).toBe(
      "ms-powerpoint:ofe|u|https://app.example/a.pptx",
    );
    expect(officeProtocol("word", "javascript:alert(1)")).toBeNull();
    expect(openFileSegment("Offerte", "pdf")).toBe("Offerte.pdf");
    expect(openFileSegment("../../plan.doc", "word")).toBe("plan.doc");
    expect(fileOpenUrl("https://app.example", "/api/documents/d1/file", "mijn plan.docx", "word", "a b")).toContain(
      "/mijn%20plan.docx?open=a%20b",
    );
  });

  it("uses the page origin, including a newer tunnel, and never an arbitrary host", () => {
    const stale = "https://consequences-relationship-auditor-fundamental.trycloudflare.com";
    const current = "https://wishlist-silicon-delivering-broad.trycloudflare.com";
    const file = `${stale}/api/documents/d1/file/plan.pdf?open=tok`;
    expect(publicRequestOrigin({
      originHeader: stale,
      nextOrigin: "http://localhost:3000",
      configuredOrigin: stale,
    })).toBe(stale);
    expect(publicRequestOrigin({
      originHeader: current,
      nextOrigin: "http://localhost:3000",
      configuredOrigin: stale,
      trustBrowserHost: true,
    })).toBe(current);
    expect(publicRequestOrigin({
      originHeader: current,
      nextOrigin: "http://localhost:3000",
      configuredOrigin: stale,
    })).toBe(stale);
    expect(publicRequestOrigin({
      originHeader: "http://127.0.0.1:3000",
      nextOrigin: "http://localhost:3000",
      configuredOrigin: stale,
    })).toBe("http://127.0.0.1:3000");
    expect(publicRequestOrigin({
      originHeader: "https://evil.example",
      nextOrigin: "http://localhost:3000",
      configuredOrigin: stale,
      trustBrowserHost: true,
    })).toBe(stale);
    expect(fileUrlOnPage(file, current)).toBe(`${current}/api/documents/d1/file/plan.pdf?open=tok`);
    expect(fileUrlOnPage("/api/documents/d1/file", current)).toBe(`${current}/api/documents/d1/file`);
    expect(fileUrlOnPage("https://evil.example/elsewhere", current)).toBe("https://evil.example/elsewhere");
  });

  it("serves a PDF inline and does not force a Word file to download on the open path", () => {
    expect(desktopOpenHeaders("Offerte.pdf", "application/octet-stream")).toEqual({
      contentType: "application/pdf",
      inline: true,
    });
    expect(desktopOpenHeaders("plan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toEqual({
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      inline: true,
    });
    expect(desktopOpenHeaders("prijzen.xlsx", null)?.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(desktopOpenHeaders("deck.pptx", null)?.inline).toBe(true);
    expect(desktopOpenHeaders("foto.png", "image/png; charset=binary")?.contentType).toBe("image/png");
    expect(desktopOpenHeaders("notities.txt", "text/plain")).toBeNull();
    expect(desktopOpenHeaders("logo.svg", "image/svg+xml")).toBeNull();
  });
});

describe("open token", () => {
  const secret = process.env.BETTER_AUTH_SECRET;
  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = "test-open-token-secret";
  });
  afterAll(() => {
    if (secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = secret;
  });

  it("accepts one file until it expires, and no other file", () => {
    const now = 1_700_000_000_000;
    const token = signOpenToken("document", "d1", now);
    expect(verifyOpenToken(token, "document", "d1", now + 1000)).toBe(true);
    expect(verifyOpenToken(token, "document", "d2", now + 1000)).toBe(false);
    expect(verifyOpenToken(token, "attachment", "d1", now + 1000)).toBe(false);
    expect(verifyOpenToken(token, "document", "d1", now + OPEN_TOKEN_TTL_MS + 1)).toBe(false);
    expect(verifyOpenToken(`${token}x`, "document", "d1", now + 1000)).toBe(false);
    expect(verifyOpenToken("not-a-token", "document", "d1", now)).toBe(false);
  });
});
