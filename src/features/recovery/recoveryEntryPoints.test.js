import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPE } from "../notifications/notificationTypes";
import {
  resolveAdjustRecoveryRequest,
  resolveHomePrimaryRecoveryRequest,
  resolveNotificationRecoveryRequest,
  resolvePlanningEntryRecoveryRequest,
} from "./recoveryEntryPoints";
import { RECOVERY_CONTEXT } from "./recoveryTypes";

const DATE_KEY = "2026-05-28";
const NOW = new Date("2026-05-28T12:00:00");

function buildOccurrence(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function buildState(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      {
        id: "outcome_main",
        type: "OUTCOME",
        title: "Système",
        categoryId: "cat_work",
      },
      {
        id: "action_focus",
        type: "PROCESS",
        planType: "ACTION",
        title: "Bloc profond",
        categoryId: "cat_work",
        parentId: "outcome_main",
        outcomeId: "outcome_main",
      },
    ],
    scheduleRules: [
      {
        id: "rule_focus",
        actionId: "action_focus",
        kind: "recurring",
        daysOfWeek: [1, 2, 3, 4, 5],
        timeType: "fixed",
        startTime: "09:00",
        durationMin: 30,
        isActive: true,
      },
    ],
    occurrences: [buildOccurrence()],
    sessionHistory: [],
    ui: { selectedDateKey: DATE_KEY, selectedDate: DATE_KEY },
    ...overrides,
  };
}

function buildDiagnostic(overrides = {}) {
  return {
    summary: {
      activeDateKey: DATE_KEY,
      plannedCount: 1,
      missedCount: 0,
      blockedCount: 0,
      reportedCount: 0,
      postponedCount: 0,
      ...overrides.summary,
    },
    frictionSignals: [],
    systemSignals: [],
    recommendation: { id: "recommend_simplify", actionId: "simplify_day" },
    ...overrides,
  };
}

