import { PDFDocument } from "pdf-lib";
import { buildProjectnotities, projectNotesOrder } from "../projectnotities";
import { emptyProject, type Rs2Drawing } from "../project";

const drawing = (id: string, kind: Rs2Drawing["kind"], side: Rs2Drawing["side"]): Rs2Drawing => ({
  id,
  kind,
  side,
  name: id,
  planId: "plan",
  planName: "plan.pdf",
  page: 1,
});

describe("Projectnotities", () => {
  it("puts ground plans first, then facades in street order, then sections", () => {
    const order = projectNotesOrder([
      drawing("s", "Snede", null),
      drawing("l", "Gevel", "linkergevel"),
      drawing("g", "Grondplan", null),
      drawing("v", "Gevel", "voorgevel"),
    ]);
    expect(order.map((item) => item.id)).toEqual(["g", "v", "l", "s"]);
  });

  it("copies the original PDF page instead of replacing it with a raster", async () => {
    const source = await PDFDocument.create();
    source.addPage([300, 400]);
    const project = emptyProject();
    project.drawings.push(drawing("g", "Grondplan", null));
    const out = await buildProjectnotities(project, new Map([["plan", await source.save()]]));
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBe(300);
    expect(doc.getPage(0).getHeight()).toBe(400);
  });
});