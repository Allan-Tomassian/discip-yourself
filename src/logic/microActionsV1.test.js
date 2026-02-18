import { describe, expect, it } from "vitest";
import {
  BASIC_MICRO_REROLL_LIMIT,
  completeMicroAction,
  ensureMicroActionsV1,
  rerollMicroActions,
} from "./microActionsV1";

function buildState() {
  return {
    ui: {
      selectedCategoryByView: {
        home: "cat_business",
      },
      selectedCategoryId: "cat_business",
    },
    categories: [
      { id: "cat_business", name: "Business" },
      { id: "cat_health", name: "Santé" },
    ],
  };
}

describe("microActionsV1", () => {
  it("ensure creates exactly 3 unique items", () => {
    const state = buildState();
    const ensured = ensureMicroActionsV1(state, "2026-02-18", "cat_business", {
      nowIso: "2026-02-18T10:00:00.000Z",
    });

    expect(ensured.items).toHaveLength(3);
    expect(new Set(ensured.items.map((item) => item.id)).size).toBe(3);
    expect(new Set(ensured.items.map((item) => item.templateId)).size).toBe(3);
    expect(ensured.rerollsUsed).toBe(0);
    expect(ensured.rerollCredits).toBe(0);
  });

  it("complete replaces a done item immediately", () => {
    const state = buildState();
    const ensured = ensureMicroActionsV1(state, "2026-02-18", "cat_business", {
      nowIso: "2026-02-18T10:00:00.000Z",
    });
    const seededState = {
      ...state,
      ui: {
        ...state.ui,
        microActionsV1: ensured,
      },
    };

    const before = ensured.items[1];
    const result = completeMicroAction(seededState, 1, {
      dateKey: "2026-02-18",
      categoryId: "cat_business",
      nowIso: "2026-02-18T10:01:00.000Z",
    });

    expect(result.doneItem?.id).toBe(before.id);
    expect(result.doneItem?.status).toBe("done");
    expect(result.microActions.items[1].id).not.toBe(before.id);
    expect(result.microActions.items).toHaveLength(3);
  });

  it("reroll replaces selected indices and increments usage once", () => {
    const state = buildState();
    const ensured = ensureMicroActionsV1(state, "2026-02-18", "cat_business", {
      nowIso: "2026-02-18T10:00:00.000Z",
    });
    const seededState = {
      ...state,
      ui: {
        ...state.ui,
        microActionsV1: ensured,
      },
    };

    const firstIds = ensured.items.map((item) => item.id);
    const result = rerollMicroActions(seededState, [0, 2], {
      dateKey: "2026-02-18",
      categoryId: "cat_business",
      nowIso: "2026-02-18T10:05:00.000Z",
    });
    const nextIds = result.microActions.items.map((item) => item.id);

    expect(result.replacedCount).toBe(2);
    expect(nextIds[0]).not.toBe(firstIds[0]);
    expect(nextIds[1]).toBe(firstIds[1]);
    expect(nextIds[2]).not.toBe(firstIds[2]);
    expect(result.microActions.rerollsUsed).toBe(1);
  });

  it("resets rerollsUsed on date change", () => {
    const state = buildState();
    const dayOne = ensureMicroActionsV1(state, "2026-02-18", "cat_business", {
      nowIso: "2026-02-18T10:00:00.000Z",
    });
    const dayOneUsed = {
      ...dayOne,
      rerollsUsed: BASIC_MICRO_REROLL_LIMIT,
      rerollCredits: 2,
    };
    const nextState = {
      ...state,
      ui: {
        ...state.ui,
        microActionsV1: dayOneUsed,
      },
    };

    const dayTwo = ensureMicroActionsV1(nextState, "2026-02-19", "cat_business", {
      nowIso: "2026-02-19T08:00:00.000Z",
    });

    expect(dayTwo.dateKey).toBe("2026-02-19");
    expect(dayTwo.rerollsUsed).toBe(0);
    expect(dayTwo.rerollCredits).toBe(0);
    expect(dayTwo.items).toHaveLength(3);
  });
});
