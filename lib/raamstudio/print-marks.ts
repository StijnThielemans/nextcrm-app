/**
 * A raamnummer on screen is the h-7 circle, 28px.
 * On the wide ground plan that circle is a small mark beside the opening.
 * The print keeps that weight: 16pt on the landscape page.
 * A narrow sidebar card must not blow the same circle up across the plan.
 */

export const PRINTED_NUMBER_PT = 16;

export function numberMarkBox(input: {
  centerX: number;
  centerY: number;
  cssWidth: number;
  cssHeight: number;
  imageScale: number;
  fit: number;
}): { x: number; y: number; width: number; height: number } {
  const screenW = Math.max(0, input.cssWidth) * input.imageScale;
  const screenH = Math.max(0, input.cssHeight) * input.imageScale;
  const target = input.fit > 0 ? PRINTED_NUMBER_PT / input.fit : Math.min(screenW, screenH);
  const aspect = input.cssWidth / Math.max(input.cssHeight, 1);
  let width = target * Math.max(1, aspect);
  let height = target;
  const limit = Math.min(
    width > 0 && screenW > 0 ? screenW / width : 1,
    height > 0 && screenH > 0 ? screenH / height : 1,
  );
  if (limit < 1) {
    width *= limit;
    height *= limit;
  }
  return {
    x: input.centerX - width / 2,
    y: input.centerY - height / 2,
    width,
    height,
  };
}
