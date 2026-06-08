import { describe, expect, it } from "vitest";
import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_DETERMINISTIC_KIND,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
} from "./dayAnalysisTypes";
import {
  applyDayAnalysisDeterministicAction,
  buildDayAnalysisRecoveryRequest,
  isDayAnalysisActionDirectlyApplicable,
  resolveDayAnalysisActionHandoff,
} from "./dayAnalysisAppController";
import { buildDayAnalysisSnapshot } from "./dayAnalysisSnapshot";

const DATE_KEY = "2026-06-08";
const NOW = new Date("2026-06-08T08:00:00.000Z");

function baseState() {
  return {
    ui: {
      selectedDateKey: DATE_KEY,
      selectedDate: DATE_KEY,
      firstRunV1: {
        status: "done",
        discoveryDone: true,
        commitV1: { status: "applied", appliedAt: "2026-06-01T07:00:00.000Z" },
      },
    },
    categories: [{ id: "cat_1", name: "Business" }],
    goals: [
      {
        id: "goal_outcome",
        categoryId: "cat_1",
        title: "Lancer le produit",
        type: "OUTCOME",
        planType: "STATE",
        status: "active",
      },
      {
        id: "goal_action",
        categoryId: "cat_1",
        parentId: "goal_outcome",
        outcomeId: "goal_outcome",
        title: "Préparer la publication",
        type: "PROCESS",
        planType: "ONE_OFF",
        status: "active",
        durationMinutes: 40,
      },
    ],
    occurrences: [
      {
        id: "occ_activation",
        goalId: "goal_action",
        date: "2026-06-01",
        start: "10:00",
        slotKey: "10:00",
        durationMinutes: 20,
        status: "planned",
      },
      {
        id: "occ_1",
        goalId: "goal_action",
        date: DATE_KEY,
        start: "10:00",
        slotKey: "10:00",
        durationMinutes: 40,
        status: "planned",
      },
    ],
    sessionHistory: [],
  };
}

function todayData() {
  return {
    primaryAction: {
      actionId: "goal_action",
      occurrenceId: "occ_1",
      title: "Préparer la publication",
      status: "ready",
    },
  };
}

function findCandidate(type) {
  const snapshot = buildDayAnalysisSnapshot({
    state: baseState(),
    todayData: todayData(),
    selectedDateKey: DATE_KEY,
    now: NOW,
  });
  return snapshot.deterministicActions.find((candidate) => candidate.type === type);
}

