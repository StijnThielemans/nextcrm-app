"use client";

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { bucketPlanPixels, planBitmapLongest } from "@/lib/raamstudio/plan-pixels";
import type { NormRect } from "@/lib/raamstudio/workspace-model";

export type SheetMark = {
  id: string;
  kind: "drawing" | "opening" | "facade";
  label: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export type SheetPlace =
  | { kind: "point"; x: number; y: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number };

type Point = { x: number; y: number };
type Mode = "draw" | "opening" | "facade" | "inspect";
type Drag =
  | { kind: "new"; start: Point; current: Point }
  | { kind: "move"; id: string; start: Point; origin: SheetMark; current: Point };

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function clampZoom(value: number) {
  return clamp(Math.round(value * 100) / 100, MIN_ZOOM, MAX_ZOOM);
}

function labelPoint(mark: SheetMark): Point {
  if (mark.w && mark.h) return { x: mark.x + Math.min(0.03, mark.w / 2), y: mark.y + Math.min(0.025, mark.h / 2) };
  return { x: mark.x, y: mark.y };
}

function near(mark: SheetMark, point: Point): boolean {
  const label = labelPoint(mark);
  const dx = point.x - label.x;
  const dy = point.y - label.y;
  if (dx * dx + dy * dy <= 0.0012) return true;
  if (mark.kind === "drawing" || !mark.w || !mark.h) return false;
  return point.x >= mark.x && point.x <= mark.x + mark.w && point.y >= mark.y && point.y <= mark.y + mark.h;
}

function hit(marks: SheetMark[], point: Point, mode: Mode): SheetMark | null {
  for (let index = marks.length - 1; index >= 0; index -= 1) {
    const mark = marks[index];
    if ((mode === "opening" || mode === "facade") && mark.kind === "drawing") continue;
    if (near(mark, point)) return mark;
    if (mode === "draw" && mark.kind === "drawing" && mark.w && mark.h
      && point.x >= mark.x && point.x <= mark.x + mark.w && point.y >= mark.y && point.y <= mark.y + mark.h) {
      return mark;
    }
  }
  return null;
}

export function PlanSheet({
  planId,
  planName,
  pdf,
  page,
  mode,
  marks,
  selectedId,
  pending,
  rotation = 0,
  onPageCount,
  onSelect,
  onPlace,
  onPending,
  onMove,
  onRotate,
}: {
  planId: string;
  planName: string;
  pdf: boolean;
  page: number;
  mode: Mode;
  marks: SheetMark[];
  selectedId: string | null;
  pending: NormRect | null;
  /** Clockwise degrees already stored for this PDF page: 0, 90, 180 or 270. */
  rotation?: number;
  onPageCount: (count: number) => void;
  onSelect: (id: string | null) => void;
  onPlace: (place: SheetPlace) => void;
  onPending: (rect: NormRect) => void;
  onMove: (id: string, next: { x: number; y: number; w?: number; h?: number }) => void;
  onRotate?: (delta: 90 | -90) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const zoomIdentity = `${planId}:${page}:${rotation}`;
  const [zoomFor, setZoomFor] = useState(zoomIdentity);
  const [zoomState, setZoom] = useState(1);
  if (zoomFor !== zoomIdentity) {
    setZoomFor(zoomIdentity);
    setZoom(1);
  }
  const zoom = zoomFor === zoomIdentity ? zoomState : 1;
  const [drag, setDrag] = useState<(Drag & { key: string }) | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [aspect, setAspect] = useState<{ key: string; w: number; h: number } | null>(null);
  const [shown, setShown] = useState<ShownPdf | null>(null);
  const reportPages = useRef(onPageCount);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const shownRef = useRef<ShownPdf | null>(null);
  const attempts = useRef(new Map<string, number>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<{ fracX: number; fracY: number; clientX: number; clientY: number } | null>(null);
  const requestKey = `${pdf ? "pdf" : "img"}:${planId}:${page}`;
  const knownAspect = aspect?.key === requestKey ? aspect : null;
  const pixelRatio = Math.max(2, typeof window === "undefined" ? 2 : window.devicePixelRatio || 1);
  const wanted = bucketPlanPixels(planBitmapLongest({
    sheetCssWidth: Math.max(1, viewportWidth) * zoom,
    pageWidth: knownAspect?.w ?? 1,
    pageHeight: knownAspect?.h ?? 1.42,
    rotation,
    pixelRatio,
  }));
  const pdfShown = shown?.pageKey === requestKey ? shown : null;
  const status = pdf
    ? (pdfShown ? "ready" : failedKey === requestKey ? "error" : "loading")
    : (loadedKey === requestKey ? "ready" : failedKey === requestKey ? "error" : "loading");
  const activeDrag = drag?.key === requestKey ? drag : null;

  useEffect(() => {
    reportPages.current = onPageCount;
  }, [onPageCount]);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => {
      const next = node.clientWidth;
      setViewportWidth((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (pdf) return;
    const controller = new AbortController();
    const key = requestKey;
    void (async () => {
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;
        reportPages.current(1);
        setSrc(`/api/documents/${planId}/file`);
        setLoadedKey(key);
      } catch {
        if (!controller.signal.aborted) setFailedKey(key);
      }
    })();
    return () => controller.abort();
  }, [planId, pdf, requestKey]);

  useEffect(() => {
    if (!pdf || viewportWidth < 32) return;
    const pageKey = requestKey;
    const px = wanted;
    const current = shownRef.current;
    if (current?.pageKey === pageKey && current.longest + 4 >= px) return;
    const attemptKey = `${pageKey}:${px}`;
    if ((attempts.current.get(attemptKey) ?? 0) >= 2) return;

    const controller = new AbortController();
    const delay = current?.pageKey === pageKey ? 180 : 0;
    const timer = window.setTimeout(() => {
      attempts.current.set(attemptKey, (attempts.current.get(attemptKey) ?? 0) + 1);
      void loadPdf(controller.signal, pageKey, px);
    }, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };

    async function loadPdf(signal: AbortSignal, key: string, pixels: number) {
      try {
        const response = await fetch(
          `/api/crm/raamstudio/plan-page?documentId=${encodeURIComponent(planId)}&page=${page + 1}&px=${pixels}`,
          { signal },
        );
        if (!response.ok) throw new Error("render");
        const pages = Number(response.headers.get("X-Plan-Pages") || "1");
        const bitmap = await createImageBitmap(await response.blob());
        if (signal.aborted) {
          bitmap.close();
          return;
        }
        const previous = bitmapRef.current;
        bitmapRef.current = bitmap;
        previous?.close();
        const longest = Math.max(bitmap.width, bitmap.height);
        const next: ShownPdf = {
          pageKey: key,
          width: bitmap.width,
          height: bitmap.height,
          longest,
          paintId: (shownRef.current?.paintId ?? 0) + 1,
        };
        shownRef.current = next;
        setShown(next);
        setAspect((known) => {
          if (known?.key === key && Math.abs(known.w / known.h - bitmap.width / bitmap.height) < 0.002) return known;
          return { key, w: bitmap.width, h: bitmap.height };
        });
        reportPages.current(Number.isFinite(pages) && pages > 0 ? pages : 1);
        setFailedKey((failed) => (failed === key ? null : failed));
      } catch {
        if (!signal.aborted && shownRef.current?.pageKey !== key) setFailedKey(key);
      }
    }
  }, [pdf, planId, page, requestKey, wanted, viewportWidth]);

  useEffect(() => () => {
    bitmapRef.current?.close();
    bitmapRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    const sheet = sheetRef.current;
    if (!anchor || !sheet) return;
    const frame = requestAnimationFrame(() => {
      const current = sheetRef.current;
      const point = zoomAnchor.current;
      zoomAnchor.current = null;
      if (!current || !point) return;
      const next = current.getBoundingClientRect();
      scrollByDelta(current, next.left + point.fracX * next.width - point.clientX, next.top + point.fracY * next.height - point.clientY);
    });
    return () => cancelAnimationFrame(frame);
  }, [zoom]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY || event.buttons !== 0) return;
      const sheet = sheetRef.current;
      if (!sheet) return;
      event.preventDefault();
      const before = sheet.getBoundingClientRect();
      const fracX = (event.clientX - before.left) / Math.max(1, before.width);
      const fracY = (event.clientY - before.top) / Math.max(1, before.height);
      const clientX = event.clientX;
      const clientY = event.clientY;
      setZoom((current) => {
        const next = clampZoom(current * Math.exp(-event.deltaY * 0.0015));
        if (next === current) return current;
        zoomAnchor.current = { fracX, fracY, clientX, clientY };
        return next;
      });
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  function pointOf(event: ReactPointerEvent<HTMLDivElement>): Point {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - box.left) / Math.max(1, box.width)),
      y: clamp((event.clientY - box.top) / Math.max(1, box.height)),
    };
  }

  function shownMarks(): SheetMark[] {
    if (!activeDrag || activeDrag.kind !== "move") return marks;
    const dx = activeDrag.current.x - activeDrag.start.x;
    const dy = activeDrag.current.y - activeDrag.start.y;
    return marks.map((mark) => {
      if (mark.id !== activeDrag.id) return mark;
      if (mark.w && mark.h) {
        return {
          ...mark,
          x: clamp(activeDrag.origin.x + dx, 0, 1 - mark.w),
          y: clamp(activeDrag.origin.y + dy, 0, 1 - mark.h),
        };
      }
      return { ...mark, x: clamp(activeDrag.origin.x + dx), y: clamp(activeDrag.origin.y + dy) };
    });
  }

  const rubber = activeDrag?.kind === "new"
    ? {
        x: Math.min(activeDrag.start.x, activeDrag.current.x),
        y: Math.min(activeDrag.start.y, activeDrag.current.y),
        w: Math.abs(activeDrag.current.x - activeDrag.start.x),
        h: Math.abs(activeDrag.current.y - activeDrag.start.y),
      }
    : null;

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="flex items-center gap-2 border-b border-black/10 bg-white px-2 py-1.5">
        <button type="button" className="rounded border px-2 py-0.5 text-sm" onClick={() => setZoom((value) => clampZoom(value - 0.25))} aria-label="Uitzoomen">−</button>
        <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => setZoom(1)}>Passend</button>
        <button type="button" className="rounded border px-2 py-0.5 text-sm" onClick={() => setZoom((value) => clampZoom(value + 0.25))} aria-label="Inzoomen">+</button>
        <span className="text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        {pdf ? (
          <>
            <button type="button" className="rounded border px-2 py-0.5 text-xs" data-testid="raamstudio-rotate-left" title="Draai deze pagina 90 graden linksom" onClick={() => onRotate?.(-90)} disabled={!onRotate}>↶ Linksom</button>
            <button type="button" className="rounded border px-2 py-0.5 text-xs" data-testid="raamstudio-rotate-right" title="Draai deze pagina 90 graden rechtsom" onClick={() => onRotate?.(90)} disabled={!onRotate}>Rechtsom ↷</button>
          </>
        ) : null}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-neutral-200" data-testid="raamstudio-plan-scroll" data-zoom={zoom} data-rotation={rotation} data-render-px={pdfShown?.longest ?? undefined}>
        {status === "loading" ? <p className="p-6 text-sm text-muted-foreground" data-testid="raamstudio-plan-loading">Tekening laden…</p> : null}
        {status === "error" ? <p className="p-6 text-sm text-destructive">De tekening kon niet worden geopend.</p> : null}
        {status === "ready" && (pdf ? pdfShown : src) ? (
          <div ref={sheetRef} className="relative inline-block align-top" style={{ width: `${zoom * 100}%` }}>
            <TurnedSheet
              src={pdf ? null : src}
              alt={planName}
              rotation={rotation}
              pixelSize={pdfShown ? { w: pdfShown.width, h: pdfShown.height } : null}
              bitmapRef={bitmapRef}
              paintId={pdfShown?.paintId ?? 0}
            >
            <div
              className="absolute inset-0 cursor-crosshair touch-none"
              data-testid="raamstudio-plan-surface"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                const point = pointOf(event);
                const target = hit(marks, point, mode);
                if (target && (mode !== "draw" || near(target, point))) {
                  setDrag({ kind: "move", key: requestKey, id: target.id, start: point, origin: target, current: point });
                  return;
                }
                if (mode === "inspect") {
                  onSelect(target?.id ?? null);
                  return;
                }
                setDrag({ kind: "new", key: requestKey, start: point, current: point });
              }}
              onPointerMove={(event) => {
                if (!activeDrag) return;
                setDrag({ ...activeDrag, current: pointOf(event) });
              }}
              onPointerUp={(event) => {
                if (!activeDrag) return;
                const point = pointOf(event);
                const travel = Math.abs(point.x - activeDrag.start.x) + Math.abs(point.y - activeDrag.start.y);
                setDrag(null);
                if (activeDrag.kind === "move") {
                  if (travel < 0.012) {
                    onSelect(activeDrag.id);
                    return;
                  }
                  const dx = point.x - activeDrag.start.x;
                  const dy = point.y - activeDrag.start.y;
                  const origin = activeDrag.origin;
                  if (origin.w && origin.h) {
                    onMove(activeDrag.id, {
                      x: clamp(origin.x + dx, 0, 1 - origin.w),
                      y: clamp(origin.y + dy, 0, 1 - origin.h),
                      w: origin.w,
                      h: origin.h,
                    });
                  } else {
                    onMove(activeDrag.id, { x: clamp(origin.x + dx), y: clamp(origin.y + dy) });
                  }
                  return;
                }
                const rect = {
                  x: Math.min(activeDrag.start.x, point.x),
                  y: Math.min(activeDrag.start.y, point.y),
                  w: Math.abs(point.x - activeDrag.start.x),
                  h: Math.abs(point.y - activeDrag.start.y),
                };
                if (rect.w >= 0.012 && rect.h >= 0.012 && (mode === "draw" || mode === "opening")) {
                  if (mode === "draw") onPending(rect);
                  else onPlace({ kind: "rect", ...rect });
                  return;
                }
                if (mode === "opening" || mode === "facade") onPlace({ kind: "point", x: point.x, y: point.y });
              }}
            >
              {shownMarks().map((mark) => <MarkView key={mark.id} mark={mark} selected={mark.id === selectedId} />)}
              {pending && !rubber ? <RectView rect={pending} label="Nieuw kader" pending /> : null}
              {rubber && rubber.w >= 0.008 && rubber.h >= 0.008 ? <RectView rect={rubber} label="" pending /> : null}
            </div>
            </TurnedSheet>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Move the sheet point back under the cursor. A positive error means the point sits too far right or down. */
