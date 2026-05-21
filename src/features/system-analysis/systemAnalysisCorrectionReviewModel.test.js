import { describe, expect, it } from "vitest";
import { PLANNING_REPAIR_TYPE } from "../../logic/planningRepairModel";
import {
  SYSTEM_ANALYSIS_CONFIRMATION_LEVEL,
  SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION,
  SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE,
  SYSTEM_ANALYSIS_DRAFT_VERSION,
  SYSTEM_ANALYSIS_SUPPORT_STATUS,
} from "./systemAnalysisContract";
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

function correctionItem(overrides = {}) {
  return {
    id: "ci-move",
    type: "occurrence_move",
    targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE,
    targetId: "occ_focus",
    action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.MOVE,
    title: "Déplacer le bloc",
    whatChanges: "Déplacer le bloc vers un créneau plus stable.",
    why: "Le créneau actuel est fragile.",
    evidence: [{ occurrenceId: "occ_focus", facts: ["Bloc actuel exposé."] }],
    expectedImpact: "Exécution plus stable.",
    risk: "Risque faible.",
    confidence: 0.8,
    supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE,
    destructive: false,
    confirmationLevel: SYSTEM_ANALYSIS_CONFIRMATION_LEVEL.STANDARD,
    validationRequirements: ["user_confirmation"],
    proposedDateKey: "2026-05-22",
    proposedStart: "10:30",
    ...overrides,
  };
}

function v2Draft(items, overrides = {}) {
  return correctionDraft({
    version: SYSTEM_ANALYSIS_DRAFT_VERSION.V2,
    correctionItems: items,
    ...overrides,
  });
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

  it("prefers v2 correctionItems over legacy v1 arrays when both are present", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(v2Draft([
        correctionItem({ id: "ci-reduce", action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REDUCE, proposedDateKey: undefined, proposedStart: undefined, proposedDurationMinutes: 25 }),
      ], {
        occurrenceAdjustments: [{
          occurrenceId: "occ_focus",
          action: "move",
          proposedDateKey: "2026-05-23",
          proposedStart: "14:00",
          reason: "Legacy fallback.",
        }],
      })),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(review.items).toHaveLength(1);
    expect(review.items[0]).toMatchObject({
      id: "ci-reduce",
      label: "Réduire",
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
      selectable: true,
      repairPreview: {
        type: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
        occurrenceId: "occ_focus",
        durationMinutes: 25,
      },
    });
  });

  it("maps v2 occurrence move to choose_time and exposes priority metadata", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(v2Draft([correctionItem()])),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(review.items[0]).toMatchObject({
      id: "ci-move",
      group: "priority",
      label: "Déplacer",
      description: "Vers 2026-05-22 à 10:30.",
      reason: "Le créneau actuel est fragile.",
      expectedImpact: "Exécution plus stable. · Risque : Risque faible.",
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.VALID,
      selectable: true,
      visibleByDefault: true,
      priorityRank: 1,
      destructive: false,
      supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE,
      targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE,
      action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.MOVE,
      repairPreview: {
        type: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
        occurrenceId: "occ_focus",
        dateKey: "2026-05-22",
        start: "10:30",
      },
    });
  });

  it("keeps v2 add/protect/objective/action/schedule/system items visible but non-selectable", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(v2Draft([
        correctionItem({
          id: "ci-add-action",
          targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.ACTION,
          targetId: "",
          action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.ADD,
          supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.NEEDS_REVIEW,
          title: "Ajouter une action",
          whatChanges: "Ajouter une action plus courte.",
        }),
        correctionItem({
          id: "ci-clarify-objective",
          targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OBJECTIVE,
          targetId: "out_focus",
          action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.CLARIFY,
          supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.NEEDS_REVIEW,
        }),
        correctionItem({
          id: "ci-rebalance",
          targetType: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.SYSTEM,
          targetId: "",
          action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REBALANCE,
          supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.NEEDS_REVIEW,
        }),
      ])),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(review.items.map((item) => item.id)).toEqual(["ci-add-action", "ci-clarify-objective", "ci-rebalance"]);
    expect(review.items.every((item) => item.selectable === false)).toBe(true);
    expect(review.groups.map((group) => group.id)).toEqual(["objectives", "actions", "planning"]);
  });

  it("shows v2 destructive and unsupported items without allowing selection", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(v2Draft([
        correctionItem({
          id: "ci-remove",
          action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REMOVE,
          supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.NEEDS_REVIEW,
          destructive: true,
          confirmationLevel: SYSTEM_ANALYSIS_CONFIRMATION_LEVEL.DESTRUCTIVE,
        }),
        correctionItem({
          id: "ci-unsupported",
          action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.PROTECT,
          supportStatus: SYSTEM_ANALYSIS_SUPPORT_STATUS.UNSUPPORTED,
        }),
      ])),
      state: stateFixture(),
      snapshot: SNAPSHOT,
      selectedIds: ["ci-remove", "ci-unsupported"],
    });

    expect(review.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "ci-remove", group: "unsupported", destructive: true, selectable: false, selected: false }),
      expect.objectContaining({ id: "ci-unsupported", group: "unsupported", status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED, selectable: false }),
    ]));
    expect(review.hasValidSelection).toBe(false);
  });

  it("surfaces v2 correctionItems validation issues inline", () => {
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(v2Draft([
        correctionItem({ targetId: "missing_occ" }),
      ])),
      state: stateFixture(),
      snapshot: SNAPSHOT,
    });

    expect(review.contractIssues.map((issue) => issue.code)).toContain("UNKNOWN_EVIDENCE_OCCURRENCE");
    expect(review.items[0]).toMatchObject({
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.UNSUPPORTED,
      selectable: false,
      repairPreview: null,
    });
    expect(review.items[0].validationIssues.map((issue) => issue.code)).toContain("UNKNOWN_EVIDENCE_OCCURRENCE");
  });

  it("uses v2 item ids for selection, applied state, and confirmation summary", () => {
    const initial = buildSystemAnalysisCorrectionReview({
      result: resultFixture(v2Draft([
        correctionItem({ id: "ci-move" }),
        correctionItem({ id: "ci-reduce", action: SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REDUCE, proposedDateKey: undefined, proposedStart: undefined, proposedDurationMinutes: 30 }),
      ])),
      state: stateFixture(),
      snapshot: SNAPSHOT,
      selectedIds: ["ci-move", "ci-reduce"],
      appliedCorrectionIds: ["ci-reduce"],
    });

    expect(initial.selectedIds).toEqual(["ci-move"]);
    expect(initial.hasValidSelection).toBe(true);
    expect(initial.items.find((item) => item.id === "ci-reduce")).toMatchObject({
      status: SYSTEM_ANALYSIS_CORRECTION_REVIEW_STATUS.APPLIED,
      applied: true,
      selectable: false,
      repairPreview: null,
    });
    expect(initial.confirmationSummary.items).toHaveLength(1);
    expect(initial.confirmationSummary.items[0]).toMatchObject({
      id: "ci-move",
      repairPreview: { type: PLANNING_REPAIR_TYPE.CHOOSE_TIME },
    });
  });

  it("does not return persisted source objects for v2 reviews", () => {
    const state = stateFixture();
    const review = buildSystemAnalysisCorrectionReview({
      result: resultFixture(v2Draft([correctionItem()])),
      state,
      snapshot: SNAPSHOT,
    });
    const serialized = JSON.stringify(review);

    expect(serialized).not.toContain("\"status\":\"planned\"");
    expect(serialized).not.toContain("\"goalId\":\"act_focus\"");
    expect(serialized).not.toContain("\"parentId\":\"out_focus\"");
  });
});
