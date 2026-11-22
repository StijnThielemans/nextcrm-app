import { pdfFromJpegs, sheetsForPreview } from "../sheet-pdf";

const jpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCf/9k=",
  "base64",
);

describe("facade pdf", () => {
  it("puts each facade picture on its own page", () => {
    const pdf = pdfFromJpegs([
      { jpeg, width: 1, height: 1 },
      { jpeg, width: 2, height: 1 },
    ]);
    const text = Buffer.from(pdf).toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(text).toContain("%%EOF");
    expect(Buffer.from(pdf).includes(jpeg)).toBe(true);
  });

  it("keeps numbered ground plans and facades, and leaves out a missing set", () => {
    const ground = [{ jpeg, width: 3, height: 2 }];
    const facades = [
      { jpeg, width: 2, height: 1 },
      { jpeg, width: 4, height: 2 },
    ];
    const both = sheetsForPreview(ground, facades);
    expect(both).toEqual([...ground, ...facades]);
    expect(pdfFromJpegs(both).length).toBeGreaterThan(0);
    expect(sheetsForPreview(ground, [])).toEqual(ground);
    expect(sheetsForPreview([], facades)).toEqual(facades);
    expect(() => sheetsForPreview([], [])).toThrow("Geen plan om te tonen.");
  });
});