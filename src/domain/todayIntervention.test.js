import { describe, expect, it } from "vitest";
import {
  buildTodayCanonicalContextSummary,
  diagnoseTodayIntervention,
  getTodaySupportedPrimaryIntents,
  isTodayPrimaryIntentSupportedByHero,
  resolveTodayGapDecision,
  resolveTodayDatePhase,
  resolveTodayOccurrenceStartPolicy,
  TODAY_DIAGNOSTIC_REJECTION_REASON,
  TODAY_DATE_PHASE,
  TODAY_GAP_REASON,
  TODAY_INTERNAL_INTERVENTION_TYPE,
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
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
        focusOccurrenceForActiveDate: { id: "occ-1", date: "2026-03-19" },
        primaryActionDateKey: "2026-03-19",
        primaryActionIntent: "start_occurrence",
      })
    ).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
  });

  it("computes the date phase and temporal start policy", () => {
    expect(resolveTodayDatePhase({ activeDate: "2026-03-19", systemToday: "2026-03-19" })).toBe(
      TODAY_DATE_PHASE.TODAY
    );
    expect(resolveTodayDatePhase({ activeDate: "2026-03-20", systemToday: "2026-03-19" })).toBe(
      TODAY_DATE_PHASE.FUTURE
    );
    expect(resolveTodayDatePhase({ activeDate: "2026-03-18", systemToday: "2026-03-19" })).toBe(
      TODAY_DATE_PHASE.PAST
    );
    expect(
      resolveTodayOccurrenceStartPolicy({
        activeDate: "2026-03-20",
        systemToday: "2026-03-19",
        occurrenceDate: "2026-03-20",
      })
    ).toMatchObject({
      datePhase: TODAY_DATE_PHASE.FUTURE,
      canStartDirectly: false,
      requiresReschedule: true,
    });
  });

  it("does not resolve open_today as a valid primary intent for Today", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        primaryActionIntent: "open_today",
      })
    ).toBeNull();
    expect(isTodayPrimaryIntentSupportedByHero("open_today")).toBe(false);
  });

  it("resolves a legitimate session resume", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: { id: "sess-1" },
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
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
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
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

  it("prefers a direct start over a schedule warning when a same-day occurrence is executable", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
        focusOccurrenceForActiveDate: { id: "occ-1", date: "2026-03-19" },
      })
    ).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
        focusOccurrenceForActiveDate: { id: "occ-1", date: "2026-03-19" },
        primaryActionIntent: "open_pilotage",
      })
    ).toBeNull();
  });

  it("resolves open_pilotage as today_recommendation when a planned occurrence must be replanified", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        activeDate: "2026-03-20",
        systemToday: "2026-03-19",
        focusOccurrenceForActiveDate: { id: "occ-future", date: "2026-03-20" },
        primaryActionDateKey: "2026-03-20",
        primaryActionIntent: "open_pilotage",
      })
    ).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
  });

  it("resolves open_pilotage as today_recommendation when a gap-fill opportunity exists", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
        gapSummary: {
          hasGapToday: true,
          gapReason: TODAY_GAP_REASON.EMPTY_DAY,
          candidateActionSummaries: [{ actionId: "goal-1", title: "Deep work" }],
        },
        primaryActionIntent: "open_pilotage",
      })
    ).toBe(TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION);
    expect(
      resolveTodayGapDecision({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
        focusOccurrenceForActiveDate: null,
        gapSummary: {
          hasGapToday: true,
          gapReason: TODAY_GAP_REASON.EMPTY_DAY,
          candidateActionSummaries: [{ actionId: "goal-1", title: "Deep work" }],
        },
      })
    ).toEqual({
      interventionType: TODAY_INTERNAL_INTERVENTION_TYPE.GAP_FILL_RECOMMENDATION,
      gapReason: TODAY_GAP_REASON.EMPTY_DAY,
      candidateActionSummaries: [{ actionId: "goal-1", title: "Deep work" }],
    });
  });

  it("forbids session_resume when the active session is not on the active date", () => {
    expect(
      resolveTodayInterventionType({
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
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
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
      })
    ).toBe(false);
  });

  it("exposes future intervention types without enabling them yet", () => {
    expect(TODAY_INTERVENTION_REGISTRY[TODAY_INTERVENTION_TYPE.OVERLOAD_ADJUSTMENT]?.enabled).toBe(false);
    expect(TODAY_INTERVENTION_REGISTRY[TODAY_INTERVENTION_TYPE.PLANNING_ASSIST]?.enabled).toBe(false);
    expect(TODAY_INTERVENTION_REGISTRY[TODAY_INTERVENTION_TYPE.MOTIVATION_NUDGE]?.enabled).toBe(false);
    expect(TODAY_INTERVENTION_REGISTRY[TODAY_INTERVENTION_TYPE.REVIEW_FEEDBACK]?.enabled).toBe(false);
  });

  it("exposes the supported primary intents for Today from a single shared source", () => {
    expect(getTodaySupportedPrimaryIntents().sort()).toEqual(
      ["start_occurrence", "open_library", "resume_session", "open_pilotage"].sort()
    );
  });

  it("builds a minimal canonical context summary", () => {
    expect(
      buildTodayCanonicalContextSummary({
        activeDate: "2026-03-16",
        isToday: true,
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
        plannedActionsForActiveDate: [{ id: "occ-1" }],
        focusOccurrenceForActiveDate: { id: "occ-1" },
      })
    ).toEqual({
      activeDate: "2026-03-16",
      isToday: true,
      hasActiveSessionForActiveDate: false,
      hasOpenSessionOutsideActiveDate: true,
      futureSessionsCount: 1,
      hasPlannedActionsForActiveDate: true,
      hasFocusOccurrenceForActiveDate: true,
    });
  });

  it("diagnoses a governance rejection for resume without same-day session", () => {
    expect(
      diagnoseTodayIntervention({
        primaryActionIntent: "resume_session",
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: { id: "sess-future" },
        futureSessions: [{ id: "sess-future" }],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
      })
    ).toEqual({
      ok: false,
      resolvedInterventionType: null,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NO_ACTIVE_SESSION_FOR_DATE,
    });
  });

  it("diagnoses open_today as an invalid intervention type for Today primary action", () => {
    expect(
      diagnoseTodayIntervention({
        primaryActionIntent: "open_today",
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
      })
    ).toEqual({
      ok: false,
      resolvedInterventionType: null,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE,
    });
  });

  it("diagnoses gap-fill open_pilotage as valid when a gap summary is present", () => {
    expect(
      diagnoseTodayIntervention({
        requestedInterventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
        primaryActionIntent: "open_pilotage",
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        activeDate: "2026-03-19",
        systemToday: "2026-03-19",
        gapSummary: {
          hasGapToday: true,
          gapReason: TODAY_GAP_REASON.EMPTY_DAY,
          candidateActionSummaries: [{ actionId: "goal-1", title: "Deep work" }],
        },
      })
    ).toEqual({
      ok: true,
      resolvedInterventionType: TODAY_INTERVENTION_TYPE.TODAY_RECOMMENDATION,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.NONE,
    });
  });

  it("diagnoses start_occurrence as invalid when the occurrence is not on today's active date", () => {
    expect(
      diagnoseTodayIntervention({
        primaryActionIntent: "start_occurrence",
        primaryActionDateKey: "2026-03-20",
        activeSessionForActiveDate: null,
        openSessionOutsideActiveDate: null,
        futureSessions: [],
        activeDate: "2026-03-20",
        systemToday: "2026-03-19",
        focusOccurrenceForActiveDate: { id: "occ-future", date: "2026-03-20" },
      })
    ).toEqual({
      ok: false,
      resolvedInterventionType: null,
      rejectionReason: TODAY_DIAGNOSTIC_REJECTION_REASON.INVALID_INTERVENTION_TYPE,
    });
  });
});
