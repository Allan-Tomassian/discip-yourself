import { describe, expect, it } from "vitest";
import { PLANNING_REPAIR_TYPE } from "../../logic/planningRepairModel";
import {
  SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS,
  buildSystemAnalysisCorrectionReview,
} from "./systemAnalysisCorrectionReviewModel";

const SNAPSHOT = {
  version: 1,
  period: { startDateKey: "2026-05-07", endDateKey: "2026-05-20", days: 14 },
  referenceDateKey: "2026-05-20",
};

function stateFixture(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      { id: "out_focus", type: "OUTCOME", title: "Livrer", categoryId: "cat_work" },
      { id: "act_focus", type: "PROCESS", title: "Focus profond", categoryId: "cat_work", parentId: "out_focus" },
    ],
    occurrences: [
      { id: "occ_focus", goalId: "act_focus", date: "2026-05-20", start: "09:00", durationMinutes: 45, status: "planned" },
    ],
    ...overrides,
  };
}

function correctionDraft(overrides = {}) {
  return {
    correctedLoad: {
      targetBlocksPerDay: 2,
      maxDailyMinutes: 90,
      reason: "Charge plus réaliste.",
    },
    occurrenceAdjustments: [],
    objectiveAdjustments: [],
    actionAdjustments: [],
    next7DaysPlan: [],
    validationRequirements: [],
    userConfirmationRequired: true,
    ...overrides,
  };
}

function resultFixture(draft) {
  return { correctionDraft: draft };
}

function firstOccurrenceItem(review) {
  return review.items.find((item) => item.group === "occurrences");
}

describe("buildSystemAnalysisCorrectionReview", () => {
  it("maps move corrections to choose_time when date and start are valid", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "move",
          proposedDateKey: "2026-05-22",
          proposedStart: "10:30",
          reason: "Meilleur créneau.",
          confidence: 0.8,
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    const item = firstOccurrenceItem(review);
    expect(item).toMatchObject({
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
      selectable: true,
      repairPreview: {
        type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
        occurrenceId: "occ_focus",
        dateKey: "2026-05-22",
        start: "10:30",
      },
    });
  });

  it("maps reduce_duration corrections to reduce_duration when duration is valid", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "reduce_duration",
          proposedDurationMinutes: 25,
          reason: "Version plus courte.",
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(firstOccurrenceItem(review).repairPreview).toMatchObject({
      type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
      durationMinutes: 25,
    });
  });

  it("maps postpone to move_tomorrow when proposed date is exactly tomorrow", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "postpone",
          proposedDateKey: "2026-05-21",
          reason: "Demain protège la charge.",
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(firstOccurrenceItem(review).repairPreview).toMatchObject({
      type: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
      dateKey: "2026-05-21",
    });
  });

  it("maps postpone to choose_time when date and start are provided for another day", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "postpone",
          proposedDateKey: "2026-05-23",
          proposedStart: "14:00",
          reason: "Créneau plus stable.",
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(firstOccurrenceItem(review).repairPreview).toMatchObject({
      type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
      dateKey: "2026-05-23",
      start: "14:00",
    });
  });

  it("maps skip_once only with destructive confirmation requirement", () => {
    const withoutRequirement = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{ occurrenceId: "occ_focus", action: "skip_once", reason: "À supprimer aujourd’hui." }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });
    const withRequirement = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{ occurrenceId: "occ_focus", action: "skip_once", reason: "À supprimer aujourd’hui." }],
        validationRequirements: ["destructive_confirmation"],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(firstOccurrenceItem(withoutRequirement).status).toBe(SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED);
    expect(firstOccurrenceItem(withRequirement).repairPreview).toMatchObject({
      type: PLANNING_REPAIR_TYPE.SKIP_ONCE,
    });
  });

  it("marks protect, objective, action, and next7Days entries as non-selectable review items", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{ occurrenceId: "occ_focus", action: "protect", reason: "À protéger." }],
        objectiveAdjustments: [{ goalId: "out_focus", action: "protect", reason: "Objectif moteur." }],
        actionAdjustments: [{ actionId: "act_focus", action: "shorten", reason: "Action longue." }],
        next7DaysPlan: [{ dateKey: "2026-05-21", focus: "Alléger", blocks: [], totalMinutes: 60, riskLevel: "low" }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(review.items.find((item) => item.group === "occurrences")).toMatchObject({
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED,
      selectable: false,
    });
    expect(review.items.find((item) => item.group === "objectives").selectable).toBe(false);
    expect(review.items.find((item) => item.group === "actions").selectable).toBe(false);
    expect(review.items.find((item) => item.group === "next7Days").selectable).toBe(false);
  });

  it("surfaces validator issues and avoids state mutation or persisted occurrence objects", () => {
    const state = stateFixture();
    const before = JSON.stringify(state);
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "missing_occ",
          action: "move",
          proposedDateKey: "2026-05-21",
          proposedStart: "09:00",
          reason: "Référence invalide.",
        }],
      })),
      state,
      snapshot: SNAPSHOT,
    });

    const serialized = JSON.stringify(review);
    expect(review.contractIssues.map((issue) => issue.code)).toContain("CORRECTION_OCCURRENCE_MISSING");
    expect(firstOccurrenceItem(review).validationIssues.map((issue) => issue.code)).toContain("CORRECTION_OCCURRENCE_MISSING");
    expect(JSON.stringify(state)).toBe(before);
    expect(serialized).not.toContain("\"status\":\"planned\"");
    expect(serialized).not.toContain("\"goalId\":\"act_focus\"");
  });

  it("reflects selectedIds and summarizes only selected valid corrections", () => {
    const initial = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "reduce_duration",
          proposedDurationMinutes: 30,
          reason: "Version plus courte.",
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });
    const selected = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "reduce_duration",
          proposedDurationMinutes: 30,
          reason: "Version plus courte.",
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
      selectedIds: [initial.items[0].id, "missing"],
    });

    expect(selected.selectedIds).toEqual([initial.items[0].id]);
    expect(selected.hasValidSelection).toBe(true);
    expect(selected.confirmationSummary.items).toHaveLength(1);
    expect(selected.confirmationSummary.items[0].repairPreview.type).toBe(PLANNING_REPAIR_TYPE.REDUCE_DURATION);
  });

  it("marks persisted applied corrections as non-selectable and ignores selectedIds for them", () => {
    const initial = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "reduce_duration",
          proposedDurationMinutes: 30,
          reason: "Version plus courte.",
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });
    const applied = buildSystemAnalysisCorrectionReview({
      result: resultFixture(correctionDraft({
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "reduce_duration",
          proposedDurationMinutes: 30,
          reason: "Version plus courte.",
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
      selectedIds: [initial.items[0].id],
      appliedCorrectionIds: [initial.items[0].id],
    });

    expect(applied.items[0]).toMatchObject({
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.APPLIED,
      applied: true,
      selectable: false,
      selected: false,
      repairPreview: null,
    });
    expect(applied.selectedIds).toEqual([]);
    expect(applied.hasValidSelection).toBe(false);
  });
});
