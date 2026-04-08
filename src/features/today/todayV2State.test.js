import { describe, expect, it } from "vitest";
import { deriveTodayV2State } from "./todayV2State";

function buildBase(overrides = {}) {
  return {
    selectedDateKey: "2026-04-07",
    localTodayKey: "2026-04-07",
    activeSessionForActiveDate: null,
    heroViewModel: {
      title: "Écrire le plan",
      meta: "C’est le prochain pas utile.",
      recommendedCategoryLabel: "Travail",
      primaryLabel: "Démarrer",
      primaryAction: {
        kind: "start_occurrence",
        occurrence: { id: "occ_1" },
      },
    },
    heroOccurrence: { id: "occ_1", durationMinutes: 25 },
    focusCategory: { id: "cat_work", name: "Travail" },
    localGapSummary: null,
    dailyState: { doneMinutes: 0, remainingMinutes: 50 },
    occurrencesForSelectedDay: [{ id: "occ_1", status: "planned" }],
    nextActions: [
      { id: "alt_1", intent: "start_occurrence", title: "Alternative 1" },
      { id: "alt_2", intent: "open_planning", title: "Alternative 2" },
      { id: "alt_3", intent: "open_objectives", title: "Alternative 3" },
    ],
    ...overrides,
  };
}

describe("deriveTodayV2State", () => {
  it("returns ready with max 2 alternatives when a focus occurrence can start now", () => {
    const result = deriveTodayV2State(buildBase());

    expect(result.state).toBe("ready");
    expect(result.hero.primaryLabel).toBe("Démarrer");
    expect(result.hero.durationLabel).toBe("25 min");
    expect(result.alternatives).toHaveLength(2);
    expect(result.showProgress).toBe(true);
  });

  it("returns clarify when no credible next block is available", () => {
    const result = deriveTodayV2State(
      buildBase({
        heroViewModel: {
          title: "Aucune priorité claire",
          meta: "Il faut clarifier.",
          recommendedCategoryLabel: "Travail",
          primaryLabel: "Créer avec le coach",
          primaryAction: { kind: "open_coach_plan" },
        },
        heroOccurrence: null,
        localGapSummary: { selectionScope: "structure_missing", explanation: "Clarifie la direction de cette catégorie." },
        occurrencesForSelectedDay: [],
        nextActions: [],
      })
    );

    expect(result.state).toBe("clarify");
    expect(result.hero.primaryAction.kind).toBe("open_coach");
    expect(result.hero.secondaryAction.kind).toBe("open_create_habit");
    expect(result.coachPrefill).toMatch(/clarifier/i);
    expect(result.showProgress).toBe(true);
  });

  it("returns overload when the day is overloaded", () => {
    const result = deriveTodayV2State(
      buildBase({
        heroViewModel: {
          title: "Planning chargé",
          meta: "Beaucoup trop de charge.",
          recommendedCategoryLabel: "Travail",
          primaryLabel: "Revoir",
          primaryAction: { kind: "open_pilotage" },
        },
        heroOccurrence: null,
        dailyState: { doneMinutes: 0, remainingMinutes: 180 },
        occurrencesForSelectedDay: Array.from({ length: 5 }, (_, index) => ({ id: `occ_${index}`, status: "planned" })),
        nextActions: [],
      })
    );

    expect(result.state).toBe("overload");
    expect(result.hero.primaryAction.kind).toBe("open_coach");
    expect(result.hero.secondaryAction.kind).toBe("open_planning_for_today");
    expect(result.showProgress).toBe(true);
  });

  it("keeps overload priority ahead of a startable focus block", () => {
    const result = deriveTodayV2State(
      buildBase({
        dailyState: { doneMinutes: 0, remainingMinutes: 180 },
        occurrencesForSelectedDay: Array.from({ length: 5 }, (_, index) => ({
          id: `occ_${index}`,
          status: "planned",
        })),
      })
    );

    expect(result.state).toBe("overload");
    expect(result.hero.primaryLabel).toBe("Alléger ma journée");
  });

  it("returns validated when the day is completed", () => {
    const result = deriveTodayV2State(
      buildBase({
        heroViewModel: {
          title: "Journée finie",
          meta: "Tu as fini.",
          recommendedCategoryLabel: "Travail",
          primaryLabel: "Préparer",
          primaryAction: { kind: "open_pilotage" },
        },
        heroOccurrence: null,
        dailyState: { doneMinutes: 90, remainingMinutes: 0 },
        occurrencesForSelectedDay: [{ id: "occ_done", status: "done" }],
        nextActions: [],
      })
    );

    expect(result.state).toBe("validated");
    expect(result.showProgress).toBe(true);
    expect(result.hero.primaryLabel).toBe("Préparer le prochain pas");
  });

  it("returns legacy_fallback when selected date is not today", () => {
    const result = deriveTodayV2State(
      buildBase({
        selectedDateKey: "2026-04-08",
      })
    );

    expect(result.state).toBe("legacy_fallback");
    expect(result.alternatives).toHaveLength(2);
    expect(result.showProgress).toBe(true);
  });

  it("keeps ready priority for an active session", () => {
    const result = deriveTodayV2State(
      buildBase({
        activeSessionForActiveDate: { id: "sess_1", occurrenceId: "occ_1" },
        dailyState: { doneMinutes: 90, remainingMinutes: 0 },
        occurrencesForSelectedDay: [{ id: "occ_done", status: "done" }],
      })
    );

    expect(result.state).toBe("ready");
    expect(result.hero.primaryLabel).toBe("Reprendre la session");
    expect(result.hero.primaryAction.kind).toBe("resume_session");
    expect(result.showProgress).toBe(true);
  });
});
