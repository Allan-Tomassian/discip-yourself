import { describe, expect, it } from "vitest";
import {
  EXECUTION_SURFACE_STATUS,
  deriveExecutionStatusForOccurrence,
} from "../../logic/executionStatus";
import {
  PLANNING_REPAIR_TYPE,
  applyOccurrenceRepair,
} from "../../logic/planningRepairModel";
import { validateSystemInvariants } from "../../logic/systemInvariants";
import { applyRecoveryOption } from "./recoveryRepairModel";
import { buildRecoveryOptions } from "./recoverySheetModel";
import { RECOVERY_CONTEXT, RECOVERY_OPTION_TYPE } from "./recoveryTypes";

const DATE_KEY = "2026-05-20";
const NOW = new Date("2026-05-20T10:00:00");

function baseState(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      {
        id: "outcome_main",
        type: "OUTCOME",
        title: "Construire le système",
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
        priority: "prioritaire",
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
  return state?.occurrences?.find((occurrence) => occurrence.id === id) || null;
}

function optionTypes(model) {
  return model.options.map((option) => option.type);
}

function optionByType(model, type) {
  return model.options.find((option) => option.type === type) || null;
}

function buildModel(state, context = "") {
  return buildRecoveryOptions({
    state,
    occurrenceId: "occ_source",
    context,
    now: NOW,
    selectedDateKey: DATE_KEY,
  });
}

function allOptionCopy(model) {
  return [
    model.problem?.title,
    model.problem?.description,
    ...model.options.flatMap((option) => [
      option.label,
      option.description,
      option.reason,
      option.preview?.summary,
    ]),
  ].filter(Boolean).join(" ");
}

describe("recovery model foundation", () => {
  it("builds capped deterministic options for a late occurrence without mutating state", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    const model = buildModel(state, RECOVERY_CONTEXT.LATE);

    expect(model.ok).toBe(true);
    expect(model.context).toBe(RECOVERY_CONTEXT.LATE);
    expect(model.problem.title).toBe("Ce bloc est en retard.");
    expect(optionTypes(model)).toEqual([
      RECOVERY_OPTION_TYPE.REDUCE_DURATION,
      RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY,
      RECOVERY_OPTION_TYPE.MOVE_TOMORROW,
      RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL,
    ]);
    expect(model.options).toHaveLength(4);
    expect(optionByType(model, RECOVERY_OPTION_TYPE.REDUCE_DURATION)).toMatchObject({
      label: "Réduire à 15 min",
      confirmationRequired: true,
      destructive: false,
    });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("builds capped options for a missed occurrence while default repair still rejects missed", () => {
    const state = baseState({
      occurrences: [{ ...baseState().occurrences[0], status: "missed" }],
    });
    const model = buildModel(state, RECOVERY_CONTEXT.MISSED);
    const defaultRepair = applyOccurrenceRepair({
      state,
      occurrenceId: "occ_source",
      repair: { type: PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY },
      now: NOW,
    });

    expect(model.ok).toBe(true);
    expect(model.problem.title).toBe("Ce bloc n’a pas été lancé.");
    expect(optionTypes(model)).toEqual([
      RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY,
      RECOVERY_OPTION_TYPE.MOVE_TOMORROW,
      RECOVERY_OPTION_TYPE.SKIP_ONCE,
      RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL,
    ]);
    expect(defaultRepair.ok).toBe(false);
    expect(defaultRepair.warnings).toContain("occurrence_final_missed");
  });

  it("builds options for a blocked occurrence derived from session history", () => {
    const state = baseState({
      sessionHistory: [
        {
          id: "hist_blocked",
          occurrenceId: "occ_source",
          actionId: "action_focus",
          dateKey: DATE_KEY,
          state: "ended",
          endedReason: "blocked",
          endAt: "2026-05-20T09:20:00.000Z",
        },
      ],
    });
    const model = buildRecoveryOptions({
      state,
      occurrenceId: "occ_source",
      now: NOW,
      selectedDateKey: DATE_KEY,
    });

    expect(model.context).toBe(RECOVERY_CONTEXT.BLOCKED);
    expect(optionTypes(model)).toEqual([
      RECOVERY_OPTION_TYPE.REDUCE_DURATION,
      RECOVERY_OPTION_TYPE.CHOOSE_TIME,
      RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP,
      RECOVERY_OPTION_TYPE.SKIP_ONCE,
    ]);
  });

  it("builds options for a reported occurrence derived from session history", () => {
    const state = baseState({
      sessionHistory: [
        {
          id: "hist_reported",
          occurrenceId: "occ_source",
          actionId: "action_focus",
          dateKey: DATE_KEY,
          state: "ended",
          endedReason: "reported",
          endAt: "2026-05-20T09:20:00.000Z",
        },
      ],
    });
    const model = buildRecoveryOptions({
      state,
      occurrenceId: "occ_source",
      now: NOW,
      selectedDateKey: DATE_KEY,
    });

    expect(model.context).toBe(RECOVERY_CONTEXT.REPORTED);
    expect(optionTypes(model)).toEqual([
      RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY,
      RECOVERY_OPTION_TYPE.MOVE_TOMORROW,
      RECOVERY_OPTION_TYPE.CHOOSE_TIME,
      RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP,
    ]);
  });

  it("reduce recovery for blocked and reported creates a clean planned target", () => {
    for (const endedReason of ["blocked", "reported"]) {
      const state = baseState({
        sessionHistory: [
          {
            id: `hist_${endedReason}`,
            occurrenceId: "occ_source",
            actionId: "action_focus",
            dateKey: DATE_KEY,
            state: "ended",
            endedReason,
            endAt: "2026-05-20T09:20:00.000Z",
          },
        ],
      });
      const model = buildModel(state, endedReason);
      const option = optionByType(model, RECOVERY_OPTION_TYPE.REDUCE_DURATION) ||
        optionByType(model, RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY);
      const result = applyRecoveryOption({ state, occurrenceId: "occ_source", option, now: NOW });
      const source = getOccurrence(result.nextState, "occ_source");
      const targetId = result.changedOccurrenceIds.find((id) => id !== "occ_source");
      const target = getOccurrence(result.nextState, targetId);
      const sourceStatus = deriveExecutionStatusForOccurrence(source, {
        sessionHistory: result.nextState.sessionHistory,
        dateKey: DATE_KEY,
      });
      const targetStatus = deriveExecutionStatusForOccurrence(target, {
        sessionHistory: result.nextState.sessionHistory,
        dateKey: target.date,
      });

      expect(result.ok).toBe(true);
      expect(source.status).toBe("rescheduled");
      expect(target.status).toBe("planned");
      expect(sourceStatus.status).toBe(EXECUTION_SURFACE_STATUS.POSTPONED);
      expect(targetStatus.status).toBe(EXECUTION_SURFACE_STATUS.PLANNED);
    }
  });

  it("missed recovery moves later today through the recovery helper", () => {
    const state = baseState({
      occurrences: [{ ...baseState().occurrences[0], status: "missed" }],
    });
    const model = buildModel(state, RECOVERY_CONTEXT.MISSED);
    const option = optionByType(model, RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY);
    const result = applyRecoveryOption({ state, occurrenceId: "occ_source", option, now: NOW });
    const source = getOccurrence(result.nextState, "occ_source");
    const targetId = result.changedOccurrenceIds.find((id) => id !== "occ_source");
    const target = getOccurrence(result.nextState, targetId);

    expect(result.ok).toBe(true);
    expect(source.status).toBe("rescheduled");
    expect(target).toMatchObject({
      goalId: "action_focus",
      categoryId: "cat_work",
      outcomeId: "outcome_main",
      date: DATE_KEY,
      status: "planned",
    });
  });

  it("move tomorrow preserves action, objective, and category links", () => {
    const state = baseState();
    const model = buildModel(state, RECOVERY_CONTEXT.LATE);
    const option = optionByType(model, RECOVERY_OPTION_TYPE.MOVE_TOMORROW);
    const result = applyRecoveryOption({ state, occurrenceId: "occ_source", option, now: NOW });
    const targetId = result.changedOccurrenceIds.find((id) => id !== "occ_source");
    const target = getOccurrence(result.nextState, targetId);

    expect(result.ok).toBe(true);
    expect(target).toMatchObject({
      goalId: "action_focus",
      categoryId: "cat_work",
      outcomeId: "outcome_main",
      date: "2026-05-21",
      start: "09:00",
      status: "planned",
    });
  });

  it("skip once requires confirmation and marks the occurrence skipped without deletion", () => {
    const state = baseState({
      occurrences: [{ ...baseState().occurrences[0], status: "missed" }],
    });
    const model = buildModel(state, RECOVERY_CONTEXT.MISSED);
    const option = optionByType(model, RECOVERY_OPTION_TYPE.SKIP_ONCE);
    const result = applyRecoveryOption({ state, occurrenceId: "occ_source", option, now: NOW });

    expect(option).toMatchObject({
      confirmationRequired: true,
      destructive: true,
    });
    expect(result.ok).toBe(true);
    expect(result.nextState.occurrences).toHaveLength(1);
    expect(getOccurrence(result.nextState, "occ_source")).toMatchObject({
      status: "skipped",
      repairV1: { type: PLANNING_REPAIR_TYPE.SKIP_ONCE },
    });
  });

  it("non-mutating coach and planning options never mutate state", () => {
    const state = baseState();
    const model = buildModel(state, RECOVERY_CONTEXT.LATE);
    const planning = optionByType(model, RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL);
    const coach = buildModel(baseState({
      sessionHistory: [
        {
          id: "hist_blocked",
          occurrenceId: "occ_source",
          actionId: "action_focus",
          dateKey: DATE_KEY,
          state: "ended",
          endedReason: "blocked",
        },
      ],
    }), RECOVERY_CONTEXT.BLOCKED);
    const coachOption = optionByType(coach, RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP);

    expect(applyRecoveryOption({ state, occurrenceId: "occ_source", option: planning, now: NOW })).toMatchObject({
      ok: true,
      nextState: state,
      changedOccurrenceIds: [],
    });
    expect(applyRecoveryOption({ state, occurrenceId: "occ_source", option: coachOption, now: NOW })).toMatchObject({
      ok: true,
      nextState: state,
      changedOccurrenceIds: [],
    });
  });

  it("failed repair leaves state unchanged", () => {
    const state = baseState({
      sessionHistory: [
        {
          id: "hist_blocked",
          occurrenceId: "occ_source",
          actionId: "action_focus",
          dateKey: DATE_KEY,
          state: "ended",
          endedReason: "blocked",
        },
      ],
    });
    const model = buildModel(state, RECOVERY_CONTEXT.BLOCKED);
    const chooseTime = optionByType(model, RECOVERY_OPTION_TYPE.CHOOSE_TIME);
    const result = applyRecoveryOption({ state, occurrenceId: "occ_source", option: chooseTime, now: NOW });

    expect(result.ok).toBe(false);
    expect(result.nextState).toBe(state);
    expect(result.changedOccurrenceIds).toEqual([]);
  });

  it("successful recovery state passes system invariants", () => {
    const state = baseState();
    const model = buildModel(state, RECOVERY_CONTEXT.LATE);
    const option = optionByType(model, RECOVERY_OPTION_TYPE.REDUCE_DURATION);
    const result = applyRecoveryOption({ state, occurrenceId: "occ_source", option, now: NOW });
    const invariants = validateSystemInvariants(result.nextState);

    expect(result.ok).toBe(true);
    expect(invariants.ok).toBe(true);
    expect(result.invariantIssues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("handles postponed sources by repairing a safe target or offering non-mutating exits", () => {
    const state = baseState({
      occurrences: [
        {
          ...baseState().occurrences[0],
          status: "rescheduled",
          repairV1: {
            version: 1,
            type: PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
            sourceOccurrenceId: "occ_source",
            targetOccurrenceId: "occ_target",
            protectFromRuleSync: true,
          },
        },
        {
          ...baseState().occurrences[0],
          id: "occ_target",
          start: "10:30",
          slotKey: "10:30",
          status: "planned",
        },
      ],
    });
    const model = buildModel(state, RECOVERY_CONTEXT.POSTPONED);
    const withoutTarget = buildModel(baseState({
      occurrences: [{ ...baseState().occurrences[0], status: "rescheduled" }],
    }), RECOVERY_CONTEXT.POSTPONED);

    expect(model.occurrence.id).toBe("occ_target");
    expect(optionTypes(model)).toContain(RECOVERY_OPTION_TYPE.MOVE_TOMORROW);
    expect(optionTypes(withoutTarget)).toEqual([
      RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL,
      RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP,
    ]);
  });

  it("caps option lists and avoids vague or guilt-based copy", () => {
    const models = [
      buildModel(baseState(), RECOVERY_CONTEXT.LATE),
      buildModel(baseState({ occurrences: [{ ...baseState().occurrences[0], status: "missed" }] }), RECOVERY_CONTEXT.MISSED),
      buildModel(baseState({
        sessionHistory: [{
          id: "hist_blocked",
          occurrenceId: "occ_source",
          actionId: "action_focus",
          dateKey: DATE_KEY,
          state: "ended",
          endedReason: "blocked",
        }],
      }), RECOVERY_CONTEXT.BLOCKED),
    ];

    models.forEach((model) => {
      expect(model.options.length).toBeGreaterThanOrEqual(2);
      expect(model.options.length).toBeLessThanOrEqual(4);
      expect(allOptionCopy(model)).not.toMatch(/friction|culp|honte|faute|dette/i);
    });
  });
});
