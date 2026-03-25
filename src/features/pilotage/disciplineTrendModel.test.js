import { describe, expect, it } from "vitest";
import { buildPilotageDisciplineTrend } from "./disciplineTrendModel";

function createOccurrence({ id, goalId, date, status }) {
  return {
    id,
    goalId,
    date,
    status,
    durationMinutes: 20,
  };
}

describe("buildPilotageDisciplineTrend", () => {
  it("marks days with no expected action as neutral instead of zero", () => {
    const state = {
      categories: [{ id: "cat-1", name: "Santé" }],
      goals: [{ id: "goal-1", categoryId: "cat-1", title: "Marcher", type: "PROCESS", planType: "ACTION" }],
      occurrences: [
        createOccurrence({ id: "occ-1", goalId: "goal-1", date: "2026-03-23", status: "done" }),
      ],
    };

    const result = buildPilotageDisciplineTrend(state, {
      categoryId: "cat-1",
      windowDays: 7,
      now: new Date("2026-03-25T12:00:00"),
    });

    expect(result.series).toHaveLength(7);
    expect(result.series.find((entry) => entry.dateKey === "2026-03-23")).toMatchObject({
      score: 100,
      isNeutral: false,
    });
    expect(result.series.find((entry) => entry.dateKey === "2026-03-24")).toMatchObject({
      score: null,
      isNeutral: true,
    });
  });

  it("detects an improving trend from scored days only", () => {
    const state = {
      categories: [{ id: "cat-1", name: "Travail" }],
      goals: [{ id: "goal-1", categoryId: "cat-1", title: "Prospection", type: "PROCESS", planType: "ACTION" }],
      occurrences: [
        createOccurrence({ id: "occ-1", goalId: "goal-1", date: "2026-03-20", status: "missed" }),
        createOccurrence({ id: "occ-2", goalId: "goal-1", date: "2026-03-21", status: "done" }),
        createOccurrence({ id: "occ-3", goalId: "goal-1", date: "2026-03-22", status: "missed" }),
        createOccurrence({ id: "occ-4", goalId: "goal-1", date: "2026-03-23", status: "done" }),
        createOccurrence({ id: "occ-5", goalId: "goal-1", date: "2026-03-24", status: "done" }),
        createOccurrence({ id: "occ-6", goalId: "goal-1", date: "2026-03-25", status: "done" }),
      ],
    };

    const result = buildPilotageDisciplineTrend(state, {
      categoryId: "cat-1",
      windowDays: 7,
      now: new Date("2026-03-25T12:00:00"),
    });

    expect(result.summary.scoredDays).toBe(6);
    expect(result.summary.currentScore).toBe(100);
    expect(result.summary.trendLabel).toBe("hausse");
    expect(result.summary.delta).toBeGreaterThanOrEqual(8);
  });

  it("flags irregularity when swings stay large without directional delta", () => {
    const state = {
      categories: [{ id: "cat-1", name: "Finance" }],
      goals: [{ id: "goal-1", categoryId: "cat-1", title: "Suivi budget", type: "PROCESS", planType: "ACTION" }],
      occurrences: [
        createOccurrence({ id: "occ-1", goalId: "goal-1", date: "2026-03-20", status: "done" }),
        createOccurrence({ id: "occ-2", goalId: "goal-1", date: "2026-03-21", status: "done" }),
        createOccurrence({ id: "occ-3", goalId: "goal-1", date: "2026-03-21", status: "missed" }),
        createOccurrence({ id: "occ-4", goalId: "goal-1", date: "2026-03-22", status: "missed" }),
        createOccurrence({ id: "occ-5", goalId: "goal-1", date: "2026-03-23", status: "missed" }),
        createOccurrence({ id: "occ-6", goalId: "goal-1", date: "2026-03-24", status: "done" }),
        createOccurrence({ id: "occ-7", goalId: "goal-1", date: "2026-03-24", status: "missed" }),
        createOccurrence({ id: "occ-8", goalId: "goal-1", date: "2026-03-25", status: "done" }),
      ],
    };

    const result = buildPilotageDisciplineTrend(state, {
      categoryId: "cat-1",
      windowDays: 7,
      now: new Date("2026-03-25T12:00:00"),
    });

    expect(result.summary.trendLabel).toBe("irrégularité");
    expect(result.summary.delta).toBe(0);
  });
});
