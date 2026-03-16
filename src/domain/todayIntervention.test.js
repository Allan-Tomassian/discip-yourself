import { describe, expect, it } from "vitest";
import {
  TODAY_INTERVENTION_REGISTRY,
  TODAY_INTERVENTION_TYPE,
  hasDeterministicScheduleWarning,
  isTodayInterventionAllowed,
  resolveTodayInterventionType,
} from "./todayIntervention";

describe("todayIntervention registry", () => {
  it("resolves a standard Today recommendation", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        primaryActionIntent: "start_occurrence",
      })
    ).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
  });

  it("resolves a legitimate session resume", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: { id: "sess-1" },
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        primaryActionIntent: "resume_session",
      })
    ).toBe(TODAY_INTERVENTION_TYPE.SESSION_RESUME);
  });

  it("resolves a deterministic schedule warning", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
        primaryActionIntent: "open_pilotage",
      })
    ).toBe(TODAY_INTERVENTION_TYPE.SCHEDULE_WARNING);
    expect(
      hasDeterministicScheduleWarning({
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
      })
    ).toBe(true);
  });

  it("forbids session_resume when the active session is not on the active date", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
        primaryActionIntent: "resume_session",
      })
    ).toBeNull();
    expect(
      isTodayInterventionAllowed({
        interventionType: TODAY_INTERVENTION_TYPE.SESSION_RESUME,
        primaryActionIntent: "resume_session",
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
      })
    ).toBe(false);
  });

  it("exposes future intervention types without enabling them yet", () => {
    expect(TODAY_INTERVENTION_REGISTRY[TODAY_INTERVENTION_TYPE.OVERLOAD_ADJUSTMENT]?.enabled).toBe(false);
    expect(TODAY_INTERVENTION_REGISTRY[TODAY_INTERVENTION_TYPE.PLANNING_ASSIST]?.enabled).toBe(false);
    expect(TODAY_INTERVENTION_REGISTRY[TODAY_INTERVENTION_TYPE.MOTIVATION_NUDGE]?.enabled).toBe(false);
    expect(TODAY_INTERVENTION_REGISTRY[TODAY_INTERVENTION_TYPE.REVIEW_FEEDBACK]?.enabled).toBe(false);
  });
});
