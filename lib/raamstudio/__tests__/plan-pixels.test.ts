import { bucketPlanPixels, planBitmapLongest, planViewPixels } from "../plan-pixels";

describe("planBitmapLongest", () => {
  it("covers the CSS sheet at two device pixels, including a tall page", () => {
    expect(planBitmapLongest({
      sheetCssWidth: 800,
      pageWidth: 2000,
      pageHeight: 1000,
      rotation: 0,
      pixelRatio: 1,
    })).toBe(1600);

    expect(planBitmapLongest({
      sheetCssWidth: 800,
      pageWidth: 1000,
      pageHeight: 2000,
      rotation: 0,
      pixelRatio: 2,
    })).toBe(3200);
  });

  it("asks for a larger raster when a wide page is turned on its side", () => {
    expect(planBitmapLongest({
      sheetCssWidth: 800,
      pageWidth: 2000,
      pageHeight: 1000,
      rotation: 90,
      pixelRatio: 2,
    })).toBe(3200);

    expect(planBitmapLongest({
      sheetCssWidth: 800,
      pageWidth: 1000,
      pageHeight: 2000,
      rotation: 270,
      pixelRatio: 2,
    })).toBe(1600);
  });

  it("draws a clip at least at the sharp floor, and larger when the sheet or the zoom grows", () => {
    expect(planViewPixels(240, 2)).toBe(4096);
    expect(planViewPixels(1, 1)).toBe(4096);
    expect(planViewPixels(1800, 3)).toBe(5400);
  });

  it("rounds the requested side up into a cache bucket and never past the cap", () => {
    expect(bucketPlanPixels(1800)).toBe(2048);
    expect(bucketPlanPixels(2048)).toBe(2048);
    expect(bucketPlanPixels(20_000)).toBe(8192);
    expect(bucketPlanPixels(Number.NaN)).toBe(4096);
  });
});
