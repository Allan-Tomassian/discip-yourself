import { describe, expect, it, vi } from "vitest";
import { buildRecoveryContext, buildRecoveryOptions } from "./recoverySheetModel";
import { commitRecoveryOptionState } from "./recoveryAppController";
import { RECOVERY_CONTEXT, RECOVERY_OPTION_TYPE } from "./recoveryTypes";

const DATE_KEY = "2026-05-20";
const NOW = new Date("2026-05-20T10:00:00");

function state(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      {
        id: "action_focus",
        type: "PROCESS",
        planType: "ONE_OFF",
        oneOffDate: DATE_KEY,
        title: "Bloc profond",
        categoryId: "cat_work",
      },
    ],
    occurrences: [
      {
        id: "occ_source",
        goalId: "action_focus",
        categoryId: "cat_work",
        date: DATE_KEY,
        start: "09:00",
        slotKey: "09:00",
        durationMinutes: 30,
        status: "missed",
      },
    ],
    sessionHistory: [],
    ui: {},
    ...overrides,
  };
}

function optionByType(model, type) {
  return model.options.find((option) => option.type === type) || null;
}

describe("recovery app controller", () => {
  it("builds a recovery context wrapper for app-level sheet requests", () => {
    const model = buildRecoveryContext({
      state: state(),
      occurrenceId: "occ_source",
      context: RECOVERY_CONTEXT.MISSED,
      selectedDateKey: DATE_KEY,
      now: NOW,
      source: "home_primary",
    });

    expect(model.ok).toBe(true);
    expect(model.request).toMatchObject({
      occurrenceId: "occ_source",
      context: RECOVERY_CONTEXT.MISSED,
      selectedDateKey: DATE_KEY,
      source: "home_primary",
    });
  });

  it("commits a successful mutating recovery through setData exactly once", () => {
    const current = state();
    const model = buildRecoveryOptions({
      state: current,
      occurrenceId: "occ_source",
      context: RECOVERY_CONTEXT.MISSED,
      selectedDateKey: DATE_KEY,
      now: NOW,
    });
    const setData = vi.fn();

    const result = commitRecoveryOptionState({
      state: current,
      occurrenceId: "occ_source",
      option: optionByType(model, RECOVERY_OPTION_TYPE.MOVE_TOMORROW),
      now: NOW,
      setData,
    });

    expect(result.ok).toBe(true);
    expect(setData).toHaveBeenCalledTimes(1);
    expect(setData.mock.calls[0][0]).toBe(result.nextState);
  });

  it("does not mutate when recovery application fails", () => {
    const current = state();
    const setData = vi.fn();

    const result = commitRecoveryOptionState({
      state: current,
      occurrenceId: "occ_source",
      option: { type: "unsupported_recovery" },
      now: NOW,
      setData,
    });

    expect(result.ok).toBe(false);
    expect(result.nextState).toBe(current);
    expect(setData).not.toHaveBeenCalled();
  });

  it("does not mutate for non-mutating Coach and Planning options", () => {
    const current = state();
    const setData = vi.fn();

    for (const type of [RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP, RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL]) {
      const result = commitRecoveryOptionState({
        state: current,
        occurrenceId: "occ_source",
        option: { type, label: type },
        now: NOW,
        setData,
      });

      expect(result.ok).toBe(true);
      expect(result.nextState).toBe(current);
    }
    expect(setData).not.toHaveBeenCalled();
  });
});
