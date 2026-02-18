import { describe, expect, it } from "vitest";
import {
  computeDisciplineRate,
  computeExpectedDoneMissed,
  computeMicroActionContribution,
  computeWindowStats,
} from "./progressionModel";

describe("progressionModel", () => {
  it("computeExpectedDoneMissed excludes canceled and skipped from expected", () => {
    const stats = computeExpectedDoneMissed([
      { id: "o1", status: "planned" },
      { id: "o2", status: "done" },
      { id: "o3", status: "missed" },
      { id: "o4", status: "canceled" },
      { id: "o5", status: "skipped" },
      { id: "o6", status: "rescheduled" },
    ]);

    expect(stats.expected).toBe(4);
    expect(stats.done).toBe(1);
    expect(stats.missed).toBe(1);
    expect(stats.canceled).toBe(2);
  });

  it("computeDisciplineRate returns done/expected and 0 when expected is 0", () => {
    expect(computeDisciplineRate({ done: 3, expected: 4 })).toBe(0.75);
    expect(computeDisciplineRate({ done: 5, expected: 0 })).toBe(0);
  });

  it("applies micro-actions weighted contribution (0.25): 4 done => +1 weighted done", () => {
    const state = {
      microChecks: {
        "2026-02-10": { m1: true, m2: true },
        "2026-02-11": { m3: true, m4: true },
      },
    };

    const micro = computeMicroActionContribution(state, "2026-02-10", "2026-02-11");
    expect(micro.rawDone).toBe(4);
    expect(micro.done).toBe(1);
    expect(micro.expected).toBe(1);

    const withWindow = computeWindowStats(
      {
        ...state,
        occurrences: [{ id: "o1", date: "2026-02-10", goalId: "g1", status: "planned" }],
      },
      "2026-02-10",
      "2026-02-11"
    );

    expect(withWindow.occurrences.expected).toBe(1);
    expect(withWindow.discipline.expected).toBe(2);
    expect(withWindow.discipline.done).toBe(1);
    expect(withWindow.discipline.rate).toBe(0.5);
  });
});
