import { describe, expect, it } from "vitest";
import { applyRecoveryOption } from "../recovery/recoveryRepairModel";
import { buildRecoveryOptions } from "../recovery/recoverySheetModel";
import { RECOVERY_CONTEXT, RECOVERY_OPTION_TYPE } from "../recovery/recoveryTypes";
import { buildNotificationCandidates } from "./notificationCandidates";
import { NOTIFICATION_TYPE } from "./notificationTypes";

const DATE = "2026-05-22";

function occurrence(overrides = {}) {
  return {
    id: "occ-1",
    date: DATE,
    start: "09:00",
    status: "planned",
    title: "Séance de sport",
    ...overrides,
  };
}

function buildState(overrides = {}) {
  return {
    occurrences: [],
    sessionHistory: [],
    systemSignals: [],
    ...overrides,
  };
}

function recoveryState(overrides = {}) {
  return {
    categories: [{ id: "cat-work", name: "Travail" }],
    goals: [
      {
        id: "outcome-main",
        type: "OUTCOME",
        title: "Système",
        categoryId: "cat-work",
      },
      {
        id: "goal-focus",
        type: "PROCESS",
        planType: "ACTION",
        title: "Deep work",
        categoryId: "cat-work",
        parentId: "outcome-main",
        outcomeId: "outcome-main",
      },
    ],
    scheduleRules: [
      {
        id: "rule-focus",
        actionId: "goal-focus",
        kind: "recurring",
        daysOfWeek: [1, 2, 3, 4, 5],
        timeType: "fixed",
        startTime: "08:30",
        durationMin: 30,
        isActive: true,
      },
    ],
    occurrences: [
      occurrence({
        id: "occ-1",
        goalId: "goal-focus",
        categoryId: "cat-work",
        outcomeId: "outcome-main",
        scheduleRuleId: "rule-focus",
        start: "08:30",
        slotKey: "08:30",
        durationMinutes: 30,
      }),
    ],
    sessionHistory: [],
    systemSignals: [],
    ui: {},
    ...overrides,
  };
}

function optionByType(model, type) {
  return model.options.find((option) => option.type === type) || null;
}

