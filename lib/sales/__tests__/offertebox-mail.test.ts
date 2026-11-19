import { createRequire } from "node:module";
import { readFileSync } from "fs";
import path from "path";
import { SalesError } from "../errors";
import {
  imageContentType,
  parseOfferteboxMail,
  safeFileName,
} from "../offertebox-mail";

const nodeRequire = createRequire(__filename);
const { burn } = nodeRequire("@kenjiuno/msgreader/lib/Burner.js") as {
  burn: (entries: Array<Record<string, unknown>>) => Uint8Array;
};
const { TypeEnum } = nodeRequire("@kenjiuno/msgreader/lib/Reader.js") as {
  TypeEnum: { ROOT: number; DOCUMENT: number; DIRECTORY: number };
};

function utf16(text: string): Uint8Array {
  return Uint8Array.from(Buffer.from(`${text}\0`, "utf16le"));
}

function msgDocument(name: string, bytes: Uint8Array) {
  return { name, type: TypeEnum.DOCUMENT, binaryProvider: () => bytes, length: bytes.length };
}

/** A real OLE compound file, the same container Outlook writes for a .msg drop. */
function outlookMsg(): Buffer {
  const entries = [
    { name: "Root Entry", type: TypeEnum.ROOT, length: 0, children: [1, 2, 3, 4, 5, 6] },
    msgDocument("__properties_version1.0", new Uint8Array(32)),
    msgDocument("__substg1.0_0037001F", utf16("Prijs voor ramen")),
    msgDocument("__substg1.0_0C1A001F", utf16("Jan Peeters")),
    msgDocument("__substg1.0_0C1F001F", utf16("jan@example.com")),
    msgDocument("__substg1.0_1000001F", utf16("Gelieve een prijs te maken voor de ramen.")),
    { name: "__attach_version1.0_#00000000", type: TypeEnum.DIRECTORY, length: 0, children: [7, 8, 9] },
    msgDocument("__properties_version1.0", new Uint8Array(8)),
    msgDocument("__substg1.0_3707001F", utf16("../../maten.txt")),
    msgDocument("__substg1.0_37010102", Uint8Array.from(Buffer.from("breedte 120", "utf8"))),
  ];
  return Buffer.from(burn(entries));
}

function rfc822(text: string): Buffer {
  return Buffer.from(text.replace(/\n/g, "\r\n"));
}

const MAIL = `From: Jan Peeters <jan@example.com>
To: offerte@thielemans.be
Subject: Prijs voor ramen
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary=BOUND
Date: Thu, 19 Nov 2026 09:00:00 +0100

--BOUND
Content-Type: text/plain; charset=utf-8

Gelieve een prijs te maken voor de ramen.
De breedte is 120 cm.

--BOUND
Content-Type: text/plain; name="maten.txt"
Content-Disposition: attachment; filename="../../maten.txt"

breedte 120
--BOUND--
`;

