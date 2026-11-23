import { pageImageFit } from "../sheet-pdf";
import { numberMarkBox, PRINTED_NUMBER_PT } from "../print-marks";

describe("printed raamnummer", () => {
  it("keeps the centre and draws a small circle on a narrow ground-plan card", () => {
    const imageW = 3980;
    const bar = Math.round(22 * (imageW / 264));
    const imageH = 4096 + bar;
    const fit = pageImageFit(imageW, imageH);
    const imageScale = imageW / 264;
    const centerX = 1400;
    const centerY = 2100;
    const box = numberMarkBox({
      centerX,
      centerY,
      cssWidth: 28,
      cssHeight: 28,
      imageScale,
      fit,
    });

    expect(box.x + box.width / 2).toBeCloseTo(centerX, 5);
    expect(box.y + box.height / 2).toBeCloseTo(centerY, 5);
    expect(box.width / imageW).toBeGreaterThan(0.025);
    expect(box.width / imageW).toBeLessThan(0.04);
    expect(box.width).toBeLessThan(28 * imageScale * 0.4);
    expect(box.width * fit).toBeCloseTo(PRINTED_NUMBER_PT, 5);
  });

  it("stays the on-screen size when the plan is already shown wide", () => {
    const imageW = 3980;
    const imageScale = imageW / 886;
    const bar = Math.round(22 * imageScale);
    const fit = pageImageFit(imageW, 4096 + bar);
    const screen = 28 * imageScale;
    const box = numberMarkBox({
      centerX: 500,
      centerY: 500,
      cssWidth: 28,
      cssHeight: 28,
      imageScale,
      fit,
    });

    expect(box.width).toBeLessThanOrEqual(screen + 0.01);
    expect(box.width / screen).toBeGreaterThan(0.9);
  });

  it("draws the same small circle on a wide facade, not the card button", () => {
    const imageW = 4096;
    const imageScale = imageW / 534;
    const bar = Math.round(22 * imageScale);
    const fit = pageImageFit(imageW, 1503 + bar);
    const box = numberMarkBox({
      centerX: 800,
      centerY: 400,
      cssWidth: 28,
      cssHeight: 28,
      imageScale,
      fit,
    });

    expect(box.width * fit).toBeCloseTo(PRINTED_NUMBER_PT, 5);
    expect(box.width / imageW).toBeLessThan(0.03);
    expect(box.height / 1503).toBeLessThan(0.07);
  });

  it("keeps a wider label centred and does not grow past the card", () => {
    const box = numberMarkBox({
      centerX: 200,
      centerY: 80,
      cssWidth: 40,
      cssHeight: 28,
      imageScale: 2,
      fit: 0.05,
    });

    expect(box.x + box.width / 2).toBeCloseTo(200, 5);
    expect(box.y + box.height / 2).toBeCloseTo(80, 5);
    expect(box.width).toBeCloseTo(40 * 2, 5);
    expect(box.height).toBeCloseTo(28 * 2, 5);
    expect(box.width / box.height).toBeCloseTo(40 / 28, 5);
  });
});
