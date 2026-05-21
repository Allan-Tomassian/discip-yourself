import { describe, expect, it } from "vitest";
import { buildTodayData } from "../today/todayDataAdapter";
import { PLANNING_REPAIR_TYPE } from "../../logic/planningRepairModel";
import { validateSystemInvariants } from "../../logic/systemInvariants";
import {
  SYSTEM_ANALYSIS_APPLY_ERROR,
  applySystemAnalysisSelectedCorrections,
  buildSystemAnalysisApplicationPreview,
} from "./systemAnalysisApplyModel";

const NOW = new Date("2026-05-20T10:00:00");
const DATE_KEY = "2026-05-20";

function baseState(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      {
        id: "out_focus",
        type: "OUTCOME",
        title: "Livrer",
        categoryId: "cat_work",
      },
      {
        id: "act_focus",
        type: "PROCESS",
        planType: "ONE_OFF",
        title: "Focus profond",
        categoryId: "cat_work",
        parentId: "out_focus",
        outcomeId: "out_focus",
      },
    ],
    occurrences: [
      {
        id: "occ_focus",
        goalId: "act_focus",
        categoryId: "cat_work",
        outcomeId: "out_focus",
        date: DATE_KEY,
        start: "09:00",
        durationMinutes: 45,
        status: "planned",
      },
    ],
    sessionHistory: [],
    scheduleRules: [],
    ui: {},
    ...overrides,
  };
}

function item({
  id = "item_reduce",
  label = "Réduire la durée",
  description = "Réduire à 30 min.",
  selected = true,
  selectable = true,
  group = "occurrences",
  targetType,
  repairPreview = {
    type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
    occurrenceId: "occ_focus",
    durationMinutes: 30,
  },
} = {}) {
  return {
    id,
    label,
    description,
    group,
    targetType,
    selected,
    selectable,
    status: selectable ? "valid" : "unsupported",
    validationIssues: [],
    repairPreview,
  };
}

function reviewFixture(items = [item()]) {
  return {
    items,
    groups: [{
      id: "occurrences",
      label: "Blocs",
      items,
      itemCount: items.length,
      selectableCount: items.filter((entry) => entry.selectable).length,
      validCount: items.filter((entry) => entry.selectable).length,
    }],
    selectedIds: items.filter((entry) => entry.selected && entry.selectable).map((entry) => entry.id),
    hasValidSelection: items.some((entry) => entry.selected && entry.selectable),
  };
}

function occurrence(state, id = "occ_focus") {
  return state.occurrences.find((entry) => entry.id === id);
}

