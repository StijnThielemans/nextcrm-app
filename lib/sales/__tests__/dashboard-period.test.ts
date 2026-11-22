import { addDays, chartBuckets, inclusiveDays, mondayOf, previousPeriod, resolvePeriod } from "../dashboard-period";

const today = "2026-11-22";

describe("dashboard periods", () => {
  it("starts the week on Monday and keeps Sunday inside it", () => {
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
  });

  it("uses a previous window of the same length", () => {
    const month = resolvePeriod({ preset: "maand" }, today);
    expect(month.range).toEqual({ start: "2026-11-01", end: "2026-11-22" });
    expect(inclusiveDays(month.range.start, month.range.end)).toBe(22);
    expect(month.previous).toEqual({ start: "2026-10-10", end: "2026-10-31" });
    expect(inclusiveDays(month.previous.start, month.previous.end)).toBe(22);

    const day = resolvePeriod({ preset: "vandaag" }, today);
    expect(day.range).toEqual({ start: today, end: today });
    expect(day.previous).toEqual({ start: "2026-11-21", end: "2026-11-21" });

    const week = resolvePeriod({ preset: "week" }, today);
    expect(week.range).toEqual({ start: "2026-11-16", end: "2026-11-22" });
    expect(week.previous).toEqual({ start: "2026-11-09", end: "2026-11-15" });
  });

  it("keeps a custom range and falls back when the dates are not a range", () => {
    const custom = resolvePeriod({ preset: "aangepast", from: "2026-11-18", to: "2026-11-20" }, today);
    expect(custom.preset).toBe("aangepast");
    expect(custom.range).toEqual({ start: "2026-11-18", end: "2026-11-20" });
    expect(previousPeriod(custom.range)).toEqual(custom.previous);
    expect(resolvePeriod({ preset: "aangepast", from: "2026-12-01", to: "2026-11-01" }, today).preset).toBe("maand");
  });

  it("buckets a short period by day and a year by month", () => {
    expect(chartBuckets({ start: "2026-11-20", end: "2026-11-22" }).map((bucket) => bucket.start)).toEqual([
      "2026-11-20",
      "2026-11-21",
      "2026-11-22",
    ]);
    const year = chartBuckets({ start: "2026-01-01", end: "2026-11-22" });
    expect(year[0]?.label).toContain("2026");
    expect(year.length).toBe(11);
    expect(addDays("2026-11-22", 1)).toBe("2026-11-23");
  });
});