describe("notificationCandidates", () => {
  it("produces a candidate for a block starting soon", () => {
    const candidates = buildNotificationCandidates({
      state: buildState({ occurrences: [occurrence({ start: "09:10" })] }),
      now: new Date(`${DATE}T09:00:00`),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: NOTIFICATION_TYPE.BLOCK_START_SOON,
      title: "Bloc bientôt prêt",
      body: "Séance de sport commence à 09:10.",
      targetRoute: "/session/occ-1",
      cooldownKey: "block_start_soon:occ-1",
    });
  });

  it("produces a candidate for a block starting now", () => {
    const candidates = buildNotificationCandidates({
      state: buildState({ occurrences: [occurrence({ start: "09:00" })] }),
      now: new Date(`${DATE}T09:00:00`),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: NOTIFICATION_TYPE.BLOCK_START_NOW,
      title: "C’est le moment",
      body: "Démarre Séance de sport ou ajuste le bloc.",
    });
  });

  it("produces a recovery candidate for an overdue block", () => {
    const candidates = buildNotificationCandidates({
      state: buildState({
        occurrences: [occurrence({ start: "08:30" })],
        systemSignals: [{ id: "late-1", type: "late_critical_block", occurrenceIds: ["occ-1"] }],
      }),
      now: new Date(`${DATE}T09:00:00`),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY,
      title: "Bloc à récupérer",
      body: "Repars avec une version plus simple.",
      sourceSignalIds: ["late-1"],
    });
  });

  it("produces a candidate for an empty day with availability", () => {
    const candidates = buildNotificationCandidates({
      state: buildState({
        systemSignals: [{ id: "no-next-1", type: "no_next_block" }],
      }),
      now: new Date(`${DATE}T09:00:00`),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY,
      title: "Construis ton prochain bloc",
      body: "Ta journée a un espace libre.",
      targetRoute: "/coach",
      targetId: DATE,
      sourceSignalIds: ["no-next-1"],
    });
  });

  it("produces a recovery candidate for a missed block", () => {
    const candidates = buildNotificationCandidates({
      state: buildState({
        occurrences: [occurrence({ status: "missed" })],
        systemSignals: [{ id: "missed-1", type: "missed_block", occurrenceIds: ["occ-1"] }],
      }),
      now: new Date(`${DATE}T12:00:00`),
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY,
      title: "Bloc manqué",
      sourceSignalIds: ["missed-1"],
    });
  });

  it("does not produce block candidates for done, skipped, or canceled occurrences", () => {
    const candidates = buildNotificationCandidates({
      state: buildState({
        occurrences: [
          occurrence({ id: "done", status: "done" }),
          occurrence({ id: "skipped", status: "skipped" }),
          occurrence({ id: "canceled", status: "canceled" }),
        ],
      }),
      now: new Date(`${DATE}T09:00:00`),
    });

    expect(candidates).toEqual([]);
  });

  it("does not produce a reminder for the currently active occurrence", () => {
    const candidates = buildNotificationCandidates({
      state: buildState({
        occurrences: [occurrence({ start: "09:00" })],
        activeSession: { occurrenceId: "occ-1", runtimePhase: "in_progress" },
      }),
      now: new Date(`${DATE}T09:00:00`),
    });

    expect(candidates).toEqual([]);
  });

  it("does not immediately re-create an overdue recovery candidate for a repaired source occurrence", () => {
    const state = recoveryState();
    const before = buildNotificationCandidates({
      state,
      now: new Date(`${DATE}T09:00:00`),
    });
    const model = buildRecoveryOptions({
      state,
      occurrenceId: "occ-1",
      context: RECOVERY_CONTEXT.LATE,
      selectedDateKey: DATE,
      now: new Date(`${DATE}T09:00:00`),
    });
    const result = applyRecoveryOption({
      state,
      occurrenceId: "occ-1",
      option: optionByType(model, RECOVERY_OPTION_TYPE.REDUCE_DURATION),
      now: new Date(`${DATE}T09:00:00`),
    });
    const after = buildNotificationCandidates({
      state: result.nextState,
      now: new Date(`${DATE}T09:00:00`),
    });

    expect(before.map((candidate) => candidate.type)).toContain(NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY);
    expect(result.ok).toBe(true);
    expect(after).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY,
          targetId: "occ-1",
        }),
      ]),
    );
  });

  it("does not immediately re-create a missed recovery candidate for a repaired source occurrence", () => {
    const state = recoveryState({
      occurrences: [
        occurrence({
          id: "occ-1",
          goalId: "goal-focus",
          categoryId: "cat-work",
          outcomeId: "outcome-main",
          scheduleRuleId: "rule-focus",
          start: "08:30",
          slotKey: "08:30",
          durationMinutes: 30,
          status: "missed",
        }),
      ],
    });
    const before = buildNotificationCandidates({
      state,
      now: new Date(`${DATE}T12:00:00`),
    });
    const model = buildRecoveryOptions({
      state,
      occurrenceId: "occ-1",
      context: RECOVERY_CONTEXT.MISSED,
      selectedDateKey: DATE,
      now: new Date(`${DATE}T12:00:00`),
    });
    const result = applyRecoveryOption({
      state,
      occurrenceId: "occ-1",
      option: optionByType(model, RECOVERY_OPTION_TYPE.MOVE_TOMORROW),
      now: new Date(`${DATE}T12:00:00`),
    });
    const after = buildNotificationCandidates({
      state: result.nextState,
      now: new Date(`${DATE}T12:00:00`),
    });

    expect(before.map((candidate) => candidate.type)).toContain(NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY);
    expect(result.ok).toBe(true);
    expect(after).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY,
          targetId: "occ-1",
        }),
      ]),
    );
  });
});
