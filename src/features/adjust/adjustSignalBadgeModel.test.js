import { describe, expect, it } from "vitest";
import {
  SYSTEM_SIGNAL_SEVERITY,
  SYSTEM_SIGNAL_TYPE,
} from "../../logic/systemSignals";
import {
  buildAdjustSignalBadgeModel,
  buildSignalBadgeModelFromSignals,
} from "./adjustSignalBadgeModel";

const ACTIVE_DATE = "2026-05-20";

function baseState(overrides = {}) {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [{ id: "goal_focus", type: "PROCESS", title: "Focus", categoryId: "cat_work", durationMinutes: 45 }],
    occurrences: [],
    ui: { selectedDateKey: ACTIVE_DATE },
    ...overrides,
  };
}

describe("buildAdjustSignalBadgeModel", () => {
  it("returns an attention badge when Ajuster has useful friction", () => {
    const badge = buildAdjustSignalBadgeModel(
      baseState({
        occurrences: [
          { id: "occ_blocked", goalId: "goal_focus", date: ACTIVE_DATE, status: "planned", start: "09:00" },
        ],
        sessionHistory: [
          {
            id: "history_blocked",
            occurrenceId: "occ_blocked",
            dateKey: ACTIVE_DATE,
            state: "ended",
            endedReason: "blocked",
          },
        ],
      })
    );

    expect(badge).toMatchObject({
      severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      tone: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      label: "Signal d’ajustement disponible",
      signalType: SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK,
    });
  });

  it("returns no badge when there is no active attention or critical signal", () => {
    expect(buildAdjustSignalBadgeModel(baseState())).toBeNull();
    expect(buildSignalBadgeModelFromSignals([
      {
        id: "info",
        type: SYSTEM_SIGNAL_TYPE.NEGLECTED_CATEGORY,
        severity: SYSTEM_SIGNAL_SEVERITY.INFO,
      },
    ])).toBeNull();
  });

  it("passes through true critical signals without inventing a number badge", () => {
    const badge = buildSignalBadgeModelFromSignals([
      {
        id: "critical-late",
        type: SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK,
        severity: SYSTEM_SIGNAL_SEVERITY.CRITICAL,
      },
    ]);

    expect(badge).toEqual({
      severity: SYSTEM_SIGNAL_SEVERITY.CRITICAL,
      tone: SYSTEM_SIGNAL_SEVERITY.CRITICAL,
      label: "Signal critique à ajuster",
      signalId: "critical-late",
      signalType: SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK,
    });
  });
});
