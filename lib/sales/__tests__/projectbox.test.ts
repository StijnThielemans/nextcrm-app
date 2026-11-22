import {
  PROJECT_LEADERS,
  dossierInProjectbox,
  isTenDigitProjectNumber,
  parseProjectLeader,
  summarizeProjectbox,
} from "../projectbox";

describe("Projectbox membership", () => {
  it("includes a dossier only when the action is on and the project number has 10 digits", () => {
    expect(dossierInProjectbox(true, "1000000126")).toBe(true);
    expect(isTenDigitProjectNumber("1000000126")).toBe(true);
  });

  it("keeps a checked dossier out when there is no project number", () => {
    expect(dossierInProjectbox(true, null)).toBe(false);
    expect(dossierInProjectbox(true, "")).toBe(false);
    expect(dossierInProjectbox(true, "126")).toBe(false);
    expect(dossierInProjectbox(true, "10000001260")).toBe(false);
  });

  it("keeps a project number out while the action is off", () => {
    expect(dossierInProjectbox(false, "1000000126")).toBe(false);
    expect(dossierInProjectbox(null, "1000000126")).toBe(false);
    expect(dossierInProjectbox(undefined, "1000000126")).toBe(false);
  });
});

describe("project leader names", () => {
  it("accepts only the five names and an empty choice", () => {
    expect(PROJECT_LEADERS).toEqual([
      "Van Holder Jens",
      "Van Aerschot Johan",
      "De Boeck Jelle",
      "Van Loo Anne",
      "Migeotte Aaron",
    ]);
    for (const name of PROJECT_LEADERS) expect(parseProjectLeader(name)).toBe(name);
    expect(parseProjectLeader("")).toBeNull();
    expect(parseProjectLeader(null)).toBeNull();
    expect(() => parseProjectLeader("Haegeman Robbe")).toThrow("projectLeaderInvalid");
  });

  it("counts each leader and the unassigned rows in the box", () => {
    const summary = summarizeProjectbox([
      { projectLeader: "Van Holder Jens" },
      { projectLeader: "Van Holder Jens" },
      { projectLeader: null },
      { projectLeader: "iemand anders" },
    ]);
    expect(summary.count).toBe(4);
    expect(summary.leaders.find((row) => row.name === "Van Holder Jens")?.count).toBe(2);
    expect(summary.leaders.find((row) => row.name === "De Boeck Jelle")?.count).toBe(0);
    expect(summary.unassigned).toBe(2);
  });
});
