import { describe, expect, it } from "vitest";
import {
  MANUAL_AI_STORAGE_SCOPE,
  buildPlanningManualAiContextKey,
  buildPilotageManualAiContextKey,
  buildTodayManualAiContextKey,
  createPersistedChatAnalysisEntry,
  createPersistedNowAnalysisEntry,
  ensureManualAiAnalysisState,
  getManualAiAnalysisEntry,
  removeManualAiAnalysisEntry,
  upsertManualAiAnalysisEntry,
} from "./manualAiAnalysis";

describe("manualAiAnalysis store", () => {
  it("builds stable context keys per surface", () => {
    expect(
      buildTodayManualAiContextKey({
        userId: "user-1",
        dateKey: "2026-03-25",
        activeCategoryId: "cat-1",
      })
    ).toBe("today:user-1:2026-03-25:cat-1");

    expect(
      buildPlanningManualAiContextKey({
        userId: "user-1",
        planningView: "week",
        selectedDateKey: "2026-03-26",
        activeCategoryId: null,
      })
    ).toBe("planning:week:user-1:2026-03-23:all");

    expect(
      buildPilotageManualAiContextKey({
        userId: "user-1",
        fromKey: "2026-03-19",
        toKey: "2026-03-25",
        activeCategoryId: "cat-1",
      })
    ).toBe("pilotage:user-1:7d:2026-03-19:2026-03-25:cat-1");
  });

  it("stores and removes persisted analysis entries by context key", () => {
    const entry = createPersistedNowAnalysisEntry({
      contextKey: "today:user-1:2026-03-25:cat-1",
      storageScope: MANUAL_AI_STORAGE_SCOPE.CLOUD,
      coach: {
        kind: "now",
        decisionSource: "ai",
        interventionType: "today_recommendation",
        headline: "Budget",
        reason: "C'est le meilleur levier du moment.",
        primaryAction: {
          label: "Démarrer",
          intent: "start_occurrence",
          categoryId: "cat-1",
          actionId: "goal-1",
          occurrenceId: "occ-1",
          dateKey: "2026-03-25",
        },
        secondaryAction: null,
        suggestedDurationMin: 20,
        meta: {
          requestId: "req-1",
          selectedDateKey: "2026-03-25",
          activeCategoryId: "cat-1",
          fallbackReason: "none",
        },
      },
    });

    const state = upsertManualAiAnalysisEntry(null, entry);
    expect(getManualAiAnalysisEntry(state, entry.contextKey)).toMatchObject({
      headline: "Budget",
      storageScope: "cloud",
    });

    const next = removeManualAiAnalysisEntry(state, entry.contextKey);
    expect(getManualAiAnalysisEntry(next, entry.contextKey)).toBeNull();
  });

  it("persists chat summaries without draftChanges", () => {
    const entry = createPersistedChatAnalysisEntry({
      contextKey: "planning:day:user-1:2026-03-25:cat-1",
      surface: "planning",
      storageScope: MANUAL_AI_STORAGE_SCOPE.LOCAL_FALLBACK,
      reply: {
        kind: "chat",
        decisionSource: "ai",
        headline: "Charge trop dense",
        reason: "Le jour est trop fragmenté.",
        primaryAction: {
          label: "Déplacer un bloc",
          intent: "open_pilotage",
          categoryId: "cat-1",
          actionId: null,
          occurrenceId: null,
          dateKey: "2026-03-25",
        },
        secondaryAction: null,
        suggestedDurationMin: 15,
        draftChanges: [{ type: "create_action" }],
        meta: {
          requestId: "req-2",
          selectedDateKey: "2026-03-25",
          activeCategoryId: "cat-1",
          fallbackReason: "none",
        },
      },
    });

    expect(entry).toMatchObject({
      surface: "planning",
      headline: "Charge trop dense",
      storageScope: "local_fallback",
    });
    expect(ensureManualAiAnalysisState({ entriesByContextKey: { [entry.contextKey]: entry } }).entriesByContextKey[entry.contextKey]).toBeTruthy();
  });
});