function scrollByDelta(start: HTMLElement, errorX: number, errorY: number) {
  let node: HTMLElement | null = start.parentElement;
  let left = errorX;
  let top = errorY;
  while (node) {
    if (Math.abs(left) > 0.5 && node.scrollWidth > node.clientWidth + 1) {
      const max = node.scrollWidth - node.clientWidth;
      const next = Math.min(max, Math.max(0, node.scrollLeft + left));
      left -= next - node.scrollLeft;
      node.scrollLeft = next;
    }
    if (Math.abs(top) > 0.5 && node.scrollHeight > node.clientHeight + 1) {
      const max = node.scrollHeight - node.clientHeight;
      const next = Math.min(max, Math.max(0, node.scrollTop + top));
      top -= next - node.scrollTop;
      node.scrollTop = next;
    }
    node = node.parentElement;
  }
  if (Math.abs(left) > 0.5 || Math.abs(top) > 0.5) window.scrollBy(left, top);
}

function TurnedSheet({
  src,
  alt,
  rotation,
  pixelSize,
  bitmapRef,
  paintId,
  children,
}: {
  src: string | null;
  alt: string;
  rotation: number;
  /** Bitmap pixels of a PDF page. Present only for a rendered plan, not for a plain image. */
  pixelSize: { w: number; h: number } | null;
  bitmapRef: RefObject<ImageBitmap | null>;
  paintId: number;
  children: ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{ w: number; h: number } | null>(null);
  const [seenSrc, setSeenSrc] = useState(src);
  if (seenSrc !== src) {
    setSeenSrc(src);
    setLoaded(null);
  }
  const natural = pixelSize ?? loaded;
  const quarter = rotation % 180 !== 0;
  const turned = rotation % 360 !== 0;
  const measured = natural != null && natural.w > 0 && natural.h > 0;
  const frameClass = [
    "select-none",
    quarter && measured ? "absolute max-w-none" : "block h-auto w-full",
    turned && !measured ? "invisible" : "",
  ].filter(Boolean).join(" ");
  const frameStyle = quarter && measured && natural
    ? {
        left: "50%",
        top: "50%",
        width: `${(natural.w / natural.h) * 100}%`,
        height: `${(natural.h / natural.w) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }
    : rotation % 360 === 180 && natural
      ? { transform: "rotate(180deg)", aspectRatio: `${natural.w} / ${natural.h}` }
      : natural
        ? { aspectRatio: `${natural.w} / ${natural.h}` }
        : undefined;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(bitmap, 0, 0);
    canvas.dataset.bitmapWidth = String(bitmap.width);
    canvas.dataset.bitmapHeight = String(bitmap.height);
  }, [bitmapRef, paintId]);

  return (
    <div
      className="relative w-full"
      style={quarter && measured && natural ? { aspectRatio: `${natural.h} / ${natural.w}` } : undefined}
    >
      {pixelSize ? (
        <canvas
          ref={canvasRef}
          aria-label={alt}
          data-testid="raamstudio-plan-canvas"
          className={frameClass}
          style={frameStyle}
        />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={(event) => {
            const width = event.currentTarget.naturalWidth;
            const height = event.currentTarget.naturalHeight;
            if (width > 0 && height > 0) setLoaded({ w: width, h: height });
          }}
          className={frameClass}
          style={frameStyle}
        />
      ) : null}
      {!turned || measured ? children : null}
    </div>
  );
}

type ShownPdf = {
  pageKey: string;
  width: number;
  height: number;
  longest: number;
  paintId: number;
};

function MarkView({ mark, selected }: { mark: SheetMark; selected: boolean }) {
  if (mark.w && mark.h) {
    return (
      <RectView
        rect={{ x: mark.x, y: mark.y, w: mark.w, h: mark.h }}
        label={mark.label}
        kind={mark.kind}
        selected={selected}
      />
    );
  }
  const color = mark.kind === "facade" ? "#be2332" : "#cd2341";
  return (
    <span
      data-testid="raamstudio-placed-mark"
      data-mark-label={mark.label}
      className="absolute flex h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white px-1 text-xs font-semibold"
      style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, borderColor: color, color, outline: selected ? `2px solid ${color}` : undefined }}
    >
      {mark.label}
    </span>
  );
}

function RectView({
  rect,
  label,
  kind = "drawing",
  selected = false,
  pending = false,
}: {
  rect: NormRect;
  label: string;
  kind?: SheetMark["kind"];
  selected?: boolean;
  pending?: boolean;
}) {
  const color = pending ? "#00aaff" : kind === "drawing" ? "#00aaff" : "#cd2341";
  return (
    <span
      data-testid={pending ? "raamstudio-pending" : "raamstudio-placed-mark"}
      data-mark-label={label}
      className="absolute box-border"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
        border: `2px ${pending ? "dashed" : "solid"} ${color}`,
        background: kind === "drawing" || pending ? "rgba(0,170,255,0.16)" : "rgba(255,115,145,0.28)",
        outline: selected ? `2px solid ${color}` : undefined,
        outlineOffset: "1px",
      }}
    >
      {label ? (
        <span className="absolute left-1 top-1 rounded bg-white/95 px-1.5 py-0.5 text-xs font-medium" style={{ color }}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
