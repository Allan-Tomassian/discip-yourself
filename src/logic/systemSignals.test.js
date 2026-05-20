import { describe, expect, it } from "vitest";
import {
  SYSTEM_SIGNAL_ACTION_TYPE,
  SYSTEM_SIGNAL_SEVERITY,
  SYSTEM_SIGNAL_TYPE,
  buildSystemSignals,
  getPrimarySystemSignal,
} from "./systemSignals";

const DATE_KEY = "2026-05-20";

function history(reason, overrides = {}) {
  return {
    id: `history_${reason}`,
    occurrenceId: `occ_${reason}`,
    dateKey: DATE_KEY,
    state: "ended",
    endedReason: reason,
    endAt: `${DATE_KEY}T10:00:00.000Z`,
    ...overrides,
  };
}

describe("buildSystemSignals", () => {
  it("does not invent signals on empty data", () => {
    expect(buildSystemSignals({ dateKey: DATE_KEY })).toEqual([]);
  });

  it("derives blocked and reported signals from session history", () => {
    const signals = buildSystemSignals({
      dateKey: DATE_KEY,
      sessionHistory: [history("blocked"), history("reported")],
    });

    expect(signals.map((signal) => signal.type)).toEqual([
      SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK,
      SYSTEM_SIGNAL_TYPE.REPORTED_BLOCK,
    ]);
    expect(signals[0]).toMatchObject({
      severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      evidence: { source: "sessionHistory", occurrenceId: "occ_blocked" },
      action: { type: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_ADJUST },
    });
    expect(signals[1]).toMatchObject({
      action: { type: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_PLANNING },
    });
  });

  it("derives missed, repeated postpone, overload, and no-next signals from real data", () => {
    const signals = buildSystemSignals({
      dateKey: DATE_KEY,
      occurrences: [
        { id: "occ_missed", date: DATE_KEY, status: "missed" },
        { id: "occ_postponed_1", date: DATE_KEY, status: "rescheduled" },
        { id: "occ_postponed_2", date: DATE_KEY, status: "rescheduled" },
      ],
      adjustDiagnostic: {
        summary: {
          activeDateKey: DATE_KEY,
          plannedCount: 3,
          doneCount: 1,
          remainingCount: 4,
          remainingMinutes: 150,
        },
        nextBlock: null,
      },
    });

    expect(signals.map((signal) => signal.type)).toEqual(
      expect.arrayContaining([
        SYSTEM_SIGNAL_TYPE.MISSED_BLOCK,
        SYSTEM_SIGNAL_TYPE.REPEATED_POSTPONE,
        SYSTEM_SIGNAL_TYPE.OVERLOAD,
        SYSTEM_SIGNAL_TYPE.NO_NEXT_BLOCK,
      ])
    );
  });

  it("dedupes equivalent signal evidence", () => {
    const duplicate = history("blocked", { id: "history_duplicate", occurrenceId: "occ_blocked" });
    const signals = buildSystemSignals({
      dateKey: DATE_KEY,
      sessionHistory: [duplicate, { ...duplicate }],
    });

    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe(SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK);
  });

  it("derives late critical and neglected-category signals from existing surface data", () => {
    const signals = buildSystemSignals({
      dateKey: DATE_KEY,
      todayData: {
        primaryAction: {
          status: "late",
          occurrenceId: "occ_late",
          actionId: "goal_late",
        },
      },
      adjustDiagnostic: {
        summary: { activeDateKey: DATE_KEY },
        nextBlock: { id: "occ_next" },
        categorySignals: [{ id: "cat_health", label: "Santé", expected: 2, done: 0 }],
      },
    });

    expect(signals.map((signal) => signal.type)).toEqual([
      SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK,
      SYSTEM_SIGNAL_TYPE.NEGLECTED_CATEGORY,
    ]);
  });
});

describe("getPrimarySystemSignal", () => {
  it("prioritizes critical and higher-order friction signals", () => {
    const signals = buildSystemSignals({
      dateKey: DATE_KEY,
      sessionHistory: [history("blocked")],
      todayData: {
        primaryAction: { status: "late", occurrenceId: "occ_late" },
      },
    });

    expect(getPrimarySystemSignal(signals)).toMatchObject({
      type: SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK,
      severity: SYSTEM_SIGNAL_SEVERITY.CRITICAL,
    });
  });
});
