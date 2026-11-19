import { attachmentOpensInline, inlineAttachmentType, mailPanelBody, pdfBytes } from "../aanvraag-mail";

describe("aanvraag mail beside the form", () => {
  it("opens a pdf and an image in the page, and downloads the rest", () => {
    expect(attachmentOpensInline("UV Kevin.pdf", "application/pdf", false)).toBe("pdf");
    expect(attachmentOpensInline("foto.png", "application/octet-stream", true)).toBe("image");
    expect(attachmentOpensInline("plan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", false)).toBeNull();
    expect(attachmentOpensInline("logo.svg", "image/svg+xml", false)).toBeNull();
  });

  it("treats a real pdf as inline and leaves other bytes as a download", () => {
    const pdf = Buffer.from("%PDF-1.7\n");
    expect(pdfBytes(pdf)).toBe(true);
    expect(inlineAttachmentType(null, pdf)).toBe("application/pdf");
    expect(inlineAttachmentType(null, Buffer.from("geen pdf"))).toBeNull();
    expect(inlineAttachmentType("image/png", Buffer.from("x"))).toBe("image/png");
  });

  it("shows stored html, and plain text when the mail has no html", () => {
    expect(mailPanelBody("<p>Kevin Van Der Plas</p>", "Kevin Van Der Plas")).toEqual({
      kind: "html",
      value: "<p>Kevin Van Der Plas</p>",
    });
    expect(mailPanelBody("", "Beste,\n\nPrijsvraag buitenschrijnwerk")).toEqual({
      kind: "text",
      value: "Beste,\n\nPrijsvraag buitenschrijnwerk",
    });
    expect(mailPanelBody("   ", "")).toEqual({ kind: "empty", value: "" });
  });
});
