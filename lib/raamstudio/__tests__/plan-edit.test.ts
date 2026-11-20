import { buildRaamstudioPayload, workspaceFromPayload, type DossierPrefill, type WorkspaceDraft } from "../workspace-model";
import { clipViewRect, hitFrame, localPointInClip, moveNormRect, nextSharedNumber, pagePointInClip, reorderItems, resizeNormRect } from "../plan-edit";

const plans = ["plan.pdf"];
const prefill: DossierPrefill = {
  number: "OFF-2026-0015",
  name: "Boutens",
  customer: "Van Houtven",
  siteAddress: "Gent",
  contact: "",
  seller: "Haegeman Robbe",
  projectGroup: null,
};

describe("plan frame editing", () => {
  const drawing = { kind: "drawing", x: 0.2, y: 0.3, w: 0.4, h: 0.2 };

  it("grabs a corner before the body, and empty paper starts nothing", () => {
    expect(hitFrame([drawing], { x: 0.2, y: 0.3 }, "draw", { x: 0.02, y: 0.02 })).toEqual({ index: 0, handle: "nw" });
    expect(hitFrame([drawing], { x: 0.4, y: 0.4 }, "draw", { x: 0.02, y: 0.02 })).toEqual({ index: 0, handle: null });
    expect(hitFrame([drawing], { x: 0.05, y: 0.05 }, "draw", { x: 0.02, y: 0.02 })).toBeNull();
  });

  it("moves the frame and leaves its size unchanged", () => {
    expect(moveNormRect({ x: 0.2, y: 0.3, w: 0.4, h: 0.2 }, 0.1, -0.05)).toEqual({ x: 0.3, y: 0.25, w: 0.4, h: 0.2 });
    expect(moveNormRect({ x: 0.8, y: 0.1, w: 0.4, h: 0.2 }, 0.5, 0)).toEqual({ x: 0.6, y: 0.1, w: 0.4, h: 0.2 });
  });

  it("resizes from a handle and stays on the page", () => {
    expect(resizeNormRect({ x: 0.2, y: 0.3, w: 0.4, h: 0.2 }, "e", { x: 0.9, y: 0.3 })).toMatchObject({ x: 0.2, w: 0.7 });
    expect(resizeNormRect({ x: 0.2, y: 0.3, w: 0.4, h: 0.2 }, "nw", { x: 0.1, y: 0.1 })).toMatchObject({ x: 0.1, y: 0.1 });
    const tiny = resizeNormRect({ x: 0.2, y: 0.3, w: 0.4, h: 0.2 }, "e", { x: 0.21, y: 0.3 });
    expect(tiny.w).toBeGreaterThanOrEqual(0.02);
    expect(tiny.x + tiny.w).toBeLessThanOrEqual(1);
  });

  it("reorders stacked clips without changing name or type", () => {
    const clips = [
      { name: "Snede AA", kind: "Snede" },
      { name: "Snede BB", kind: "Snede" },
      { name: "Voorgevel", kind: "Gevel" },
    ];
    expect(reorderItems(clips, 2, 0).map((item) => item.name)).toEqual(["Voorgevel", "Snede AA", "Snede BB"]);
    expect(reorderItems(clips, 0, 0)).toEqual(clips);
  });

  it("keeps a number on the same spot of a clip and reuses that number on a facade", () => {
    const rect = { x: 0.2, y: 0.1, w: 0.4, h: 0.5 };
    expect(pagePointInClip(rect, 0.5, 0.25)).toEqual({ x: 0.4, y: 0.225 });
    expect(localPointInClip(rect, 0.4, 0.225).inside).toBe(true);
    expect(nextSharedNumber(["0.1", "0.2"], new Set(["0.1"]))).toBe("0.2");
    expect(nextSharedNumber(["0.1"], new Set(["0.1"]))).toBeNull();
  });

  it("shows a margin around a clip without changing the stored frame", () => {
    const rect = { x: 0.2, y: 0.1, w: 0.4, h: 0.5 };
    const view = clipViewRect(rect);
    expect(view.x).toBeLessThan(rect.x);
    expect(view.y).toBeLessThan(rect.y);
    expect(view.x + view.w).toBeGreaterThan(rect.x + rect.w);
    expect(view.y + view.h).toBeGreaterThan(rect.y + rect.h);
    expect(localPointInClip(view, 0.4, 0.225).inside).toBe(true);
    expect(clipViewRect({ x: 0, y: 0, w: 1, h: 1 })).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("keeps a moved frame in the project file", () => {
    const draft: WorkspaceDraft = {
      drawings: [
        { planName: "plan.pdf", kind: "Snede", name: "Snede BB", rect: { x: 0.2, y: 0.3, w: 0.4, h: 0.25 } },
        { planName: "plan.pdf", kind: "Snede", name: "Snede AA", rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } },
      ],
      openings: [],
      facades: [],
      sizes: [],
      raaminfo: [],
      pageRotations: [],
    };
    const moved = moveNormRect(draft.drawings[0].rect!, 0.15, 0.05);
    const drawings = reorderItems(draft.drawings, 0, 1);
    drawings[1] = { ...drawings[1], rect: moved };
    const payload = buildRaamstudioPayload(prefill, { ...draft, drawings }, plans);
    const restored = workspaceFromPayload(payload, plans);
    expect(restored.drawings.map((item) => `${item.name}:${item.kind}`)).toEqual(["Snede AA:Snede", "Snede BB:Snede"]);
    expect(restored.drawings[1].rect).toEqual(moved);
  });
});
