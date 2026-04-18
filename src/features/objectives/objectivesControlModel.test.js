import { describe, expect, it } from "vitest";
import {
  buildObjectivesControlRoom,
  OBJECTIVES_HORIZONS,
  normalizeObjectivesHorizon,
  normalizeObjectivesLens,
} from "./objectivesControlModel";

function buildState() {
  return {
    categories: [
      { id: "cat-1", name: "Sport", color: "#ff7a59" },
      { id: "cat-2", name: "Deep Work", color: "#5b8cff" },
    ],
    goals: [
      { id: "out-1", type: "OUTCOME", categoryId: "cat-1", title: "Cardio solide", progress: 0.68 },
      { id: "out-2", type: "OUTCOME", categoryId: "cat-2", title: "Lancer le projet", progress: 0.18 },
      { id: "act-1", type: "PROCESS", categoryId: "cat-1", parentId: "out-1", title: "Fractionné" },
      { id: "act-2", type: "PROCESS", categoryId: "cat-1", parentId: "out-1", title: "Mobilité" },
      { id: "act-3", type: "PROCESS", categoryId: "cat-2", parentId: "out-2", title: "Bloc rédaction" },
      { id: "act-4", type: "PROCESS", categoryId: "cat-2", title: "Admin dispersé" },
    ],
    occurrences: [
      { id: "occ-1", goalId: "act-1", date: "2026-04-13", status: "done", durationMinutes: 35 },
      { id: "occ-2", goalId: "act-2", date: "2026-04-15", status: "planned", durationMinutes: 20 },
      { id: "occ-3", goalId: "act-3", date: "2026-04-14", status: "planned", durationMinutes: 90 },
      { id: "occ-4", goalId: "act-3", date: "2026-04-16", status: "planned", durationMinutes: 90 },
      { id: "occ-5", goalId: "act-3", date: "2026-04-18", status: "planned", durationMinutes: 90 },
      { id: "occ-6", goalId: "act-4", date: "2026-04-17", status: "planned", durationMinutes: 30 },
    ],
  };
}

describe("objectivesControlModel", () => {
  it("normalizes lenses and horizons with conservative defaults", () => {
    expect(normalizeObjectivesLens("categories")).toBe("categories");
    expect(normalizeObjectivesLens("unknown")).toBe("objectives");
    expect(normalizeObjectivesHorizon("day")).toBe("day");
    expect(normalizeObjectivesHorizon("weird")).toBe("week");
  });

  it("builds weekly focus signals from outcomes, categories, and key actions", () => {
    const model = buildObjectivesControlRoom({
      data: buildState(),
      activeCategoryId: null,
      horizon: OBJECTIVES_HORIZONS.WEEK,
      anchorDateKey: "2026-04-17",
    });

    expect(model.window.fromKey).toBe("2026-04-13");
    expect(model.focusSignals.protect.title).toBe("Cardio solide");
    expect(model.focusSignals.loosen.title).toBe("Deep Work");
    expect(model.focusSignals.reframe.title).toBe("Lancer le projet");
    expect(model.objectiveCards[0]?.status?.label).toBe("À protéger");
    expect(model.keyActionCards.some((entry) => entry.status.key === "orphan")).toBe(true);
  });

  it("filters the control room by category without losing the signal hierarchy", () => {
    const model = buildObjectivesControlRoom({
      data: buildState(),
      activeCategoryId: "cat-1",
      horizon: OBJECTIVES_HORIZONS.WEEK,
      anchorDateKey: "2026-04-17",
    });

    expect(model.objectiveCards).toHaveLength(1);
    expect(model.categoryCards).toHaveLength(1);
    expect(model.keyActionCards.every((entry) => entry.category?.id === "cat-1")).toBe(true);
    expect(model.focusSignals.protect.categoryId).toBe("cat-1");
  });

  it("switches monthly overview cards to synthetic metrics", () => {
    const model = buildObjectivesControlRoom({
      data: buildState(),
      activeCategoryId: null,
      horizon: OBJECTIVES_HORIZONS.MONTH,
      anchorDateKey: "2026-04-17",
    });

    expect(model.overviewCards).toHaveLength(4);
    expect(model.overviewCards[0]?.label).toBe("Objectifs actifs");
    expect(model.totals.windowMinutes).toBeGreaterThan(0);
  });
});
