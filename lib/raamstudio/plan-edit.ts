import type { NormRect } from "@/lib/raamstudio/workspace-model";

/** Corners first, then edges, so a corner grab never becomes an edge drag. */
export const FRAME_HANDLES = ["nw", "ne", "se", "sw", "n", "e", "s", "w"] as const;
export type FrameHandle = (typeof FRAME_HANDLES)[number];

export type FrameMark = {
  kind: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export type FrameHit = { index: number; handle: FrameHandle | null };

const MIN_SIDE = 0.02;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

export function handlePoint(rect: NormRect, handle: FrameHandle): { x: number; y: number } {
  const midX = rect.x + rect.w / 2;
  const midY = rect.y + rect.h / 2;
  const x = handle === "nw" || handle === "w" || handle === "sw"
    ? rect.x
    : handle === "ne" || handle === "e" || handle === "se"
      ? rect.x + rect.w
      : midX;
  const y = handle === "nw" || handle === "n" || handle === "ne"
    ? rect.y
    : handle === "sw" || handle === "s" || handle === "se"
      ? rect.y + rect.h
      : midY;
  return { x, y };
}

function hasBox(mark: FrameMark): mark is FrameMark & { w: number; h: number } {
  return typeof mark.w === "number" && typeof mark.h === "number" && mark.w > 0 && mark.h > 0;
}

function inside(mark: FrameMark & { w: number; h: number }, point: { x: number; y: number }) {
  return point.x >= mark.x && point.x <= mark.x + mark.w && point.y >= mark.y && point.y <= mark.y + mark.h;
}

/**
 * The topmost frame under the pointer.
 * A handle wins over the body. Drawings are ignored while placing an opening or a facade number,
 * so a click there still starts that mark. Empty paper returns null.
 */
export function hitFrame(
  marks: readonly FrameMark[],
  point: { x: number; y: number },
  mode: "draw" | "opening" | "facade" | "inspect",
  tolerance: { x: number; y: number },
): FrameHit | null {
  for (let index = marks.length - 1; index >= 0; index -= 1) {
    const mark = marks[index];
    if ((mode === "opening" || mode === "facade") && mark.kind === "drawing") continue;
    if (hasBox(mark)) {
      const rect = { x: mark.x, y: mark.y, w: mark.w, h: mark.h };
      for (const handle of FRAME_HANDLES) {
        const at = handlePoint(rect, handle);
        if (Math.abs(point.x - at.x) <= tolerance.x && Math.abs(point.y - at.y) <= tolerance.y) {
          return { index, handle };
        }
      }
      if (inside(mark, point)) return { index, handle: null };
      continue;
    }
    const dx = point.x - mark.x;
    const dy = point.y - mark.y;
    if (dx * dx + dy * dy <= 0.0012) return { index, handle: null };
  }
  return null;
}

/** Slide a frame. Width, height, name and type stay. The frame stays on the page. */
export function moveNormRect(origin: NormRect, dx: number, dy: number): NormRect {
  return {
    x: round4(clamp(origin.x + dx, 0, 1 - origin.w)),
    y: round4(clamp(origin.y + dy, 0, 1 - origin.h)),
    w: origin.w,
    h: origin.h,
  };
}

/** Pull one edge or corner. The opposite side stays. The frame never leaves the page. */
export function resizeNormRect(origin: NormRect, handle: FrameHandle, point: { x: number; y: number }): NormRect {
  let left = origin.x;
  let right = origin.x + origin.w;
  let top = origin.y;
  let bottom = origin.y + origin.h;
  const movesLeft = handle === "nw" || handle === "w" || handle === "sw";
  const movesRight = handle === "ne" || handle === "e" || handle === "se";
  const movesTop = handle === "nw" || handle === "n" || handle === "ne";
  const movesBottom = handle === "sw" || handle === "s" || handle === "se";
  if (movesLeft) left = clamp(point.x);
  if (movesRight) right = clamp(point.x);
  if (movesTop) top = clamp(point.y);
  if (movesBottom) bottom = clamp(point.y);
  if (left > right) [left, right] = [right, left];
  if (top > bottom) [top, bottom] = [bottom, top];
  if (right - left < MIN_SIDE) {
    if (movesLeft && !movesRight) left = Math.max(0, right - MIN_SIDE);
    else right = Math.min(1, left + MIN_SIDE);
    if (right - left < MIN_SIDE) {
      left = Math.max(0, Math.min(left, 1 - MIN_SIDE));
      right = left + MIN_SIDE;
    }
  }
  if (bottom - top < MIN_SIDE) {
    if (movesTop && !movesBottom) top = Math.max(0, bottom - MIN_SIDE);
    else bottom = Math.min(1, top + MIN_SIDE);
    if (bottom - top < MIN_SIDE) {
      top = Math.max(0, Math.min(top, 1 - MIN_SIDE));
      bottom = top + MIN_SIDE;
    }
  }
  return { x: round4(left), y: round4(top), w: round4(right - left), h: round4(bottom - top) };
}

/** A click on a clip, as a fraction of that clip, becomes a point on the full page. */
export function pagePointInClip(rect: NormRect, localX: number, localY: number): { x: number; y: number } {
  return {
    x: round4(clamp(rect.x + localX * rect.w)),
    y: round4(clamp(rect.y + localY * rect.h)),
  };
}

/** The same page point, measured inside the clip. Outside points stay outside. */
export function localPointInClip(rect: NormRect, x: number, y: number): { x: number; y: number; inside: boolean } {
  const localX = (x - rect.x) / rect.w;
  const localY = (y - rect.y) / rect.h;
  return {
    x: localX,
    y: localY,
    inside: localX >= -0.001 && localY >= -0.001 && localX <= 1.001 && localY <= 1.001,
  };
}

/** The next ground-plan number that is not on this facade or section yet. */
export function nextSharedNumber(numbers: readonly string[], used: ReadonlySet<string>): string | null {
  return numbers.find((number) => number.trim() && !used.has(number)) ?? null;
}

/** Move one block in a stack. Other blocks keep their name and type. */
export function reorderItems<T>(items: readonly T[], from: number, to: number): T[] {
  if (
    from === to
    || !Number.isInteger(from)
    || !Number.isInteger(to)
    || from < 0
    || to < 0
    || from >= items.length
    || to >= items.length
  ) {
    return items.slice();
  }
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