describe("dayAnalysisAppController", () => {
  it("hands recoverable occurrence actions to the Recovery Sheet", () => {
    const action = {
      type: DAY_ANALYSIS_ACTION_TYPE.RECOVER_BLOCK,
      targetType: DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE,
      targetId: "occ-1",
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.RECOVERY_SHEET,
      deterministicAction: {
        kind: DAY_ANALYSIS_DETERMINISTIC_KIND.RECOVERY,
        occurrenceId: "occ-1",
        context: "blocked",
      },
    };

    expect(resolveDayAnalysisActionHandoff(action)).toEqual({
      kind: "recovery",
      occurrenceId: "occ-1",
      context: "blocked",
    });
    expect(
      buildDayAnalysisRecoveryRequest({
        action,
        selectedDateKey: "2026-06-08",
      })
    ).toMatchObject({
      occurrenceId: "occ-1",
      context: "blocked",
      source: "day_analysis",
      selectedDateKey: "2026-06-08",
      originTab: "today",
      successTab: "today",
    });
  });

  it("routes review-only add block actions to Planning instead of pretending to apply", () => {
    const action = {
      type: DAY_ANALYSIS_ACTION_TYPE.ADD_SHORT_BLOCK,
      targetType: DAY_ANALYSIS_TARGET_TYPE.OBJECTIVE,
      targetId: "goal-1",
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY,
    };

    expect(resolveDayAnalysisActionHandoff(action)).toEqual({ kind: "planning" });
    expect(buildDayAnalysisRecoveryRequest({ action })).toBeNull();
  });

  it("keeps Coach and Planning as explicit navigation actions only", () => {
    expect(
      resolveDayAnalysisActionHandoff({
        type: DAY_ANALYSIS_ACTION_TYPE.OPEN_COACH,
        targetType: DAY_ANALYSIS_TARGET_TYPE.COACH,
        supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY,
      })
    ).toEqual({ kind: "coach" });

    expect(
      resolveDayAnalysisActionHandoff({
        type: DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING,
        targetType: DAY_ANALYSIS_TARGET_TYPE.PLANNING,
        supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NAVIGATION_ONLY,
      })
    ).toEqual({ kind: "planning" });
  });

  it("prepares applicable planning repair candidates for direct validation", () => {
    const action = findCandidate(DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION);

    expect(isDayAnalysisActionDirectlyApplicable(action)).toBe(true);
    expect(resolveDayAnalysisActionHandoff(action)).toEqual({ kind: "direct_apply" });
  });

  it("closes no-change analysis without mutation", () => {
    expect(
      resolveDayAnalysisActionHandoff({
        type: DAY_ANALYSIS_ACTION_TYPE.NO_CHANGE,
        targetType: DAY_ANALYSIS_TARGET_TYPE.DAY,
        supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.NO_CHANGE,
      })
    ).toEqual({ kind: "close" });
  });

  it("applies reduce_duration through PlanningRepairModel after revalidation", () => {
    const action = findCandidate(DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION);
    const result = applyDayAnalysisDeterministicAction({
      state: baseState(),
      todayData: todayData(),
      selectedDateKey: DATE_KEY,
      action,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.changedOccurrenceIds).toEqual(["occ_1"]);
    expect(result.summary).toContain("Durée actuelle");
    const occurrence = result.nextState.occurrences.find((entry) => entry.id === "occ_1");
    expect(occurrence.durationMinutes).toBeLessThan(40);
    expect(occurrence.repairV1?.type).toBe("reduce_duration");
  });

  it("applies move_later_today through PlanningRepairModel after revalidation", () => {
    const action = findCandidate(DAY_ANALYSIS_ACTION_TYPE.MOVE_LATER_TODAY);
    const result = applyDayAnalysisDeterministicAction({
      state: baseState(),
      todayData: todayData(),
      selectedDateKey: DATE_KEY,
      action,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.changedOccurrenceIds).toContain("occ_1");
    const source = result.nextState.occurrences.find((entry) => entry.id === "occ_1");
    const targetId = source.repairV1?.targetOccurrenceId;
    const target = result.nextState.occurrences.find((entry) => entry.id === targetId);
    expect(source.status).toBe("rescheduled");
    expect(target?.date).toBe(DATE_KEY);
    expect(target?.status).toBe("planned");
  });

  it("applies move_tomorrow through PlanningRepairModel after revalidation", () => {
    const action = findCandidate(DAY_ANALYSIS_ACTION_TYPE.MOVE_TOMORROW);
    const result = applyDayAnalysisDeterministicAction({
      state: baseState(),
      todayData: todayData(),
      selectedDateKey: DATE_KEY,
      action,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    const source = result.nextState.occurrences.find((entry) => entry.id === "occ_1");
    const target = result.nextState.occurrences.find((entry) => entry.id === source.repairV1?.targetOccurrenceId);
    expect(source.status).toBe("rescheduled");
    expect(target?.date).toBe("2026-06-09");
  });

  it("blocks stale targets without returning a committed nextState", () => {
    const action = findCandidate(DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION);
    const staleState = {
      ...baseState(),
      occurrences: [],
    };

    const result = applyDayAnalysisDeterministicAction({
      state: staleState,
      todayData: todayData(),
      selectedDateKey: DATE_KEY,
      action,
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.nextState).toBeNull();
    expect(result.errorCode).toBe("DAY_ANALYSIS_STALE_TARGET");
  });

  it("blocks stale candidates when the deterministic preview no longer matches current state", () => {
    const action = findCandidate(DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION);
    const changedState = {
      ...baseState(),
      occurrences: baseState().occurrences.map((occurrence) =>
        occurrence.id === "occ_1" ? { ...occurrence, durationMinutes: 25 } : occurrence
      ),
    };

    const result = applyDayAnalysisDeterministicAction({
      state: changedState,
      todayData: todayData(),
      selectedDateKey: DATE_KEY,
      action,
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.nextState).toBeNull();
    expect(result.errorCode).toBe("DAY_ANALYSIS_STALE_CANDIDATE");
  });

  it("returns no committed state when invariants reject the deterministic repair", () => {
    const action = findCandidate(DAY_ANALYSIS_ACTION_TYPE.MOVE_TOMORROW);
    const invalidState = {
      ...baseState(),
      occurrences: baseState().occurrences.filter((occurrence) => occurrence.id !== "occ_activation"),
    };

    const result = applyDayAnalysisDeterministicAction({
      state: invalidState,
      todayData: todayData(),
      selectedDateKey: DATE_KEY,
      action,
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.nextState).toBeNull();
    expect(result.errorCode).toBe("DAY_ANALYSIS_INVARIANT_FAILED");
    expect(result.invariantIssues.length).toBeGreaterThan(0);
  });

  it("does not directly apply review-only or unsupported actions", () => {
    const action = {
      type: DAY_ANALYSIS_ACTION_TYPE.ADD_SHORT_BLOCK,
      targetType: DAY_ANALYSIS_TARGET_TYPE.OBJECTIVE,
      targetId: "goal_outcome",
      supportStatus: DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY,
      deterministicAction: {
        kind: DAY_ANALYSIS_DETERMINISTIC_KIND.REVIEW_ONLY,
        reviewOnly: true,
      },
      preview: { summary: "Créer un bloc court." },
    };

    expect(isDayAnalysisActionDirectlyApplicable(action)).toBe(false);
    const result = applyDayAnalysisDeterministicAction({
      state: baseState(),
      todayData: todayData(),
      selectedDateKey: DATE_KEY,
      action,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    expect(result.nextState).toBeNull();
    expect(result.errorCode).toBe("DAY_ANALYSIS_ACTION_UNSUPPORTED");
  });
});
