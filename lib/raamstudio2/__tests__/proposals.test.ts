import { buildProposals, floorFromLabels, sideFromLabels } from "../proposals";

describe("plan proposals", () => {
  it("uses one facade name and leaves two names open", () => {
    expect(sideFromLabels(["Voorgevel"])).toBe("voorgevel");
    expect(sideFromLabels(["façade droite"])).toBe("rechtergevel");
    expect(sideFromLabels(["voorgevel", "achtergevel"])).toBeNull();
  });

  it("reads a floor only when the page names one", () => {
    expect(floorFromLabels(["kelder"])).toBe("-1");
    expect(floorFromLabels(["gelijkvloers"])).toBe("0");
    expect(floorFromLabels(["gelijkvloers", "kelder"])).toBeNull();
  });

  it("adds candidates to check and does not turn a nearby figure into a size", () => {
    const made = buildProposals({
      boxes: [{ x: 0.2, y: 0.3, w: 0.05, h: 0.02, source: "pdfplumber", nearby: ["2400"], status: "te controleren" }],
      labels: ["voorgevel"],
      floorFallback: "0",
      existing: [],
      planId: "plan",
      planName: "grond.pdf",
      page: 1,
      createId: () => "new",
    });
    expect(made.openings).toHaveLength(1);
    expect(made.openings[0]).toMatchObject({ number: "0.1", side: "voorgevel", review: "te controleren", x: 0.225, y: 0.31 });
    expect(made.highlights[0]?.id).toBe("mark-new");
    expect(JSON.stringify(made)).not.toContain("widthMm");
  });

  it("keeps 0.10 when a candidate is added after it", () => {
    const made = buildProposals({
      boxes: [{ x: 0.4, y: 0.3, w: 0.04, h: 0.02, source: "opencv", nearby: [], status: "te controleren" }],
      labels: [],
      floorFallback: "0",
      existing: [{ x: 0.1, y: 0.1, number: "0.10" }],
      planId: "plan",
      planName: "grond.pdf",
      page: 1,
      createId: () => "next",
    });
    expect(made.openings[0]?.number).toBe("0.11");
  });
});
