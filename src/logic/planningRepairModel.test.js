import { describe, expect, it } from "vitest";
import { buildTodayData } from "../features/today/todayDataAdapter";
import { ensureWindowFromScheduleRules } from "./occurrencePlanner";
import {
  PLANNING_REPAIR_TYPE,
  applyOccurrenceRepair,
  applyReduceLoadPlan,
  buildReduceLoadPlan,
  buildRepairOptions,
} from "./planningRepairModel";
import { validateSystemInvariants } from "./systemInvariants";

const DATE_KEY = "2026-05-20";
const NOW = new Date("2026-05-20T10:00:00");

function baseState(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      {
        id: "outcome_main",
        type: "OUTCOME",
        title: "Construire le systeme",
        categoryId: "cat_work",
        priority: "prioritaire",
      },
      {
        id: "action_focus",
        type: "PROCESS",
        planType: "ACTION",
        title: "Bloc profond",
        categoryId: "cat_work",
        parentId: "outcome_main",
        outcomeId: "outcome_main",
        priority: "secondaire",
        repeat: "daily",
      },
    ],
    scheduleRules: [
      {
        id: "rule_focus",
        actionId: "action_focus",
        sourceKey: "action_focus|daily",
        kind: "recurring",
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        timeType: "fixed",
        startTime: "09:00",
        durationMin: 30,
        isActive: true,
      },
    ],
    occurrences: [
      {
        id: "occ_source",
        goalId: "action_focus",
        categoryId: "cat_work",
        outcomeId: "outcome_main",
        date: DATE_KEY,
        start: "09:00",
        slotKey: "09:00",
        durationMinutes: 30,
        status: "planned",
        scheduleRuleId: "rule_focus",
        timeType: "fixed",
      },
    ],
    sessionHistory: [],
    ui: {},
    ...overrides,
  };
}

function getOccurrence(state, id) {
  return state.occurrences.find((occurrence) => occurrence.id === id);
}

function applyMoveLater(state = baseState()) {
  return applyOccurrenceRepair({
    state,
    occurrenceId: "occ_source",
    repair: {
      type: PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
      reason: "test_move",
    },
    now: NOW,
  });
}

