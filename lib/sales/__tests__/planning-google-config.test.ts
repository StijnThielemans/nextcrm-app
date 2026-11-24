import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import {
  describePlanningGoogleSetup,
  planningGoogleCalendarId,
  planningGoogleInfrastructureReady,
  planningGoogleSingleCalendarId,
} from "../planning-google-config";

const env = process.env;

describe("planning google config", () => {
  beforeEach(() => {
    process.env = { ...env };
    delete process.env.PLANNING_GOOGLE_CALENDAR_ID;
    delete process.env.PLANNING_GOOGLE_CALENDAR_BINNENDIENST;
    delete process.env.PLANNING_GOOGLE_CALENDAR_BUITENDIENST;
    delete process.env.PLANNING_GOOGLE_CALENDAR_DIENST_NA_VERKOOP;
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.PLANNING_GOOGLE_ACCOUNT_EMAIL;
  });

  afterEach(() => {
    process.env = env;
  });

  it("uses one calendar for every board when PLANNING_GOOGLE_CALENDAR_ID is set", () => {
    process.env.PLANNING_GOOGLE_CALENDAR_ID = "shared@group.calendar.google.com";
    expect(planningGoogleSingleCalendarId()).toBe("shared@group.calendar.google.com");
    expect(planningGoogleCalendarId("buitendienst")).toBe("shared@group.calendar.google.com");
    expect(describePlanningGoogleSetup().mode).toBe("single");
  });

  it("uses per-board ids when no shared calendar is set", () => {
    process.env.PLANNING_GOOGLE_CALENDAR_BUITENDIENST = "buiten@group.calendar.google.com";
    expect(planningGoogleCalendarId("buitendienst")).toBe("buiten@group.calendar.google.com");
    expect(planningGoogleCalendarId("binnendienst")).toBeNull();
    expect(describePlanningGoogleSetup().mode).toBe("per-board");
  });

  it("treats planning as local when Google infrastructure env is incomplete", () => {
    expect(planningGoogleInfrastructureReady("buitendienst")).toBe(false);
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "secret";
    process.env.PLANNING_GOOGLE_ACCOUNT_EMAIL = "plan@thielemans.be";
    process.env.PLANNING_GOOGLE_CALENDAR_BUITENDIENST = "cal@google.com";
    expect(planningGoogleInfrastructureReady("buitendienst")).toBe(true);
    expect(planningGoogleInfrastructureReady("binnendienst")).toBe(false);
  });
});