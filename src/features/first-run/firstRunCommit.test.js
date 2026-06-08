import { describe, expect, it } from "vitest";
import { initialData, normalizeCategory } from "../../logic/state";
import { assertNoSystemInvariantErrors } from "../../logic/systemInvariants";
import { addDaysLocal, parseTimeToMinutes } from "../../utils/datetime";
import { buildTodayData } from "../today/todayDataAdapter";
import {
  buildDeterministicRecommendedGeneratedPlans,
  buildLocalStubGeneratedPlans,
  getNextFirstRunStatus,
  normalizeFirstRunV1,
} from "./firstRunModel";
import { applyFirstRunCommitDraft } from "./firstRunCommit";

const NOW = new Date(2026, 3, 29, 10, 0, 0, 0);
const TODAY = "2026-04-29";

function baseState(overrides = {}) {
  return {
    ...initialData(),
    categories: [],
    goals: [],
    occurrences: [],
    scheduleRules: [],
    profile: { ...initialData().profile },
    ...overrides,
    ui: {
      ...initialData().ui,
      ...(overrides.ui || {}),
    },
  };
}

function firstRun(overrides = {}) {
  return normalizeFirstRunV1({
    status: "commit",
    inputHash: "hash-first-run",
    selectedPlanId: "tenable",
    draftAnswers: {
      whyText: "Reprendre le contrôle de mes semaines",
      primaryGoal: "Relancer le projet",
      currentCapacity: "stable",
      priorityCategoryIds: ["business"],
      preferredWindows: [{ id: "p1", daysOfWeek: [3], startTime: "08:00", endTime: "10:00", label: "Matin" }],
      unavailableWindows: [{ id: "u1", daysOfWeek: [1], startTime: "09:00", endTime: "18:00", label: "Travail" }],
    },
    ...overrides,
  });
}

function plan(overrides = {}) {
  return {
    id: "tenable",
    variant: "tenable",
    title: "Plan tenable",
    summary: "Plan de départ",
    commitDraft: {
      version: 1,
      categories: [{ id: "cat_business", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 }],
      goals: [{ id: "goal_project", categoryId: "cat_business", title: "Relancer le projet", type: "OUTCOME", order: 0 }],
      actions: [
        {
          id: "action_deep",
          categoryId: "cat_business",
          parentGoalId: "goal_project",
          title: "Bloc profond",
          type: "PROCESS",
          repeat: "daily",
          daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
          timeMode: "FIXED",
          startTime: "08:00",
          timeSlots: ["08:00"],
          durationMinutes: 25,
          sessionMinutes: 25,
        },
      ],
      occurrences: [
        { id: "occ_today", actionId: "action_deep", date: TODAY, start: "08:00", durationMinutes: 25, status: "planned" },
      ],
    },
    ...overrides,
  };
}

function apply(state = baseState(), fr = firstRun(), selectedPlan = plan()) {
  return applyFirstRunCommitDraft({
    state: {
      ...state,
      ui: {
        ...(state.ui || {}),
        firstRunV1: fr,
      },
    },
    firstRun: fr,
    selectedPlan,
    now: NOW,
  });
}

function occurrencesForAction(state, actionId) {
  return (state.occurrences || []).filter((occ) => occ.goalId === actionId);
}

function todayModelFor(state, now = NOW) {
  return buildTodayData({
    data: state,
    selectedDateKey: TODAY,
    now,
  });
}

