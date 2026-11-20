"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { localPointInClip, pagePointInClip } from "@/lib/raamstudio/plan-edit";
import type { NormRect } from "@/lib/raamstudio/workspace-model";

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

export function ClipBoard({
  clips,
  planNames,
  numbers,
  onPlace,
  onMove,
  onRemove,
  emptyText = "Duid eerst in stap 1 een gevel, snede of grondplan aan. Die knipsels komen hier.",
  large = false,
}: {
  clips: ClipView[];
  planNames: string[];
  numbers: ClipNumber[];
  onPlace?: (index: number, localX: number, localY: number) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onRemove?: (id: string) => void;
  emptyText?: string;
  large?: boolean;
}) {
  if (!clips.length) {
    return (
      <p className="p-6 text-sm text-muted-foreground" data-testid="raamstudio-clips-empty">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3" data-testid="raamstudio-clip-board">
      {clips.map((clip) => (
        <ClipCard
          key={`${clip.planId}-${clip.page}-${clip.index}`}
          clip={clip}
          planName={planNames[clip.index] ?? ""}
          numbers={numbers}
          onPlace={onPlace}
          onMove={onMove}
          onRemove={onRemove}
          large={large}
        />
      ))}
    </div>
  );
}

function ClipCard({
  clip,
  planName,
  numbers,
  onPlace,
  onMove,
  onRemove,
  large = false,
}: {
  clip: ClipView;
  planName: string;
  numbers: ClipNumber[];
  onPlace?: (index: number, localX: number, localY: number) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onRemove?: (id: string) => void;
  large?: boolean;
}) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const aspect = ratio ? (clip.rect.w / clip.rect.h) * ratio : 1.3;
  const visible = numbers.flatMap((number) => {
    if (number.planName !== planName || number.page !== clip.page) return [];
    const local = localPointInClip(clip.rect, number.x, number.y);
    if (!local.inside) return [];
    const moved = drag?.id === number.id
      ? { x: Math.min(1, Math.max(0, local.x + drag.dx)), y: Math.min(1, Math.max(0, local.y + drag.dy)) }
      : { x: local.x, y: local.y };
    return [{ ...number, ...moved }];
  });

  function localOf(event: ReactPointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / Math.max(1, box.width))),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / Math.max(1, box.height))),
    };
  }

  return (
    <article className="rounded-lg border border-black/10 bg-white p-2" data-testid="raamstudio-clip-view" data-clip-name={clip.name} data-clip-kind={clip.kind}>
      <p className="mb-2 text-sm font-medium">{clip.name} <span className="font-normal text-muted-foreground">· {clip.kind}</span></p>
      <div className={cn("relative overflow-hidden bg-neutral-100", large ? "min-h-[48vh]" : "max-h-[340px]")} style={{ aspectRatio: aspect }}>
        {/* The full page is shifted so only this knipsel stays in view. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/crm/raamstudio/plan-page?documentId=${encodeURIComponent(clip.planId)}&page=${clip.page + 1}&px=4096`}
          alt={clip.name}
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            width: `${100 / clip.rect.w}%`,
            height: `${100 / clip.rect.h}%`,
            left: `${(-clip.rect.x / clip.rect.w) * 100}%`,
            top: `${(-clip.rect.y / clip.rect.h) * 100}%`,
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
            const point = localOf(event);
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
                  const page = pagePointInClip(clip.rect, next.x, next.y);
                  onMove(id, page.x, page.y);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            >
              {number.label}
            </button>
          ))}
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