describe("offertebox mail", () => {
  it("reads the text and the attachment name from an .eml", async () => {
    const mail = await parseOfferteboxMail("aanvraag.eml", rfc822(MAIL));
    expect(mail.fromName).toBe("Jan Peeters");
    expect(mail.fromEmail).toBe("jan@example.com");
    expect(mail.subject).toBe("Prijs voor ramen");
    expect(mail.body).toContain("Gelieve een prijs te maken voor de ramen.");
    expect(mail.body).toContain("De breedte is 120 cm.");
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0]?.fileName).toBe("maten.txt");
    expect(mail.attachments[0]?.bytes.toString("utf8")).toContain("breedte 120");
  });

  it("turns an html-only mail into readable text", async () => {
    const mail = await parseOfferteboxMail(
      "html.eml",
      rfc822(`From: A <a@example.com>
Subject: HTML
MIME-Version: 1.0
Content-Type: text/html; charset=utf-8

<p>Eerste alinea.</p><p>Tweede alinea.</p><script>alert(1)</script>
`),
    );
    expect(mail.body).toContain("Eerste alinea.");
    expect(mail.body).toContain("Tweede alinea.");
    expect(mail.body).not.toContain("alert");
  });

  it("reads an Outlook .msg, including one dropped without an extension", async () => {
    const bytes = readFileSync(path.join(__dirname, "fixtures/outlook-attachment.msg"));
    const named = await parseOfferteboxMail("Prijs ramen.msg", bytes, "application/vnd.ms-outlook");
    const unnamed = await parseOfferteboxMail("Prijs ramen", bytes, "");
    expect(named.subject).toBe("attachmentFiles");
    expect(named.fromName).toBe("hmailuser");
    expect(named.fromEmail).toBe("hmailuser@hmailserver.test");
    expect(named.body).toContain("attachmentFiles");
    expect(named.attachments.map((item) => item.fileName).sort()).toEqual(["jpg.jpg", "png.png", "tif.tif"]);
    expect(unnamed.subject).toBe(named.subject);
    expect(unnamed.attachments).toHaveLength(3);
  });

  it("reads a plain Outlook message", async () => {
    const bytes = readFileSync(path.join(__dirname, "fixtures/outlook-simple.msg"));
    const mail = await parseOfferteboxMail("bericht.msg", bytes);
    expect(mail.subject).toBe("Simple");
    expect(mail.body).toContain("Simple");
  });

  it("keeps the text when Outlook drops HTML under a .msg name", async () => {
    const html = Buffer.from("<html><body><p>Graag een prijs voor het raam.</p></body></html>", "utf8");
    const mail = await parseOfferteboxMail("Ramen keuken.msg", html, "application/octet-stream");
    expect(mail.subject).toBe("Ramen keuken");
    expect(mail.body).toContain("Graag een prijs voor het raam.");
  });

  it("rejects a file that is not a mail", async () => {
    await expect(parseOfferteboxMail("plan.pdf", Buffer.from("%PDF-1.4 fake"))).rejects.toBeInstanceOf(SalesError);
  });

  it("reads subject, sender, body and the attachment from an Outlook .msg", async () => {
    const bytes = outlookMsg();
    expect(bytes.subarray(0, 4).toString("hex")).toBe("d0cf11e0");
    const mail = await parseOfferteboxMail("aanvraag.msg", bytes, "application/octet-stream");
    expect(mail.fromName).toBe("Jan Peeters");
    expect(mail.fromEmail).toBe("jan@example.com");
    expect(mail.subject).toBe("Prijs voor ramen");
    expect(mail.body).toContain("Gelieve een prijs te maken voor de ramen.");
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0]?.fileName).toBe("maten.txt");
    expect(mail.attachments[0]?.bytes.toString("utf8")).toBe("breedte 120");
  });

  it("accepts an Outlook item with no extension when the file is a compound document", async () => {
    const mail = await parseOfferteboxMail("outlook-item", outlookMsg(), "");
    expect(mail.subject).toBe("Prijs voor ramen");
    expect(mail.attachments[0]?.fileName).toBe("maten.txt");
  });

  it("accepts the Outlook MIME type", async () => {
    const mail = await parseOfferteboxMail("bericht", outlookMsg(), "application/vnd.ms-outlook");
    expect(mail.fromEmail).toBe("jan@example.com");
  });

  it("rejects a .msg name that is not a readable Outlook message", async () => {
    await expect(parseOfferteboxMail("leeg.msg", Buffer.from("geen outlook"))).rejects.toBeInstanceOf(SalesError);
  });

  it("keeps only the file name", () => {
    expect(safeFileName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(safeFileName("")).toBe("bijlage");
  });

  it("recognises a png and ignores svg", () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    expect(imageContentType(png)).toBe("image/png");
    expect(imageContentType(Buffer.from("<svg><script>alert(1)</script></svg>"))).toBeNull();
  });
});