describe("systemAnalysisApplyModel", () => {
  it("builds a final confirmation preview from selected applicable corrections", () => {
    const review = reviewFixture([
      item(),
      item({
        id: "item_protect",
        label: "Protéger ce bloc",
        selected: false,
        selectable: false,
        repairPreview: null,
      }),
    ]);

    const preview = buildSystemAnalysisApplicationPreview({ review });

    expect(preview.ok).toBe(true);
    expect(preview.selectedItems).toHaveLength(1);
    expect(preview.notAppliedItems.map((entry) => entry.label)).toContain("Protéger ce bloc");
    expect(preview.summary.willChange[0]).toContain("Réduire la durée");
  });

  it("treats v2 priority occurrence repairs as applicable without widening application scope", () => {
    const review = reviewFixture([
      item({
        id: "ci_reduce",
        group: "priority",
        targetType: "occurrence",
      }),
      item({
        id: "ci_objective",
        label: "Mettre en pause",
        group: "priority",
        targetType: "objective",
        selected: true,
        selectable: true,
        repairPreview: {
          type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
          occurrenceId: "occ_focus",
          durationMinutes: 25,
        },
      }),
    ]);

    const preview = buildSystemAnalysisApplicationPreview({ review });

    expect(preview.ok).toBe(true);
    expect(preview.selectedItems.map((entry) => entry.id)).toEqual(["ci_reduce"]);
    expect(preview.selectedNotAppliedItems.map((entry) => entry.id)).toEqual(["ci_objective"]);
  });

  it("applies reduce_duration through PlanningRepairModel and preserves links", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    const result = applySystemAnalysisSelectedCorrections({
      state,
      review: reviewFixture(),
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
    expect(occurrence(result.nextState)).toMatchObject({
      goalId: "act_focus",
      categoryId: "cat_work",
      outcomeId: "out_focus",
      durationMinutes: 30,
    });
    expect(result.changedOccurrenceIds).toContain("occ_focus");
    expect(result.summary.title).toBe("Corrections appliquées");
    expect(validateSystemInvariants(result.nextState).ok).toBe(true);
  });

  it("applies choose_time move and keeps the old source out of Today primary work", () => {
    const state = baseState();
    const result = applySystemAnalysisSelectedCorrections({
      state,
      review: reviewFixture([
        item({
          id: "item_move",
          label: "Déplacer le bloc",
          description: "Vers 2026-05-21 à 10:30.",
          repairPreview: {
            type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
            occurrenceId: "occ_focus",
            dateKey: "2026-05-21",
            start: "10:30",
          },
        }),
      ]),
      now: NOW,
    });

    const targetId = result.changedOccurrenceIds.find((id) => id !== "occ_focus");
    const todayData = buildTodayData({ data: result.nextState, selectedDateKey: DATE_KEY, now: NOW });

    expect(result.ok).toBe(true);
    expect(occurrence(result.nextState).status).toBe("rescheduled");
    expect(occurrence(result.nextState, targetId)).toMatchObject({
      status: "planned",
      date: "2026-05-21",
      start: "10:30",
      goalId: "act_focus",
      categoryId: "cat_work",
      outcomeId: "out_focus",
    });
    expect(todayData.primaryAction?.occurrenceId).not.toBe("occ_focus");
    expect(validateSystemInvariants(result.nextState).ok).toBe(true);
  });

  it("applies move_tomorrow through the selected repair preview", () => {
    const result = applySystemAnalysisSelectedCorrections({
      state: baseState(),
      review: reviewFixture([
        item({
          id: "item_tomorrow",
          label: "Reporter le bloc",
          repairPreview: {
            type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
            occurrenceId: "occ_focus",
          },
        }),
      ]),
      now: NOW,
    });

    const targetId = result.changedOccurrenceIds.find((id) => id !== "occ_focus");
    expect(result.ok).toBe(true);
    expect(occurrence(result.nextState).status).toBe("rescheduled");
    expect(occurrence(result.nextState, targetId).date).toBe("2026-05-21");
  });

  it("applies skip_once only when the review item is selectable", () => {
    const selectable = applySystemAnalysisSelectedCorrections({
      state: baseState(),
      review: reviewFixture([
        item({
          id: "item_skip",
          label: "Ignorer cette occurrence",
          repairPreview: {
            type: PLANNING_REPAIR_TYPE.SKIP_ONCE,
            occurrenceId: "occ_focus",
          },
        }),
      ]),
      now: NOW,
    });
    const notSelectable = applySystemAnalysisSelectedCorrections({
      state: baseState(),
      review: reviewFixture([
        item({
          id: "item_skip",
          label: "Ignorer cette occurrence",
          selected: true,
          selectable: false,
          repairPreview: {
            type: PLANNING_REPAIR_TYPE.SKIP_ONCE,
            occurrenceId: "occ_focus",
          },
        }),
      ]),
      now: NOW,
    });

    expect(selectable.ok).toBe(true);
    expect(occurrence(selectable.nextState).status).toBe("skipped");
    expect(notSelectable.ok).toBe(false);
    expect(notSelectable.errorCode).toBe(SYSTEM_ANALYSIS_APPLY_ERROR.NO_SELECTED_CORRECTIONS);
  });

  it("never applies unsupported protect/objective/action/next7Days review items", () => {
    const result = applySystemAnalysisSelectedCorrections({
      state: baseState(),
      review: reviewFixture([
        item(),
        item({ id: "protect", group: "occurrences", label: "Protéger ce bloc", selected: true, selectable: false, repairPreview: null }),
        item({ id: "objective", group: "objectives", label: "Protéger objectif", selected: true, selectable: false, repairPreview: null }),
        item({ id: "action", group: "actions", label: "Shorten action", selected: true, selectable: false, repairPreview: null }),
        item({ id: "next7", group: "next7Days", label: "Plan 7 jours", selected: true, selectable: false, repairPreview: null }),
      ]),
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.appliedItems).toHaveLength(1);
    expect(result.appliedItems[0].id).toBe("item_reduce");
    expect(result.warnings).toContain("selected_items_not_applicable");
  });

  it("fails the whole batch when duplicate selected repairs target one occurrence", () => {
    const state = baseState();
    const result = applySystemAnalysisSelectedCorrections({
      state,
      review: reviewFixture([
        item({ id: "one" }),
        item({ id: "two", repairPreview: { type: PLANNING_REPAIR_TYPE.REDUCE_DURATION, occurrenceId: "occ_focus", durationMinutes: 25 } }),
      ]),
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(SYSTEM_ANALYSIS_APPLY_ERROR.DUPLICATE_OCCURRENCE_REPAIR);
    expect(result.nextState).toBe(state);
  });

  it("fails the whole batch if one selected repair cannot be applied", () => {
    const state = baseState({
      occurrences: [
        ...baseState().occurrences,
        {
          id: "occ_second",
          goalId: "act_focus",
          categoryId: "cat_work",
          outcomeId: "out_focus",
          date: DATE_KEY,
          start: "11:00",
          durationMinutes: 45,
          status: "planned",
        },
      ],
    });
    const result = applySystemAnalysisSelectedCorrections({
      state,
      review: reviewFixture([
        item(),
        item({
          id: "bad_move",
          label: "Déplacer le bloc",
          repairPreview: {
            type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
            occurrenceId: "occ_second",
            dateKey: DATE_KEY,
            start: "11:00",
          },
        }),
      ]),
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(SYSTEM_ANALYSIS_APPLY_ERROR.REPAIR_FAILED);
    expect(result.nextState).toBe(state);
    expect(occurrence(state).durationMinutes).toBe(45);
  });

  it("blocks commit when the repaired state fails system invariants", () => {
    const state = baseState({
      categories: [],
    });
    const result = applySystemAnalysisSelectedCorrections({
      state,
      review: reviewFixture(),
      now: NOW,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe(SYSTEM_ANALYSIS_APPLY_ERROR.INVARIANT_ERROR);
    expect(result.nextState).toBe(state);
    expect(result.invariantIssues.map((issue) => issue.code)).toContain("PROCESS_ACTION_MISSING_CATEGORY");
  });
});