describe("recovery entry points", () => {
  it("maps Home late, missed, blocked, reported, and postponed primary actions to recovery requests", () => {
    expect(resolveHomePrimaryRecoveryRequest({ status: "late", occurrenceId: "occ-late" })).toMatchObject({
      occurrenceId: "occ-late",
      context: RECOVERY_CONTEXT.LATE,
      source: "home_primary",
    });
    expect(resolveHomePrimaryRecoveryRequest({ status: "missed", occurrenceId: "occ-missed" })?.context).toBe(RECOVERY_CONTEXT.MISSED);
    expect(resolveHomePrimaryRecoveryRequest({ status: "blocked", occurrenceId: "occ-blocked" })?.context).toBe(RECOVERY_CONTEXT.BLOCKED);
    expect(resolveHomePrimaryRecoveryRequest({ status: "reported", occurrenceId: "occ-reported" })?.context).toBe(RECOVERY_CONTEXT.REPORTED);
    expect(resolveHomePrimaryRecoveryRequest({ status: "postponed", occurrenceId: "occ-postponed" })?.context).toBe(RECOVERY_CONTEXT.POSTPONED);
  });

  it("does not turn ready, active, empty, or terminal Home states into recovery", () => {
    ["upcoming", "planned", "ready", "in_progress", "empty", "locked", "done", "skipped", "canceled", "rescheduled"].forEach((status) => {
      expect(resolveHomePrimaryRecoveryRequest({ status, occurrenceId: `occ-${status}` })).toBeNull();
    });
    expect(resolveHomePrimaryRecoveryRequest({ status: "late" })).toBeNull();
  });

  it("maps recovery notification types to concrete recovery requests", () => {
    expect(
      resolveNotificationRecoveryRequest({
        id: "n-1",
        type: NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY,
        targetId: "occ-late",
        targetRoute: "/session/occ-late",
      })
    ).toMatchObject({
      occurrenceId: "occ-late",
      context: RECOVERY_CONTEXT.LATE,
      source: "notification",
      notificationType: NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY,
    });

    expect(
      resolveNotificationRecoveryRequest({
        notificationId: "n-2",
        type: NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY,
        targetRoute: "/session/occ-missed",
      })
    ).toMatchObject({
      occurrenceId: "occ-missed",
      context: RECOVERY_CONTEXT.MISSED,
      notificationId: "n-2",
    });
  });

  it("returns null for non-recovery notifications or missing occurrence targets", () => {
    expect(resolveNotificationRecoveryRequest({ type: NOTIFICATION_TYPE.BLOCK_START_NOW, targetId: "occ-1" })).toBeNull();
    expect(resolveNotificationRecoveryRequest({ type: NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY, targetRoute: "/coach" })).toBeNull();
  });

  it("resolves a concrete late Ajuster occurrence to recovery", () => {
    const state = buildState();
    expect(
      resolveAdjustRecoveryRequest({
        diagnostic: buildDiagnostic(),
        state,
        selectedDateKey: DATE_KEY,
        now: NOW,
      })
    ).toMatchObject({
      occurrenceId: "occ_source",
      context: RECOVERY_CONTEXT.LATE,
      source: "adjust",
      originTab: "adjust",
      successTab: "today",
    });
  });

  it("resolves concrete missed, blocked, and reported Ajuster occurrences", () => {
    expect(
      resolveAdjustRecoveryRequest({
        diagnostic: buildDiagnostic({ summary: { missedCount: 1 } }),
        state: buildState({ occurrences: [buildOccurrence({ status: "missed" })] }),
        selectedDateKey: DATE_KEY,
        now: NOW,
      })?.context
    ).toBe(RECOVERY_CONTEXT.MISSED);

    expect(
      resolveAdjustRecoveryRequest({
        diagnostic: buildDiagnostic({ summary: { blockedCount: 1 } }),
        state: buildState({
          sessionHistory: [
            {
              id: "hist_blocked",
              occurrenceId: "occ_source",
              dateKey: DATE_KEY,
              state: "ended",
              endedReason: "blocked",
              endAt: "2026-05-28T09:30:00.000Z",
            },
          ],
        }),
        selectedDateKey: DATE_KEY,
        now: NOW,
      })?.context
    ).toBe(RECOVERY_CONTEXT.BLOCKED);

    expect(
      resolveAdjustRecoveryRequest({
        diagnostic: buildDiagnostic({ summary: { reportedCount: 1 } }),
        state: buildState({
          sessionHistory: [
            {
              id: "hist_reported",
              occurrenceId: "occ_source",
              dateKey: DATE_KEY,
              state: "ended",
              endedReason: "reported",
              endAt: "2026-05-28T09:30:00.000Z",
            },
          ],
        }),
        selectedDateKey: DATE_KEY,
        now: NOW,
      })?.context
    ).toBe(RECOVERY_CONTEXT.REPORTED);
  });

  it("resolves postponed Ajuster occurrences only when a safe target repair exists", () => {
    const source = buildOccurrence({
      id: "occ_source",
      status: "rescheduled",
      repairV1: { targetOccurrenceId: "occ_target" },
    });
    const target = buildOccurrence({
      id: "occ_target",
      date: DATE_KEY,
      start: "13:00",
      slotKey: "13:00",
      status: "planned",
    });

    expect(
      resolveAdjustRecoveryRequest({
        diagnostic: buildDiagnostic({ summary: { postponedCount: 1 } }),
        state: buildState({ occurrences: [source, target] }),
        selectedDateKey: DATE_KEY,
        now: NOW,
      })
    ).toMatchObject({
      occurrenceId: "occ_source",
      context: RECOVERY_CONTEXT.POSTPONED,
    });

    expect(
      resolveAdjustRecoveryRequest({
        diagnostic: buildDiagnostic({ summary: { postponedCount: 1 } }),
        state: buildState({ occurrences: [buildOccurrence({ status: "rescheduled" })] }),
        selectedDateKey: DATE_KEY,
        now: NOW,
      })
    ).toBeNull();
  });

  it("keeps broad Ajuster recommendations on their existing route", () => {
    expect(
      resolveAdjustRecoveryRequest({
        diagnostic: buildDiagnostic({ summary: { plannedCount: 5, missedCount: 0 } }),
        state: buildState({ occurrences: [] }),
        selectedDateKey: DATE_KEY,
        now: NOW,
      })
    ).toBeNull();

    expect(
      resolveAdjustRecoveryRequest({
        diagnostic: buildDiagnostic({ summary: { missedCount: 2 } }),
        state: buildState({
          occurrences: [
            buildOccurrence({ id: "occ_1", status: "missed" }),
            buildOccurrence({ id: "occ_2", status: "missed" }),
          ],
        }),
        selectedDateKey: DATE_KEY,
        now: NOW,
      })
    ).toBeNull();
  });

  it("resolves Planning problematic entries and ignores nonrecoverable statuses", () => {
    const state = buildState({
      occurrences: [
        buildOccurrence({ id: "occ_missed", status: "missed" }),
        buildOccurrence({ id: "occ_ready", start: "15:00", slotKey: "15:00", status: "planned" }),
        buildOccurrence({ id: "occ_done", status: "done" }),
      ],
    });

    expect(
      resolvePlanningEntryRecoveryRequest({
        entry: {
          id: "occ_missed",
          status: "missed",
          targetOccurrence: state.occurrences[0],
        },
        state,
        selectedDateKey: DATE_KEY,
        now: NOW,
      })
    ).toMatchObject({
      occurrenceId: "occ_missed",
      context: RECOVERY_CONTEXT.MISSED,
      source: "planning",
      originTab: "timeline",
      successTab: "timeline",
    });

    expect(
      resolvePlanningEntryRecoveryRequest({
        entry: {
          id: "occ_late",
          status: "late",
          targetOccurrence: buildOccurrence({ id: "occ_late", start: "09:00", status: "planned" }),
        },
        state: buildState({ occurrences: [buildOccurrence({ id: "occ_late", start: "09:00", status: "planned" })] }),
        selectedDateKey: DATE_KEY,
        now: NOW,
      })?.context
    ).toBe(RECOVERY_CONTEXT.LATE);

    expect(
      resolvePlanningEntryRecoveryRequest({
        entry: {
          id: "occ_ready",
          status: "planned",
          targetOccurrence: state.occurrences[1],
        },
        state,
        selectedDateKey: DATE_KEY,
        now: NOW,
      })
    ).toBeNull();

    for (const status of ["done", "skipped", "canceled"]) {
      expect(
        resolvePlanningEntryRecoveryRequest({
          entry: {
            id: `occ_${status}`,
            status,
            targetOccurrence: buildOccurrence({ id: `occ_${status}`, status }),
          },
          state: buildState({ occurrences: [buildOccurrence({ id: `occ_${status}`, status })] }),
          selectedDateKey: DATE_KEY,
          now: NOW,
        })
      ).toBeNull();
    }
  });
});
