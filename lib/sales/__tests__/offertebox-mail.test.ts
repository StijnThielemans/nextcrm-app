import { SalesError } from "../errors";
import {
  imageContentType,
  parseOfferteboxMail,
  safeFileName,
} from "../offertebox-mail";

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

  it("rejects a file that is not a mail", async () => {
    await expect(parseOfferteboxMail("plan.pdf", Buffer.from("%PDF-1.4 fake"))).rejects.toBeInstanceOf(SalesError);
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
