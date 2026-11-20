"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { clipViewRect, localPointInClip, pagePointInClip } from "@/lib/raamstudio/plan-edit";
import { bucketPlanPixels } from "@/lib/raamstudio/plan-pixels";
import type { NormRect } from "@/lib/raamstudio/workspace-model";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const FRAME_PAD = 16;

function clampZoom(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
}

export type ClipView = {
  index: number;
  name: string;
  kind: string;
  planId: string;
  page: number;
  rect: NormRect;
};

export type ClipNumber = {
  id: string;
  label: string;
  planName: string;
  page: number;
  x: number;
  y: number;
};

export type ClipMeasure = {
  number: string;
  width: string;
  height: string;
};

export function ClipBoard({
  clips,
  planNames,
  numbers,
  onPlace,
  onMove,
  onRemove,
  measures,
  onEditMeasure,
  emptyText = "Duid eerst in stap 1 een gevel, snede of grondplan aan. Die knipsels komen hier.",
  testId = "raamstudio-clip-board",
}: {
  clips: ClipView[];
  planNames: string[];
  numbers: ClipNumber[];
  onPlace?: (index: number, localX: number, localY: number) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onRemove?: (id: string) => void;
  measures?: ClipMeasure[];
  onEditMeasure?: (number: string, orientation: "width" | "height", value: string) => void;
  emptyText?: string;
  testId?: string;
}) {
  if (!clips.length) {
    return (
      <p className="p-6 text-sm text-muted-foreground" data-testid="raamstudio-clips-empty">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3" data-testid={testId}>
      {clips.map((clip) => (
        <ClipCard
          key={`${clip.planId}-${clip.page}-${clip.index}`}
          clip={clip}
          planName={planNames[clip.index] ?? ""}
          numbers={numbers}
          measures={measures}
          onEditMeasure={onEditMeasure}
          onPlace={onPlace}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function ClipCard({
  clip,
  planName,
  numbers,
  measures,
  onEditMeasure,
  onPlace,
  onMove,
  onRemove,
}: {
  clip: ClipView;
  planName: string;
  numbers: ClipNumber[];
  measures?: ClipMeasure[];
  onEditMeasure?: (number: string, orientation: "width" | "height", value: string) => void;
  onPlace?: (index: number, localX: number, localY: number) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onRemove?: (id: string) => void;
}) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [frameWidth, setFrameWidth] = useState(0);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomAnchor = useRef<{ relX: number; relY: number; clientX: number; clientY: number } | null>(null);
  const view = clipViewRect(clip.rect);
  const aspect = ratio ? (view.w / view.h) * ratio : null;
  const innerWidth = Math.max(1, frameWidth - FRAME_PAD * 2);
  const sheetWidth = innerWidth * zoom;
  const sheetHeight = aspect ? sheetWidth / aspect : innerWidth;
  const frameHeight = aspect ? innerWidth / aspect + FRAME_PAD * 2 : 320;
  const pixels = bucketPlanPixels(4096 * Math.max(1, zoom));

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setFrameWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const anchor = zoomAnchor.current;
    if (!frame || !anchor) return;
    zoomAnchor.current = null;
    const sheet = frame.querySelector<HTMLElement>('[data-testid="raamstudio-clip-sheet"]');
    if (!sheet) return;
    const rect = frame.getBoundingClientRect();
    frame.scrollLeft = anchor.relX * sheet.offsetWidth - (anchor.clientX - rect.left);
    frame.scrollTop = anchor.relY * sheet.offsetHeight - (anchor.clientY - rect.top);
  }, [zoom, sheetWidth, sheetHeight]);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const frame = frameRef.current;
      if (!frame) return;
      const over = event.target instanceof Node && frame.contains(event.target);
      if (!event.ctrlKey && !event.metaKey) return;
      if (!over) return;
      event.preventDefault();
      if (event.buttons !== 0 || !event.deltaY) return;
      const sheet = frame.querySelector<HTMLElement>('[data-testid="raamstudio-clip-sheet"]');
      if (!sheet) return;
      const box = sheet.getBoundingClientRect();
      zoomAnchor.current = {
        relX: (event.clientX - box.left) / Math.max(1, box.width),
        relY: (event.clientY - box.top) / Math.max(1, box.height),
        clientX: event.clientX,
        clientY: event.clientY,
      };
      setZoom((current) => clampZoom(current * Math.exp(-event.deltaY * 0.0015)));
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWheel, { capture: true });
  }, []);
  const visible = numbers.flatMap((number) => {
    if (number.planName !== planName || number.page !== clip.page) return [];
    const placed = localPointInClip(clip.rect, number.x, number.y);
    if (!placed.inside) return [];
    const local = localPointInClip(view, number.x, number.y);
    const moved = drag?.id === number.id
      ? { x: local.x + drag.dx, y: local.y + drag.dy }
      : { x: local.x, y: local.y };
    return [{ ...number, ...moved }];
  });

  function originalLocal(localX: number, localY: number) {
    const page = pagePointInClip(view, localX, localY);
    const local = localPointInClip(clip.rect, page.x, page.y);
    return {
      x: Math.min(1, Math.max(0, local.x)),
      y: Math.min(1, Math.max(0, local.y)),
    };
  }

  function localOf(event: ReactPointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / Math.max(1, box.width))),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / Math.max(1, box.height))),
    };
  }

  return (
    <article className="rounded-lg border border-black/10 bg-white p-2" data-testid="raamstudio-clip-view" data-clip-name={clip.name} data-clip-kind={clip.kind}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{clip.name} <span className="font-normal text-muted-foreground">· {clip.kind}</span></p>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className="rounded border px-2 py-0.5 text-sm" aria-label="Uitzoomen" onClick={() => setZoom((value) => clampZoom(value - 0.25))}>−</button>
          <button type="button" className="rounded border px-2 py-0.5 text-xs" onClick={() => { zoomAnchor.current = null; setZoom(1); const frame = frameRef.current; if (frame) { frame.scrollLeft = 0; frame.scrollTop = 0; } }}>Passend</button>
          <button type="button" className="rounded border px-2 py-0.5 text-sm" aria-label="Inzoomen" onClick={() => setZoom((value) => clampZoom(value + 0.25))}>+</button>
          <span className="w-10 text-right text-xs" data-testid="raamstudio-clip-zoom">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      <div ref={frameRef} className="overflow-auto" style={{ height: aspect ? frameHeight : undefined, minHeight: aspect ? undefined : frameHeight, padding: FRAME_PAD }} data-testid="raamstudio-clip-scroll">
      <div className="relative overflow-hidden bg-neutral-100" style={{ width: sheetWidth, height: sheetHeight, marginInline: zoom <= 1 ? "auto" : undefined }} data-testid="raamstudio-clip-sheet" data-zoom={zoom}>
        {/* The full page is shifted so this knipsel, plus a margin, fills the sheet. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/crm/raamstudio/plan-page?documentId=${encodeURIComponent(clip.planId)}&page=${clip.page + 1}&px=${pixels}`}
          alt={clip.name}
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            maxWidth: "none",
            width: `${100 / view.w}%`,
            height: `${100 / view.h}%`,
            left: `${(-view.x / view.w) * 100}%`,
            top: `${(-view.y / view.h) * 100}%`,
          }}
          ref={(node) => {
            if (node?.complete && node.naturalWidth > 0 && node.naturalHeight > 0) {
              setRatio(node.naturalWidth / node.naturalHeight);
            }
          }}
          onLoad={(event) => {
            const width = event.currentTarget.naturalWidth;
            const height = event.currentTarget.naturalHeight;
            if (width > 0 && height > 0) setRatio(width / height);
          }}
        />
        <div
          className="absolute inset-0"
          data-testid="raamstudio-clip-surface"
          onPointerDown={(event) => {
            if (event.button !== 0 || !onPlace) return;
            const point = originalLocal(localOf(event).x, localOf(event).y);
            onPlace(clip.index, point.x, point.y);
          }}
        >
          {visible.map((number) => (
            <button
              key={number.id}
              type="button"
              data-testid="raamstudio-clip-number"
              data-number={number.label}
              className="absolute z-10 flex h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#cd2341] bg-white px-1 text-xs font-semibold text-[#cd2341]"
              style={{ left: `${number.x * 100}%`, top: `${number.y * 100}%` }}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
                if (!onMove) return;
                const surface = event.currentTarget.parentElement;
                if (!surface) return;
                const box = surface.getBoundingClientRect();
                const start = {
                  x: (event.clientX - box.left) / Math.max(1, box.width),
                  y: (event.clientY - box.top) / Math.max(1, box.height),
                };
                const origin = { x: number.x, y: number.y };
                const id = number.id;
                const move = (pointer: PointerEvent) => {
                  const next = {
                    x: (pointer.clientX - box.left) / Math.max(1, box.width),
                    y: (pointer.clientY - box.top) / Math.max(1, box.height),
                  };
                  setDrag({ id, dx: next.x - start.x, dy: next.y - start.y });
                };
                const up = (pointer: PointerEvent) => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                  const next = {
                    x: Math.min(1, Math.max(0, origin.x + (pointer.clientX - box.left) / Math.max(1, box.width) - start.x)),
                    y: Math.min(1, Math.max(0, origin.y + (pointer.clientY - box.top) / Math.max(1, box.height) - start.y)),
                  };
                  setDrag(null);
                  const page = pagePointInClip(view, next.x, next.y);
                  onMove(id, page.x, page.y);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            >
              {number.label}
            </button>
          ))}
          {onEditMeasure ? visible.map((number) => {
            const measure = measures?.find((item) => item.number === number.label);
            return (
              <span key={`size-${number.id}`}>
                <MeasureTag
                  text={measure?.width || "???"}
                  number={number.label}
                  orientation="width"
                  testId="raamstudio-facade-width"
                  style={{ left: `${number.x * 100}%`, top: `${number.y * 100}%`, transform: "translate(-50%, 18px)" }}
                  onCommit={(value) => onEditMeasure(number.label, "width", value)}
                />
                <MeasureTag
                  text={measure?.height || "???"}
                  number={number.label}
                  orientation="height"
                  testId="raamstudio-facade-height"
                  style={{ left: `${number.x * 100}%`, top: `${number.y * 100}%`, transform: "translate(28px, -50%)" }}
                  onCommit={(value) => onEditMeasure(number.label, "height", value)}
                />
              </span>
            );
          }) : null}
        </div>
      </div>
      </div>
      {onRemove ? (
        <ul className="mt-2 space-y-1">
          {visible.map((number) => (
            <li key={number.id} className="flex items-center justify-between text-xs">
              <span>{number.label}</span>
              <button type="button" className="text-muted-foreground underline" onClick={() => onRemove(number.id)}>Weg</button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function MeasureTag({
  text,
  number,
  orientation,
  testId,
  style,
  onCommit,
}: {
  text: string;
  number: string;
  orientation: "width" | "height";
  testId: string;
  style: { left: string; top: string; transform: string };
  onCommit: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const skipCommit = useRef(false);
  if (editing) {
    return (
      <input
        autoFocus
        inputMode="decimal"
        aria-label={`${orientation === "width" ? "Breedte" : "Hoogte"} ${number}`}
        className="absolute z-20 h-6 w-16 rounded border border-black/30 bg-white px-1 text-center text-xs"
        style={style}
        value={value}
        data-testid={testId}
        data-number={number}
        data-editing="true"
        onChange={(event) => setValue(event.target.value)}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onCommit(value);
            setEditing(false);
          }
          if (event.key === "Escape") {
            skipCommit.current = true;
            setEditing(false);
          }
        }}
        onBlur={() => {
          if (skipCommit.current) {
            skipCommit.current = false;
            return;
          }
          onCommit(value);
          setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className="absolute z-20 whitespace-nowrap rounded bg-white/90 px-1 text-xs font-medium text-black"
      style={style}
      data-testid={testId}
      data-number={number}
      data-value={text}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setValue(text === "???" ? "" : text);
        setEditing(true);
      }}
    >
      {text}
    </button>
  );
}
