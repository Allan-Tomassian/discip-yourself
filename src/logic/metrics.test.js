import { describe, it, expect } from "vitest";
import { computeDailyStats, computeStats, getWindowBounds, selectOccurrencesInRange } from "./metrics";

function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("metrics", () => {
  it("computes expected/done/missed/canceled on mixed statuses", () => {
    const occurrences = [
      { id: "p", date: "2026-02-01", goalId: "g1", status: "planned" },
      { id: "d", date: "2026-02-01", goalId: "g1", status: "done", pointsAwarded: 10 },
      { id: "m", date: "2026-02-01", goalId: "g2", status: "missed" },
      { id: "c", date: "2026-02-01", goalId: "g2", status: "canceled" },
      { id: "s", date: "2026-02-01", goalId: "g3", status: "skipped" },
      { id: "r", date: "2026-02-01", goalId: "g3", status: "rescheduled" },
    ];

    const stats = computeStats(occurrences);
    expect(stats.expected).toBe(6);
    expect(stats.done).toBe(1);
    expect(stats.missed).toBe(1);
    expect(stats.canceled).toBe(2);
    expect(stats.planned).toBe(1);
    expect(stats.netScore).toBe(10);
  });

  it("returns completionRate=0 when expected=0", () => {
    const stats = computeStats([]);
    expect(stats.expected).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  it("filters by goalIds", () => {
    const state = {
      occurrences: [
        { id: "o1", date: "2026-02-01", goalId: "g1", status: "done" },
        { id: "o2", date: "2026-02-01", goalId: "g2", status: "planned" },
      ],
    };
    const list = selectOccurrencesInRange(state, "2026-02-01", "2026-02-01", {
      goalIds: ["g1"],
    });
    const stats = computeStats(list);
    expect(stats.expected).toBe(1);
    expect(stats.done).toBe(1);
  });

  it("filters by categoryId via goals mapping", () => {
    const state = {
      goals: [
        { id: "g1", categoryId: "c1" },
        { id: "g2", categoryId: "c2" },
      ],
      occurrences: [
        { id: "o1", date: "2026-02-01", goalId: "g1", status: "done" },
        { id: "o2", date: "2026-02-01", goalId: "g2", status: "planned" },
      ],
    };
    const list = selectOccurrencesInRange(state, "2026-02-01", "2026-02-01", {
      categoryId: "c1",
    });
    const stats = computeStats(list);
    expect(stats.expected).toBe(1);
    expect(stats.done).toBe(1);
  });

  it("builds inclusive bounds for today/7d/14d/90d", () => {
    const now = new Date(2026, 1, 2, 12, 0, 0);
    const today = toKey(now);

    const todayBounds = getWindowBounds("today", now);
    expect(todayBounds.fromKey).toBe(today);
    expect(todayBounds.toKey).toBe(today);

    const seven = new Date(now);
    seven.setDate(seven.getDate() - 6);
    const sevenBounds = getWindowBounds("7d", now);
    expect(sevenBounds.fromKey).toBe(toKey(seven));
    expect(sevenBounds.toKey).toBe(today);

    const fourteen = new Date(now);
    fourteen.setDate(fourteen.getDate() - 13);
    const fourteenBounds = getWindowBounds("14d", now);
    expect(fourteenBounds.fromKey).toBe(toKey(fourteen));
    expect(fourteenBounds.toKey).toBe(today);

    const ninety = new Date(now);
    ninety.setDate(ninety.getDate() - 89);
    const ninetyBounds = getWindowBounds("90d", now);
    expect(ninetyBounds.fromKey).toBe(toKey(ninety));
    expect(ninetyBounds.toKey).toBe(today);
  });

  it("computeDailyStats includes both ends of the window", () => {
    const state = {
      occurrences: [
        { id: "o1", date: "2026-02-01", goalId: "g1", status: "done" },
        { id: "o2", date: "2026-02-02", goalId: "g1", status: "planned" },
      ],
    };
    const daily = computeDailyStats(state, "2026-02-01", "2026-02-02");
    expect(daily.byDate.get("2026-02-01")?.expected).toBe(1);
    expect(daily.byDate.get("2026-02-02")?.expected).toBe(1);
  });

  it("computeDailyStats is idempotent and does not mutate input", () => {
    const state = {
      goals: [{ id: "g1", categoryId: "c1" }],
      occurrences: [
        { id: "o1", date: "2026-02-01", goalId: "g1", status: "done" },
        { id: "o2", date: "2026-02-02", goalId: "g1", status: "planned" },
      ],
    };
    const snapshot = JSON.stringify(state);
    const first = computeDailyStats(state, "2026-02-01", "2026-02-02");
    const second = computeDailyStats(state, "2026-02-01", "2026-02-02");
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(first.totals).toEqual(second.totals);
  });
});
