import {
  assignJobColors,
  boardForChassis,
  boardForGlass,
  jobsFromProject,
  planSpan,
  spanDays,
  weekFromParam,
  workDaySpanUpdate,
  type ProjectPlanningInput,
} from "../planning";

const PROJECT = "ddd5bf2d-f953-496c-94a4-d527c6e3e4b7";

function project(patch: Partial<ProjectPlanningInput> = {}): ProjectPlanningInput {
  return {
    id: PROJECT,
    projectNumber: "1000000126",
    customer: "Peirlinkc Nicolas",
    address: "Beugemstraat 10, 9310, Aalst, BE",
    projectleidingAction: true,
    chassisWorkDays: null,
    glassWorkDays: null,
    chassisStart: null,
    chassisEnd: null,
    glassStart: null,
    glassEnd: null,
    officeStart: null,
    officeEnd: null,
    ...patch,
  };
}

describe("planning spans", () => {
  it("fills Wednesday, Thursday and Friday for three days dropped on Wednesday", () => {
    expect(planSpan("2026-11-18", 3)).toEqual({ start: "2026-11-18", end: "2026-11-20" });
    expect(spanDays("2026-11-18", "2026-11-20")).toEqual(["2026-11-18", "2026-11-19", "2026-11-20"]);
  });

  it("skips the weekend and starts a Saturday drop on Monday", () => {
    expect(planSpan("2026-11-20", 3)).toEqual({ start: "2026-11-20", end: "2026-11-24" });
    expect(spanDays("2026-11-20", "2026-11-24")).toEqual(["2026-11-20", "2026-11-23", "2026-11-24"]);
    expect(planSpan("2026-11-21", 1)).toEqual({ start: "2026-11-23", end: "2026-11-23" });
    expect(planSpan("2026-11-22", 2)).toEqual({ start: "2026-11-23", end: "2026-11-24" });
  });

  it("opens the week that contains the requested day", () => {
    expect(weekFromParam("2026-11-22", "2026-11-22")).toBe("2026-11-16");
    expect(weekFromParam("nope", "2026-11-18")).toBe("2026-11-16");
  });
});

describe("planning jobs", () => {
  it("puts chassis and glass on buitendienst and does not add a second card", () => {
    expect(boardForChassis()).toBe("buitendienst");
    expect(boardForGlass()).toBe("buitendienst");
    const jobs = jobsFromProject(project({ chassisWorkDays: 3, glassWorkDays: 2 }));
    expect(jobs.map((job) => [job.kind, job.board, job.workDays])).toEqual([
      ["chassis", "buitendienst", 3],
      ["glass", "buitendienst", 2],
    ]);
    expect(jobs.every((job) => job.projectNumber === "1000000126")).toBe(true);
  });

  it("shows a projectbox dossier without work days on binnendienst only", () => {
    const jobs = jobsFromProject(project());
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "office", board: "binnendienst", workDays: 1 });
  });

  it("stays off the calendars when there are no work days and no projectbox flag", () => {
    expect(jobsFromProject(project({ projectleidingAction: false }))).toEqual([]);
    expect(jobsFromProject(project({ projectleidingAction: null, chassisWorkDays: 0, glassWorkDays: 0 }))).toEqual([]);
  });

  it("treats zero as no job and still shows the projectbox card", () => {
    const jobs = jobsFromProject(project({ chassisWorkDays: 0, glassWorkDays: 0 }));
    expect(jobs.map((job) => job.kind)).toEqual(["office"]);
  });
});

describe("planning colors", () => {
  const chassis = { id: `chassis:${PROJECT}`, days: ["2026-11-18", "2026-11-19", "2026-11-20"] };
  const glass = { id: `glass:${PROJECT}`, days: ["2026-11-18", "2026-11-19"] };

  it("keeps one color for the whole span and a different color for the other job that day", () => {
    const colors = assignJobColors([glass, chassis]);
    const again = assignJobColors([chassis, glass]);
    expect(colors.get(chassis.id)?.id).toBe(again.get(chassis.id)?.id);
    expect(colors.get(chassis.id)?.id).not.toBe(colors.get(glass.id)?.id);
    expect(colors.get(chassis.id)?.border).toBeTruthy();
  });
});

describe("work-day span update", () => {
  it("rebuilds a chassis span from the stored start and clears it when the days are emptied", () => {
    const placed = workDaySpanUpdate({
      chassis: 3,
      glass: 2,
      chassisStart: "2026-11-18",
      glassStart: "2026-11-18",
    });
    expect(placed.chassisStart).toBe("2026-11-18");
    expect(placed.chassisEnd).toBe("2026-11-20");
    expect(placed.glassEnd).toBe("2026-11-19");
    expect(placed.clearOffice).toBe(true);

    const cleared = workDaySpanUpdate({
      chassis: null,
      glass: null,
      chassisStart: "2026-11-18",
      glassStart: "2026-11-18",
    });
    expect(cleared.chassisStart).toBeNull();
    expect(cleared.glassEnd).toBeNull();
    expect(cleared.chassisDays).toBe("clear");
    expect(cleared.clearOffice).toBe(false);
  });
});