describe("planningRepairModel", () => {
  it("builds deterministic repair options without mutating state", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    const result = buildRepairOptions({ state, occurrenceId: "occ_source", selectedDateKey: DATE_KEY, now: NOW });

    expect(result.ok).toBe(true);
    expect(result.options.map((option) => option.type)).toEqual([
      PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
      PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
      PLANNING_REPAIR_TYPE.CHOOSE_TIME,
      PLANNING_REPAIR_TYPE.REDUCE_DURATION,
      PLANNING_REPAIR_TYPE.SKIP_ONCE,
      PLANNING_REPAIR_TYPE.CANCEL_ONCE,
    ]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("moves later today by creating a planned target and marking the source rescheduled", () => {
    const state = baseState();
    const result = applyMoveLater(state);

    expect(result.ok).toBe(true);
    expect(result.nextState).not.toBe(state);
    const source = getOccurrence(result.nextState, "occ_source");
    const target = result.nextState.occurrences.find((occurrence) => occurrence.id !== "occ_source");
    expect(source.status).toBe("rescheduled");
    expect(target.status).toBe("planned");
    expect(target.date).toBe(DATE_KEY);
    expect(target.start).toBe("10:30");
    expect(source.repairV1).toMatchObject({
      version: 1,
      type: PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
      sourceOccurrenceId: "occ_source",
      targetOccurrenceId: target.id,
      protectFromRuleSync: true,
      reason: "test_move",
    });
    expect(target.repairV1).toMatchObject({
      sourceOccurrenceId: "occ_source",
      targetOccurrenceId: target.id,
      protectFromRuleSync: true,
    });
  });

  it("moves tomorrow while preserving action, objective, and category links", () => {
    const state = baseState();
    const result = applyOccurrenceRepair({
      state,
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    const target = result.nextState.occurrences.find((occurrence) => occurrence.id !== "occ_source");
    expect(target).toMatchObject({
      goalId: "action_focus",
      categoryId: "cat_work",
      outcomeId: "outcome_main",
      date: "2026-05-21",
      start: "09:00",
      status: "planned",
    });
  });

  it("choose_time validates the target and moves to a nearby free slot on conflict", () => {
    const state = baseState({
      goals: [
        ...baseState().goals,
        { id: "action_admin", type: "PROCESS", planType: "ONE_OFF", categoryId: "cat_work", priority: "bonus" },
      ],
      occurrences: [
        ...baseState().occurrences,
        {
          id: "occ_busy",
          goalId: "action_admin",
          date: DATE_KEY,
          start: "10:00",
          slotKey: "10:00",
          durationMinutes: 30,
          status: "planned",
        },
      ],
    });

    const result = applyOccurrenceRepair({
      state,
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.CHOOSE_TIME, dateKey: DATE_KEY, start: "10:00" },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain("target_time_adjusted");
    const target = result.nextState.occurrences.find(
      (occurrence) => occurrence.goalId === "action_focus" && occurrence.id !== "occ_source"
    );
    expect(target.start).toBe("10:30");
  });

  it("reduces duration in place while preserving links and adding repair metadata", () => {
    const state = baseState({
      occurrences: [{ ...baseState().occurrences[0], durationMinutes: 50 }],
    });
    const result = applyOccurrenceRepair({
      state,
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.REDUCE_DURATION, durationMinutes: 20, reason: "simplify" },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.nextState.occurrences).toHaveLength(1);
    expect(getOccurrence(result.nextState, "occ_source")).toMatchObject({
      goalId: "action_focus",
      categoryId: "cat_work",
      outcomeId: "outcome_main",
      durationMinutes: 20,
      status: "planned",
      repairV1: {
        version: 1,
        type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
        sourceOccurrenceId: "occ_source",
        targetOccurrenceId: "occ_source",
        protectFromRuleSync: true,
        reason: "simplify",
        sourceScheduleRuleId: "rule_focus",
        fromDate: DATE_KEY,
        fromStart: "09:00",
        fromDurationMinutes: 50,
      },
    });
  });

  it("skip once sets skipped without deleting the occurrence", () => {
    const result = applyOccurrenceRepair({
      state: baseState(),
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.SKIP_ONCE },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.nextState.occurrences).toHaveLength(1);
    expect(getOccurrence(result.nextState, "occ_source").status).toBe("skipped");
    expect(getOccurrence(result.nextState, "occ_source").repairV1.type).toBe(PLANNING_REPAIR_TYPE.SKIP_ONCE);
  });

  it("cancel once sets canceled without deleting the occurrence", () => {
    const result = applyOccurrenceRepair({
      state: baseState(),
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.CANCEL_ONCE },
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.nextState.occurrences).toHaveLength(1);
    expect(getOccurrence(result.nextState, "occ_source").status).toBe("canceled");
    expect(getOccurrence(result.nextState, "occ_source").repairV1.type).toBe(PLANNING_REPAIR_TYPE.CANCEL_ONCE);
  });

  it("fails safely for missing, active, final, and deferred split repairs", () => {
    const missing = applyOccurrenceRepair({
      state: baseState(),
      occurrenceId: "missing",
      repair: { type: PLANNING_REPAIR_TYPE.SKIP_ONCE },
      now: NOW,
    });
    const activeState = baseState({
      ui: { activeSession: { id: "session_1", occurrenceId: "occ_source", runtimePhase: "in_progress" } },
    });
    const active = applyOccurrenceRepair({
      state: activeState,
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.REDUCE_DURATION },
      now: NOW,
    });
    const finalState = baseState({
      occurrences: [{ ...baseState().occurrences[0], status: "done" }],
    });
    const final = applyOccurrenceRepair({
      state: finalState,
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW },
      now: NOW,
    });
    const split = applyOccurrenceRepair({
      state: baseState(),
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.SPLIT_BLOCK },
      now: NOW,
    });

    expect(missing.ok).toBe(false);
    expect(missing.nextState).toBeDefined();
    expect(active.ok).toBe(false);
    expect(active.warnings).toContain("occurrence_active");
    expect(final.ok).toBe(false);
    expect(final.warnings).toContain("occurrence_final_done");
    expect(split.ok).toBe(false);
    expect(split.warnings).toContain("split_block_deferred");
  });

  it("builds a reduce-load preview from future planned blocks without mutating", () => {
    const state = baseState({
      goals: [
        ...baseState().goals,
        { id: "action_low", type: "PROCESS", planType: "ONE_OFF", categoryId: "cat_work", priority: "bonus" },
        { id: "action_high", type: "PROCESS", planType: "ONE_OFF", categoryId: "cat_work", priority: "prioritaire" },
      ],
      occurrences: [
        { id: "occ_active", goalId: "action_focus", date: DATE_KEY, start: "11:00", durationMinutes: 30, status: "in_progress" },
        { id: "occ_done", goalId: "action_focus", date: DATE_KEY, start: "12:00", durationMinutes: 30, status: "done" },
        { id: "occ_skipped", goalId: "action_focus", date: DATE_KEY, start: "13:00", durationMinutes: 30, status: "skipped" },
        { id: "occ_canceled", goalId: "action_focus", date: DATE_KEY, start: "14:00", durationMinutes: 30, status: "canceled" },
        { id: "occ_missed", goalId: "action_focus", date: DATE_KEY, start: "15:00", durationMinutes: 30, status: "missed" },
        { id: "occ_rescheduled", goalId: "action_focus", date: DATE_KEY, start: "16:00", durationMinutes: 30, status: "rescheduled" },
        { id: "occ_high", goalId: "action_high", date: DATE_KEY, start: "17:00", durationMinutes: 60, status: "planned" },
        { id: "occ_low", goalId: "action_low", date: DATE_KEY, start: "18:00", durationMinutes: 30, status: "planned" },
      ],
    });
    const before = JSON.stringify(state);

    const plan = buildReduceLoadPlan({ state, selectedDateKey: DATE_KEY, now: NOW });

    expect(plan.ok).toBe(true);
    expect(plan.candidateOccurrenceIds).toEqual(["occ_low", "occ_high"]);
    expect(plan.proposedRepairs).toEqual([
      {
        type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
        occurrenceId: "occ_low",
        reason: PLANNING_REPAIR_TYPE.REDUCE_TODAY_LOAD,
      },
      {
        type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
        occurrenceId: "occ_high",
        durationMinutes: 30,
        reason: PLANNING_REPAIR_TYPE.REDUCE_TODAY_LOAD,
      },
    ]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("applies reduce-load only when explicitly called", () => {
    const state = baseState({
      goals: [
        ...baseState().goals,
        { id: "action_low", type: "PROCESS", planType: "ONE_OFF", categoryId: "cat_work", priority: "bonus" },
      ],
      occurrences: [
        {
          id: "occ_low",
          goalId: "action_low",
          date: DATE_KEY,
          start: "18:00",
          durationMinutes: 30,
          status: "planned",
        },
      ],
    });
    const plan = buildReduceLoadPlan({ state, selectedDateKey: DATE_KEY, now: NOW });
    expect(getOccurrence(state, "occ_low").status).toBe("planned");

    const result = applyReduceLoadPlan({ state, plan, now: NOW });

    expect(result.ok).toBe(true);
    expect(getOccurrence(result.nextState, "occ_low").status).toBe("rescheduled");
    expect(result.nextState.occurrences).toHaveLength(2);
  });

  it("passes system invariants after a confirmed repair", () => {
    const result = applyMoveLater(baseState());
    const invariantResult = validateSystemInvariants(result.nextState);

    expect(result.ok).toBe(true);
    expect(invariantResult.ok).toBe(true);
  });

  it("keeps the old rescheduled source out of Today primary action selection", () => {
    const result = applyMoveLater(baseState());
    const todayData = buildTodayData({
      data: result.nextState,
      selectedDateKey: DATE_KEY,
      now: NOW,
    });

    expect(todayData.primaryAction.occurrenceId).not.toBe("occ_source");
    expect(todayData.primaryAction.occurrenceId).toBe(result.changedOccurrenceIds[1]);
  });

  it("prevents schedule-rule regeneration from duplicating repaired source and target slots", () => {
    const moved = applyOccurrenceRepair({
      state: baseState(),
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW },
      now: NOW,
    });
    expect(moved.ok).toBe(true);

    const first = ensureWindowFromScheduleRules(moved.nextState, "2026-05-20", "2026-05-22", null, NOW);
    const second = ensureWindowFromScheduleRules(first, "2026-05-20", "2026-05-22", null, NOW);

    const actionOccurrences = second.occurrences.filter((occurrence) => occurrence.goalId === "action_focus");
    expect(actionOccurrences.map((occurrence) => `${occurrence.date}:${occurrence.start}:${occurrence.status}`)).toEqual([
      "2026-05-20:09:00:rescheduled",
      "2026-05-21:09:00:planned",
      "2026-05-22:09:00:planned",
    ]);
    expect(second).toBe(first);
  });
});
