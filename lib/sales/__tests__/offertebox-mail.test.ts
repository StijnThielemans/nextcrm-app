import { createRequire } from "node:module";
import { readFileSync } from "fs";
import path from "path";
import { SalesError } from "../errors";
import {
  displayMailHtml,
  imageContentType,
  parseOfferteboxMail,
  safeFileName,
  sanitizeMailHtml,
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

/** The same compound file, with an HTML body, one embedded PNG and one real attachment. */
function outlookMsgWithPicture(): Buffer {
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const html =
    '<html><body><p>Bekijk het raam.</p><img src="cid:raam@thielemans" alt="raam"><script>alert(1)</script></body></html>';
  const entries = [
    { name: "Root Entry", type: TypeEnum.ROOT, length: 0, children: [1, 2, 3, 4, 5, 6, 7, 13] },
    msgDocument("__properties_version1.0", new Uint8Array(32)),
    msgDocument("__substg1.0_0037001F", utf16("Raam met foto")),
    msgDocument("__substg1.0_0C1A001F", utf16("Jan Peeters")),
    msgDocument("__substg1.0_0C1F001F", utf16("jan@example.com")),
    msgDocument("__substg1.0_1000001F", utf16("Bekijk het raam.")),
    msgDocument("__substg1.0_1013001F", utf16(html)),
    { name: "__attach_version1.0_#00000000", type: TypeEnum.DIRECTORY, length: 0, children: [8, 9, 10, 11, 12] },
    msgDocument("__properties_version1.0", new Uint8Array(8)),
    msgDocument("__substg1.0_3707001F", utf16("raam.png")),
    msgDocument("__substg1.0_370E001F", utf16("image/png")),
    msgDocument("__substg1.0_3712001F", utf16("raam@thielemans")),
    msgDocument("__substg1.0_37010102", png),
    { name: "__attach_version1.0_#00000001", type: TypeEnum.DIRECTORY, length: 0, children: [14, 15, 16] },
    msgDocument("__properties_version1.0", new Uint8Array(8)),
    msgDocument("__substg1.0_3707001F", utf16("maten.txt")),
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
    expect(mail.html).toBe("");
    expect(mail.body).toContain("Gelieve een prijs te maken voor de ramen.");
    expect(mail.body).toContain("De breedte is 120 cm.");
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0]?.inline).toBe(false);
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
    expect(mail.html).toContain("Eerste alinea.");
    expect(mail.html).toContain("<p>");
    expect(mail.html).not.toContain("script");
    expect(mail.html).not.toContain("alert");
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
    expect(mail.html).toContain("Graag een prijs voor het raam.");
    expect(mail.html).not.toContain("<html");
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

  it("reads an .eml with no extension, a BOM, or UTF-16 headers", async () => {
    const text = "From: Jan Peeters <jan@example.com>\r\nSubject: Zonder extensie\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nTekst van de mail.\r\n";
    const plain = Buffer.from(text, "utf8");
    const dropped = await parseOfferteboxMail("Prijs ramen", plain, "message/rfc822");
    expect(dropped.fromName).toBe("Jan Peeters");
    expect(dropped.fromEmail).toBe("jan@example.com");
    expect(dropped.subject).toBe("Zonder extensie");
    expect(dropped.body).toContain("Tekst van de mail.");

    const onlyFrom = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("From: Jan Peeters <jan@example.com>\r\n\r\nAlleen afzender.\r\n", "utf8"),
    ]);
    const withBom = await parseOfferteboxMail("bom", onlyFrom, "");
    expect(withBom.fromEmail).toBe("jan@example.com");
    expect(withBom.body).toContain("Alleen afzender.");

    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    const wide = await parseOfferteboxMail("unicode", utf16, "");
    expect(wide.fromEmail).toBe("jan@example.com");
    expect(wide.subject).toBe("Zonder extensie");
    expect(wide.body).toContain("Tekst van de mail.");
  });

  it("reads an extensionless .eml when a binary attachment follows the headers", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const mail = await parseOfferteboxMail(
      "Prijs ramen",
      Buffer.concat([
        Buffer.from(
          "From: Jan Peeters <jan@example.com>\r\nSubject: Met bijlage\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=B\r\n\r\n--B\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nTekst van de mail.\r\n\r\n--B\r\nContent-Type: image/png\r\nContent-Disposition: attachment; filename=raam.png\r\n\r\n",
          "utf8",
        ),
        png,
        Buffer.from("\r\n--B--\r\n", "utf8"),
      ]),
      "",
    );
    expect(mail.fromEmail).toBe("jan@example.com");
    expect(mail.subject).toBe("Met bijlage");
    expect(mail.body).toContain("Tekst van de mail.");
    expect(mail.attachments[0]?.fileName).toBe("raam.png");
  });

  it("rejects a .msg name that is not a readable Outlook message", async () => {
    await expect(parseOfferteboxMail("leeg.msg", Buffer.from("geen outlook"))).rejects.toBeInstanceOf(SalesError);
  });

  it("keeps only the file name", () => {
    expect(safeFileName("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(safeFileName("")).toBe("bijlage");
  });

  it("shows an inline picture inside the mail and keeps the other file openable", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const mail = await parseOfferteboxMail(
      "raam.eml",
      rfc822(`From: Jan Peeters <jan@example.com>
To: offerte@thielemans.be
Subject: Raam met foto
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="MIX"
Date: Thu, 19 Nov 2026 09:00:00 +0100

--MIX
Content-Type: multipart/related; boundary="REL"

--REL
Content-Type: text/html; charset=utf-8

<html><body>
<p style="color: #123456; width: 40px; background-image: url(javascript:alert(1))">Gelieve dit raam te bekijken.</p>
<img src="cid:raam@thielemans" alt="raam" onerror="alert(1)">
<img src="https://example.com/gevel.jpg" alt="gevel">
<a href="javascript:alert(1)">klik</a>
<v:imagedata src="cid:raam@thielemans" />
</body></html>
--REL
Content-Type: image/png; name="raam.png"
Content-Transfer-Encoding: base64
Content-ID: <raam@thielemans>
Content-Disposition: inline; filename="raam.png"

${png.toString("base64")}
--REL--
--MIX
Content-Type: text/plain; name="maten.txt"
Content-Disposition: attachment; filename="maten.txt"

breedte 120
--MIX--
`),
    );
    const image = mail.attachments.find((item) => item.fileName === "raam.png");
    const file = mail.attachments.find((item) => item.fileName === "maten.txt");
    expect(image?.isImage).toBe(true);
    expect(image?.inline).toBe(true);
    expect(image?.contentId).toBe("raam@thielemans");
    expect(imageContentType(image?.bytes ?? Buffer.alloc(0))).toBe("image/png");
    expect(file?.inline).toBe(false);
    expect(file?.bytes.toString("utf8")).toContain("breedte 120");
    expect(mail.html).toContain("Gelieve dit raam te bekijken.");
    expect(mail.html).toContain("https://example.com/gevel.jpg");
    expect(mail.html.toLowerCase()).not.toContain("javascript:");
    expect(mail.html.toLowerCase()).not.toContain("onerror");
    expect(mail.html.toLowerCase()).not.toContain("alert");
    expect(mail.html).toContain("color:#123456");
    expect(mail.html).not.toContain("background-image");
    const shown = displayMailHtml(mail.html, [
      { id: "11111111-1111-4111-8111-111111111111", contentId: image?.contentId ?? "", isImage: true },
    ]);
    expect(shown).toContain("/api/crm/offertebox/attachments/11111111-1111-4111-8111-111111111111");
    expect(shown.toLowerCase()).not.toContain("cid:");
  });

  it("keeps a separate image attachment in the list and also in the body when the mail refers to it", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const mail = await parseOfferteboxMail(
      "beide.eml",
      rfc822(`From: Jan Peeters <jan@example.com>
Subject: Beide
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="MIX"

--MIX
Content-Type: text/html; charset=utf-8

<p>Foto van het raam.</p><img src="cid:foto@thielemans" alt="foto">
--MIX
Content-Type: image/png; name="foto.png"
Content-Transfer-Encoding: base64
Content-ID: <foto@thielemans>
Content-Disposition: attachment; filename="foto.png"

${png.toString("base64")}
--MIX--
`),
    );
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0]?.inline).toBe(false);
    expect(mail.attachments[0]?.isImage).toBe(true);
    const shown = displayMailHtml(mail.html, [
      { id: "22222222-2222-4222-8222-222222222222", contentId: "foto@thielemans", isImage: true },
    ]);
    expect(shown).toContain("/api/crm/offertebox/attachments/22222222-2222-4222-8222-222222222222");
  });

  it("reads an embedded Outlook picture and a separate attachment", async () => {
    const mail = await parseOfferteboxMail("raam.msg", outlookMsgWithPicture(), "application/vnd.ms-outlook");
    expect(mail.subject).toBe("Raam met foto");
    expect(mail.fromEmail).toBe("jan@example.com");
    expect(mail.body).toContain("Bekijk het raam.");
    expect(mail.html).toContain("Bekijk het raam.");
    expect(mail.html.toLowerCase()).not.toContain("<script");
    expect(mail.html.toLowerCase()).toContain("cid:raam@thielemans");
    const image = mail.attachments.find((item) => item.isImage);
    const file = mail.attachments.find((item) => item.fileName === "maten.txt");
    expect(image?.inline).toBe(true);
    expect(image?.contentId).toBe("raam@thielemans");
    expect(imageContentType(image?.bytes ?? Buffer.alloc(0))).toBe("image/png");
    expect(file?.inline).toBe(false);
    expect(file?.bytes.toString("utf8")).toBe("breedte 120");
    const shown = displayMailHtml(mail.html, [
      { id: "33333333-3333-4333-8333-333333333333", contentId: image?.contentId ?? "", isImage: true },
    ]);
    expect(shown).toContain("/api/crm/offertebox/attachments/33333333-3333-4333-8333-333333333333");
    expect(shown.toLowerCase()).not.toContain("cid:");
  });

  it("keeps a stored raster data image and drops svg and javascript", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const html = sanitizeMailHtml(
      `<p>Foto</p><img src="${png}" alt="raam"><img src="data:image/svg+xml;base64,PHN2Zy8+" alt="tekening"><img src="javascript:alert(1)">`,
    );
    expect(html).toContain(png);
    expect(html.toLowerCase()).not.toContain("svg+xml");
    expect(html.toLowerCase()).not.toContain("javascript:");
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
