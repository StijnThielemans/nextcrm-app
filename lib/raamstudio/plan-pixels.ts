/** At least two device pixels per CSS pixel, so a fit plan stays sharp on a normal screen. */
export const PLAN_PIXEL_RATIO_MIN = 2;

export const PLAN_MIN_PIXELS = 512;
export const PLAN_MAX_PIXELS = 8192;

const PLAN_PIXEL_STEP = 256;

export function clampPlanPixels(value: number): number {
  if (!Number.isFinite(value)) return 4096;
  return Math.min(PLAN_MAX_PIXELS, Math.max(PLAN_MIN_PIXELS, Math.round(value)));
}

/** Round up so a cached render is never smaller than the pixels on screen. */
export function bucketPlanPixels(value: number): number {
  const clamped = clampPlanPixels(value);
  const stepped = Math.ceil(clamped / PLAN_PIXEL_STEP) * PLAN_PIXEL_STEP;
  return Math.min(PLAN_MAX_PIXELS, stepped);
}

/**
 * Longest side of the raster, in pixels, for one PDF page.
 * The page is drawn unrotated and then turned with CSS, so a quarter turn
 * maps the page height onto the sheet width and needs a larger raster.
 */
export function planBitmapLongest(input: {
  sheetCssWidth: number;
  pageWidth: number;
  pageHeight: number;
  rotation: number;
  pixelRatio: number;
}): number {
  const sheet = Number.isFinite(input.sheetCssWidth) ? Math.max(1, input.sheetCssWidth) : 1;
  const ratio = Math.max(
    PLAN_PIXEL_RATIO_MIN,
    Number.isFinite(input.pixelRatio) ? input.pixelRatio : PLAN_PIXEL_RATIO_MIN,
  );
  const pageW = input.pageWidth > 0 ? input.pageWidth : 1;
  const pageH = input.pageHeight > 0 ? input.pageHeight : 1;
  const turns = ((Math.round(input.rotation) % 360) + 360) % 360;
  const quarter = turns % 180 !== 0;
  const longOverMapped = quarter ? Math.max(pageW, pageH) / pageH : Math.max(pageW, pageH) / pageW;
  return Math.ceil(sheet * ratio * longOverMapped);
}
