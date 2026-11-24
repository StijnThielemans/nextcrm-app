import {
  assignJobColors,
  boardForChassis,
  boardForGlass,
  addMonths,
  firstMondayOfMonth,
  formatDayLong,
  formatMonthTitle,
  formatOutlookDayTitle,
  formatWeekTitle,
  formatWorkWeekTitle,
  monthGridDays,
  planningViewFromParam,
  workWeekDays,
  jobsFromProject,
  layoutOverlapLanes,
  planSpan,
  planningBlockTitle,
  planningDisplaySpan,
  planningPlace,
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

describe("outlook week grid", () => {
  it("writes the week the way Outlook does", () => {
    expect(formatWeekTitle("2026-11-23")).toBe("23 - 29 november 2026");
    expect(formatWeekTitle("2026-11-30")).toBe("30 november - 6 december 2026");
    expect(formatOutlookDayTitle("2026-11-23")).toBe("23 november 2026");
    expect(formatDayLong("2026-11-23").weekday).toBe("maandag");
    expect(formatDayLong("2026-11-29").weekday).toBe("zondag");
  });

  it("draws a dateless werf from 08:00 to 16:00 and does not store that clock", () => {
    expect(planningDisplaySpan(null)).toEqual({ start: 8 * 60, end: 16 * 60, allDay: false });
    expect(planningDisplaySpan({ startMinutes: 9 * 60, endMinutes: 11 * 60 })).toEqual({
      start: 9 * 60,
      end: 11 * 60,
      allDay: false,
    });
    expect(planningDisplaySpan({ allDay: true }).allDay).toBe(true);
  });

  it("puts overlapping jobs side by side and a free job across the day", () => {
    expect(layoutOverlapLanes([
      { id: "a", start: 480, end: 960 },
      { id: "b", start: 480, end: 960 },
    ])).toEqual([
      { id: "a", column: 0, columns: 2 },
      { id: "b", column: 1, columns: 2 },
    ]);
    expect(layoutOverlapLanes([
      { id: "a", start: 480, end: 600 },
      { id: "b", start: 600, end: 960 },
    ])).toEqual([
      { id: "a", column: 0, columns: 1 },
      { id: "b", column: 0, columns: 1 },
    ]);
    expect(layoutOverlapLanes([
      { id: "a", start: 480, end: 900 },
      { id: "b", start: 600, end: 700 },
      { id: "c", start: 720, end: 960 },
    ])).toEqual([
      { id: "a", column: 0, columns: 2 },
      { id: "b", column: 1, columns: 2 },
      { id: "c", column: 1, columns: 2 },
    ]);
  });

  it("shows the city and the chassis or glass label", () => {
    expect(planningPlace(null, "Eeckhoutweg 1, 1785, Merchtem, BE")).toBe("Merchtem");
    expect(planningPlace("Aalst", "Straat 1, Aalst")).toBe("Aalst");
    expect(planningBlockTitle("chassis", 2, null)).toBe("Chassis · 2 werkdagen");
    expect(planningBlockTitle("glass", 4, null)).toBe("Glas · 4 werkdagen");
    expect(planningBlockTitle("manual", 1, "Bij Stef")).toBe("Bij Stef");
    const jobs = jobsFromProject(project({
      place: "Merchtem",
      chassisWorkDays: 2,
      chassisStart: "2026-11-24",
      chassisEnd: "2026-11-25",
    }));
    expect(jobs[0]).toMatchObject({ place: "Merchtem", days: ["2026-11-24", "2026-11-25"] });
  });
});

describe("planning views", () => {
  it("reads the four views and defaults to week", () => {
    expect(planningViewFromParam("day")).toBe("day");
    expect(planningViewFromParam("workweek")).toBe("workweek");
    expect(planningViewFromParam("week")).toBe("week");
    expect(planningViewFromParam("month")).toBe("month");
    expect(planningViewFromParam("gantt")).toBe("week");
    expect(planningViewFromParam(undefined)).toBe("week");
  });

  it("keeps Monday to Friday for the work week", () => {
    expect(workWeekDays("2026-11-23")).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
    ]);
    expect(formatWorkWeekTitle("2026-11-23")).toBe("23 - 27 november 2026");
    expect(formatWorkWeekTitle("2026-11-30")).toBe("30 november - 4 december 2026");
  });

  it("builds a Monday grid for the month and steps months from a Monday inside that month", () => {
    const days = monthGridDays("2026-11-18");
    expect(days[0]).toBe("2026-10-26");
    expect(days.at(-1)).toBe("2026-12-06");
    expect(days).toHaveLength(42);
    expect(formatMonthTitle("2026-11-18")).toBe("november 2026");
    expect(firstMondayOfMonth("2026-11-01")).toBe("2026-11-02");
    expect(firstMondayOfMonth("2026-12-01")).toBe("2026-12-07");
    expect(monthGridDays(firstMondayOfMonth("2026-12-01"))[0]?.slice(0, 7)).toBe("2026-11");
    expect(firstMondayOfMonth("2026-12-01").slice(0, 7)).toBe("2026-12");
    expect(addMonths("2026-11-01", 1)).toBe("2026-12-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });
});