describe("applyFirstRunCommitDraft", () => {
  it("creates categories, goals, actions, occurrences, and context", () => {
    const result = apply();

    expect(result.ok).toBe(true);
    expect(result.commitV1.status).toBe("applied");
    expect(result.createdCategoryIds).toHaveLength(1);
    expect(result.createdGoalIds).toHaveLength(1);
    expect(result.createdActionIds).toHaveLength(1);
    expect(result.createdOccurrenceIds.length).toBeGreaterThanOrEqual(7);
    expect(result.nextState.categories[0]).toMatchObject({ name: "Business", source: "first_run" });
    expect(result.nextState.goals.some((goal) => goal.type === "OUTCOME" && goal.title === "Relancer le projet")).toBe(true);
    expect(result.nextState.goals.some((goal) => goal.type === "PROCESS" && goal.title === "Bloc profond")).toBe(true);
    expect(result.nextState.profile.whyText).toBe("Reprendre le contrôle de mes semaines");
    expect(result.nextState.user_ai_profile.goals).toContain("business");
    expect(result.nextState.category_profiles_v1.byCategoryId[result.nextState.categories[0].id].mainGoal).toBe("Relancer le projet");
    expect(() => assertNoSystemInvariantErrors(result.nextState, { activationDateKey: TODAY })).not.toThrow();
  });

  it("creates at least one Today occurrence and seven days of planning occurrences", () => {
    const result = apply();
    const actionId = result.createdActionIds[0];
    const actionOccurrences = occurrencesForAction(result.nextState, actionId);
    const todayOccurrence = actionOccurrences.find((occ) => occ.date === TODAY);
    const dates = new Set(actionOccurrences.map((occ) => occ.date));

    expect(todayOccurrence).toBeTruthy();
    expect(todayOccurrence.status).toBe("planned");
    expect(dates.has(addDaysLocal(TODAY, 6))).toBe(true);
    expect(dates.size).toBeGreaterThanOrEqual(7);
  });

  it("moves a first-run block whose preferred time has passed to a safe future slot today", () => {
    const result = apply();
    const actionId = result.createdActionIds[0];
    const todayOccurrence = occurrencesForAction(result.nextState, actionId).find((occ) => occ.date === TODAY);
    const startMinutes = parseTimeToMinutes(todayOccurrence?.start);

    expect(todayOccurrence).toBeTruthy();
    expect(startMinutes).toBeGreaterThanOrEqual(10 * 60 + 15);
    expect(todayOccurrence.noTime).toBe(false);
    expect(todayOccurrence.startAt).toBe(`${TODAY}T${todayOccurrence.start}`);

    const today = todayModelFor(result.nextState);
    expect(today.primaryAction.status).not.toBe("late");
    expect(today.primaryAction.primaryLabel).toBe("Démarrer");
  });

  it("turns a no-window local fallback occurrence into a concrete launchable slot", () => {
    const draftAnswers = {
      ...firstRun().draftAnswers,
      preferredWindows: [],
      unavailableWindows: [],
    };
    const generatedPlans = buildLocalStubGeneratedPlans(draftAnswers, NOW);
    const fallbackPlan = generatedPlans.plans[0];
    const fr = firstRun({
      generatedPlans,
      selectedPlanId: fallbackPlan.id,
      inputHash: "fallback-no-window-hash",
      draftAnswers,
    });
    const result = apply(baseState(), fr, fallbackPlan);
    const actionId = result.createdActionIds[0];
    const todayOccurrence = occurrencesForAction(result.nextState, actionId).find((occ) => occ.date === TODAY);

    expect(todayOccurrence).toBeTruthy();
    expect(todayOccurrence.start).toBe("10:15");
    expect(todayOccurrence.noTime).toBe(false);
    expect(todayOccurrence.timeType).toBe("fixed");

    const today = todayModelFor(result.nextState);
    expect(today.primaryAction.status).not.toBe("late");
    expect(today.primaryAction.primaryLabel).toBe("Démarrer");
  });

  it("moves the first block to the next realistic day when no safe slot remains today", () => {
    const lateNow = new Date(2026, 3, 29, 23, 30, 0, 0);
    const latePlan = plan({
      commitDraft: {
        ...plan().commitDraft,
        actions: [
          {
            ...plan().commitDraft.actions[0],
            startTime: "23:00",
            timeSlots: ["23:00"],
            durationMinutes: 60,
            sessionMinutes: 60,
          },
        ],
        occurrences: [
          { id: "occ_today_late", actionId: "action_deep", date: TODAY, start: "23:00", durationMinutes: 60, status: "planned" },
        ],
      },
    });
    const result = applyFirstRunCommitDraft({
      state: {
        ...baseState(),
        ui: {
          ...baseState().ui,
          firstRunV1: firstRun(),
        },
      },
      firstRun: firstRun(),
      selectedPlan: latePlan,
      now: lateNow,
    });
    const actionId = result.createdActionIds[0];
    const movedOccurrence = occurrencesForAction(result.nextState, actionId).find(
      (occ) => occ.date === addDaysLocal(TODAY, 1) && occ.start === "09:00"
    );

    expect(movedOccurrence).toMatchObject({
      date: addDaysLocal(TODAY, 1),
      start: "09:00",
      noTime: false,
      timeType: "fixed",
    });
  });

  it("avoids declared unavailable windows when making the first block safe", () => {
    const eveningNow = new Date(2026, 3, 29, 17, 50, 0, 0);
    const draftAnswers = {
      ...firstRun().draftAnswers,
      preferredWindows: [],
      unavailableWindows: [{ id: "u-evening", daysOfWeek: [3], startTime: "18:00", endTime: "20:00", label: "Occupé" }],
    };
    const eveningPlan = plan({
      commitDraft: {
        ...plan().commitDraft,
        actions: [
          {
            ...plan().commitDraft.actions[0],
            startTime: "17:00",
            timeSlots: ["17:00"],
          },
        ],
        occurrences: [
          { id: "occ_today_evening", actionId: "action_deep", date: TODAY, start: "17:00", durationMinutes: 25, status: "planned" },
        ],
      },
    });
    const result = applyFirstRunCommitDraft({
      state: {
        ...baseState(),
        ui: {
          ...baseState().ui,
          firstRunV1: firstRun({ draftAnswers }),
        },
      },
      firstRun: firstRun({ draftAnswers }),
      selectedPlan: eveningPlan,
      now: eveningNow,
    });
    const actionId = result.createdActionIds[0];
    const todayOccurrence = occurrencesForAction(result.nextState, actionId).find((occ) => occ.date === TODAY);

    expect(todayOccurrence).toMatchObject({
      start: "20:00",
      noTime: false,
      timeType: "fixed",
    });
  });

  it("keeps deterministic review preview and committed first occurrence on the same safe block", () => {
    const draftAnswers = {
      whyText: "Je veux publier mon app sans perdre mon énergie.",
      primaryGoal: "Lancer mon application",
      currentCapacity: "stable",
      priorityCategoryIds: ["health", "business"],
      preferredWindows: [{ id: "p1", daysOfWeek: [3], startTime: "08:00", endTime: "10:00", label: "Matin" }],
      unavailableWindows: [],
      referenceDateKey: TODAY,
    };
    const generatedPlans = buildDeterministicRecommendedGeneratedPlans(draftAnswers, {
      inputHash: "preview-commit-safe",
      now: NOW,
    });
    const recommendedPlan = generatedPlans.plans[0];
    const firstPreview = recommendedPlan.todayPreview[0];
    const previewStart = firstPreview.slotLabel.split(" ")[0];
    const fr = firstRun({
      generatedPlans,
      selectedPlanId: "recommended",
      inputHash: "preview-commit-safe",
      draftAnswers,
    });
    const result = apply(baseState(), fr, recommendedPlan);
    const committedAction = result.nextState.goals.find((goal) => goal.type === "PROCESS" && goal.title === firstPreview.title);
    const committedOccurrence = occurrencesForAction(result.nextState, committedAction?.id).find((occ) => occ.date === TODAY);

    expect(firstPreview.title).toMatch(/Lancer mon application/);
    expect(previewStart).toBe("10:15");
    expect(committedAction).toBeTruthy();
    expect(committedOccurrence).toMatchObject({
      date: TODAY,
      start: previewStart,
      noTime: false,
      timeType: "fixed",
    });

    const today = todayModelFor(result.nextState);
    expect(today.primaryAction.status).not.toBe("late");
    expect(today.primaryAction.occurrenceId).toBe(committedOccurrence.id);
  });

  it("is idempotent and does not duplicate entities on repeated commit", () => {
    const first = apply();
    const secondFirstRun = normalizeFirstRunV1({
      ...firstRun(),
      commitV1: first.commitV1,
    });
    const second = apply(first.nextState, secondFirstRun, plan());

    expect(second.ok).toBe(true);
    expect(second.nextState.categories).toHaveLength(first.nextState.categories.length);
    expect(second.nextState.goals).toHaveLength(first.nextState.goals.length);
    expect(second.nextState.occurrences).toHaveLength(first.nextState.occurrences.length);
    expect(second.commitV1.createdActionIds).toEqual(first.commitV1.createdActionIds);
  });

  it("repairs a partial commit by recreating missing action and occurrences", () => {
    const first = apply();
    const actionId = first.createdActionIds[0];
    const damagedState = {
      ...first.nextState,
      goals: first.nextState.goals.filter((goal) => goal.id !== actionId),
      occurrences: first.nextState.occurrences.filter((occ) => occ.goalId !== actionId),
    };
    const repaired = apply(damagedState, normalizeFirstRunV1({ ...firstRun(), commitV1: first.commitV1 }), plan());

    expect(repaired.ok).toBe(true);
    expect(repaired.nextState.goals.some((goal) => goal.id === actionId)).toBe(true);
    expect(occurrencesForAction(repaired.nextState, actionId).length).toBeGreaterThanOrEqual(7);
  });

  it("reuses an existing same-name category instead of duplicating it", () => {
    const existingCategory = normalizeCategory({ id: "cat_existing_business", name: "Business" }, 0);
    const result = apply(baseState({ categories: [existingCategory] }));

    expect(result.createdCategoryIds).toEqual([]);
    expect(result.reusedCategoryIds).toEqual(["cat_existing_business"]);
    expect(result.nextState.categories).toHaveLength(1);
    expect(result.nextState.goals.every((goal) => goal.categoryId === "cat_existing_business")).toBe(true);
  });

  it("preserves existing user data and does not overwrite profile whyText", () => {
    const existingCategory = normalizeCategory({ id: "cat_health", name: "Santé" }, 0);
    const state = baseState({
      categories: [existingCategory],
      profile: { ...initialData().profile, whyText: "Pourquoi existant" },
    });
    const result = apply(state);

    expect(result.nextState.categories.some((category) => category.id === "cat_health")).toBe(true);
    expect(result.nextState.profile.whyText).toBe("Pourquoi existant");
  });

  it("commits local fallback plans through the same path", () => {
    const generatedPlans = buildLocalStubGeneratedPlans(firstRun().draftAnswers, NOW);
    const fallbackPlan = generatedPlans.plans[0];
    const fr = firstRun({
      generatedPlans,
      selectedPlanId: fallbackPlan.id,
      inputHash: "fallback-hash",
    });
    const result = apply(baseState(), fr, fallbackPlan);

    expect(generatedPlans.source).toBe("local_fallback");
    expect(result.ok).toBe(true);
    expect(result.commitV1.selectedPlanSource).toBe("local_fallback");
    expect(result.nextState.categories.length).toBeGreaterThan(0);
    expect(result.nextState.occurrences.some((occ) => occ.date === TODAY)).toBe(true);
  });

  it("commits v3 deterministic recommended plans through the same path", () => {
    const generatedPlans = buildDeterministicRecommendedGeneratedPlans(
      {
        whyText: "Reprendre le contrôle de mes semaines",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        preferredWindows: [{ id: "p1", daysOfWeek: [3], startTime: "08:00", endTime: "10:00", label: "Matin" }],
        unavailableWindows: [{ id: "u1", daysOfWeek: [1], startTime: "09:00", endTime: "18:00", label: "Travail" }],
        referenceDateKey: TODAY,
      },
      { inputHash: "recommended-hash", now: NOW }
    );
    const recommendedPlan = generatedPlans.plans[0];
    const fr = firstRun({
      generatedPlans,
      selectedPlanId: "recommended",
      inputHash: "recommended-hash",
    });
    const result = apply(baseState(), fr, recommendedPlan);

    expect(generatedPlans.source).toBe("deterministic_starter");
    expect(result.ok).toBe(true);
    expect(result.commitV1.selectedPlanId).toBe("recommended");
    expect(result.commitV1.selectedPlanSource).toBe("deterministic_starter");
    expect(result.nextState.categories.length).toBeGreaterThan(0);
    expect(result.nextState.occurrences.some((occ) => occ.date === TODAY)).toBe(true);
  });

  it("rebases stale generated occurrences to the commit date", () => {
    const stalePlan = plan({
      commitDraft: {
        ...plan().commitDraft,
        occurrences: [
          { id: "stale_occ", actionId: "action_deep", date: "2026-04-01", start: "08:00", durationMinutes: 25, status: "planned" },
        ],
      },
    });
    const result = apply(baseState(), firstRun(), stalePlan);

    expect(result.nextState.occurrences.some((occ) => occ.date === TODAY)).toBe(true);
    expect(result.nextState.occurrences.some((occ) => occ.date === "2026-04-01")).toBe(false);
  });

  it("returns a failure without advancing when the selected plan is invalid", () => {
    const result = apply(baseState(), firstRun(), { ...plan(), commitDraft: { categories: [], goals: [], actions: [], occurrences: [] } });

    expect(result.ok).toBe(false);
    expect(result.commitV1.status).toBe("failed");
    expect(result.errorCode).toBe("MISSING_COMMIT_CATEGORY");
  });

  it("keeps discovery locked until commit was applied and allows done afterwards", () => {
    expect(getNextFirstRunStatus("discovery", { commitV1: { status: "failed" } })).toBe("discovery");
    expect(getNextFirstRunStatus("discovery", { commitV1: { status: "applied" } })).toBe("done");
  });
});
