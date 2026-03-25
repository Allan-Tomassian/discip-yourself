import test from "node:test";
import assert from "node:assert/strict";
import { buildNowContext } from "../src/services/context/nowContext.js";

function createNowFixture({ activeSession = null } = {}) {
  return {
    categories: [{ id: "cat-1", name: "Focus" }],
    goals: [{ id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1" }],
    occurrences: [
      { id: "occ-1", goalId: "goal-1", date: "2026-03-06", status: "planned", start: "17:00" },
      { id: "occ-2", goalId: "goal-1", date: "2026-03-08", status: "planned", start: "09:00" },
    ],
    ui: { activeSession },
    sessionHistory: [],
  };
}

test("buildNowContext keeps only the active session that belongs to the active date", () => {
  const context = buildNowContext({
    data: createNowFixture({
      activeSession: {
        id: "sess-today",
        dateKey: "2026-03-06",
        occurrenceId: "occ-1",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
    }),
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-1",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.activeDate, "2026-03-06");
  assert.equal(context.isToday, true);
  assert.equal(context.activeSessionForActiveDate?.id, "sess-today");
  assert.equal(context.openSessionOutsideActiveDate, null);
  assert.deepEqual(context.futureSessions, []);
  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-1");
  assert.equal(context.focusOccurrenceSummary?.title, "Deep work");
  assert.equal(context.focusOccurrenceSummary?.timeLabel, "à 17:00");
  assert.equal(context.focusSelectionReason, "upcoming_fixed");
  assert.equal(context.dayLoadSummary?.plannedCount, 1);
  assert.equal(context.activeSession?.id, "sess-today");
  assert.equal(context.topOccurrence?.id, "occ-1");
});

test("buildNowContext distinguishes a future open session without polluting today's context", () => {
  const context = buildNowContext({
    data: createNowFixture({
      activeSession: {
        id: "sess-future",
        dateKey: "2026-03-07",
        occurrenceId: "occ-future",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
    }),
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-2",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.activeSessionForActiveDate, null);
  assert.equal(context.openSessionOutsideActiveDate?.id, "sess-future");
  assert.equal(context.futureSessions.length, 1);
  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-1");
  assert.equal(context.scheduleSignalSummary?.type, "future_open_session");
  assert.equal(context.activeSession, null);
  assert.equal(context.topOccurrence?.id, "occ-1");
});

test("buildNowContext marks a future selected date as not today", () => {
  const context = buildNowContext({
    data: createNowFixture(),
    selectedDateKey: "2026-03-08",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-3",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.activeDate, "2026-03-08");
  assert.equal(context.isToday, false);
  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-2");
  assert.equal(context.focusOccurrenceSummary?.title, "Deep work");
});

test("buildNowContext exposes gapSummary when there is no action planned today", () => {
  const context = buildNowContext({
    data: {
      categories: [{ id: "cat-1", name: "Focus" }],
      goals: [
        { id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1", status: "active", sessionMinutes: 25 },
        { id: "goal-2", title: "Run 20 min", type: "PROCESS", categoryId: "cat-1", status: "active" },
      ],
      occurrences: [{ id: "occ-2", goalId: "goal-2", date: "2026-03-05", status: "done", start: "08:00", durationMinutes: 20 }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-gap-empty",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.gapSummary.hasGapToday, true);
  assert.equal(context.gapSummary.gapReason, "empty_day");
  assert.equal(context.gapSummary.candidateActionSummaries.length, 2);
  assert.equal(context.gapSummary.selectionScope, "active_category");
  assert.equal(context.gapSummary.activeCategoryCandidateCount, 2);
  assert.equal(context.gapSummary.crossCategoryCandidateCount, 0);
  assert.equal(context.gapSummary.candidateActionSummaries[0].title, "Run 20 min");
});

test("buildNowContext prioritizes active-category candidates when the active category has nothing planned today", () => {
  const context = buildNowContext({
    data: {
      categories: [
        { id: "cat-1", name: "Focus" },
        { id: "cat-2", name: "Sport" },
      ],
      goals: [
        { id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1", status: "active", sessionMinutes: 20 },
        { id: "goal-2", title: "Run 20 min", type: "PROCESS", categoryId: "cat-2", status: "active", sessionMinutes: 20 },
      ],
      occurrences: [{ id: "occ-2", goalId: "goal-2", date: "2026-03-06", status: "planned", start: "08:00", durationMinutes: 20 }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-gap-category",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.gapSummary.hasGapToday, true);
  assert.equal(context.gapSummary.emptyActiveCategory, true);
  assert.equal(context.gapSummary.lowLoadToday, true);
  assert.equal(context.gapSummary.gapReason, "empty_active_category");
  assert.equal(context.gapSummary.selectionScope, "active_category");
  assert.equal(context.gapSummary.activeCategoryCandidateCount, 1);
  assert.equal(context.gapSummary.crossCategoryCandidateCount, 0);
  assert.equal(context.gapSummary.candidateActionSummaries[0].title, "Deep work");
  assert.equal(context.focusOccurrenceForActiveDate, null);
});

test("buildNowContext falls back to structure_missing when no cross-category proof exists", () => {
  const context = buildNowContext({
    data: {
      categories: [
        { id: "cat-1", name: "Focus" },
        { id: "cat-2", name: "Sport" },
      ],
      goals: [
        { id: "goal-1", title: "Deep work", type: "OUTCOME", categoryId: "cat-1", status: "active" },
        { id: "goal-2", title: "Run 20 min", type: "PROCESS", categoryId: "cat-2", status: "active", sessionMinutes: 20 },
        { id: "goal-3", title: "Swim 30 min", type: "PROCESS", categoryId: "cat-2", status: "active", sessionMinutes: 30 },
      ],
      occurrences: [{ id: "occ-2", goalId: "goal-2", date: "2026-03-06", status: "planned", start: "08:00", durationMinutes: 20 }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-gap-cross-category",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.gapSummary.hasGapToday, true);
  assert.equal(context.gapSummary.selectionScope, "structure_missing");
  assert.equal(context.gapSummary.activeCategoryCandidateCount, 0);
  assert.equal(context.gapSummary.crossCategoryCandidateCount, 0);
  assert.equal(context.gapSummary.candidateActionSummaries.length, 0);
  assert.equal(context.focusOccurrenceForActiveDate, null);
});

test("buildNowContext prioritizes structure_missing before a proven cross-category occurrence", () => {
  const context = buildNowContext({
    data: {
      categories: [
        { id: "cat-1", name: "Finance", mainGoalId: "goal-finance" },
        { id: "cat-2", name: "Work" },
      ],
      goals: [
        { id: "goal-finance", title: "Augmenter les revenus", type: "OUTCOME", categoryId: "cat-1", status: "active" },
        { id: "goal-work", title: "Travailler l'offre", type: "PROCESS", categoryId: "cat-2", status: "active", sessionMinutes: 30 },
      ],
      occurrences: [{ id: "occ-work", goalId: "goal-work", date: "2026-03-06", status: "planned", start: "08:00", durationMinutes: 30 }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-gap-cross-proof",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.gapSummary.selectionScope, "structure_missing");
  assert.equal(context.categoryCoherence.reasonLinkType, "structure_missing");
  assert.equal(context.categoryCoherence.recommendedCategoryLabel, "Finance");
  assert.equal(context.categoryCoherence.contributionTargetLabel, "Augmenter les revenus");
  assert.equal(context.focusOccurrenceForActiveDate, null);
});

test("buildNowContext prefers an occurrence in the active category over an earlier off-category block", () => {
  const context = buildNowContext({
    data: {
      categories: [
        { id: "cat-1", name: "Finance" },
        { id: "cat-2", name: "Work" },
      ],
      goals: [
        { id: "goal-finance", title: "Budget", type: "PROCESS", categoryId: "cat-1", status: "active" },
        { id: "goal-work", title: "Call client", type: "PROCESS", categoryId: "cat-2", status: "active" },
      ],
      occurrences: [
        { id: "occ-work", goalId: "goal-work", date: "2026-03-06", status: "planned", start: "08:00", durationMinutes: 30 },
        { id: "occ-finance", goalId: "goal-finance", date: "2026-03-06", status: "planned", start: "15:00", durationMinutes: 20 },
      ],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-scoped-occurrence",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-finance");
  assert.equal(context.categoryCoherence.reasonLinkType, "direct_category");
});

test("buildNowContext uses preferred time blocks to select the most aligned flexible occurrence", () => {
  const context = buildNowContext({
    data: {
      categories: [{ id: "cat-1", name: "Focus" }],
      goals: [
        { id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-1", status: "active" },
        { id: "goal-2", title: "Review", type: "PROCESS", categoryId: "cat-1", status: "active" },
      ],
      occurrences: [
        {
          id: "occ-morning",
          goalId: "goal-1",
          date: "2026-03-06",
          status: "planned",
          start: "00:00",
          slotKey: "00:00",
          noTime: true,
          timeType: "window",
          windowStartAt: "2026-03-06T07:00",
          windowEndAt: "2026-03-06T12:00",
          durationMinutes: 20,
        },
        {
          id: "occ-evening",
          goalId: "goal-2",
          date: "2026-03-06",
          status: "planned",
          start: "00:00",
          slotKey: "00:00",
          noTime: true,
          timeType: "window",
          windowStartAt: "2026-03-06T18:00",
          windowEndAt: "2026-03-06T22:00",
          durationMinutes: 25,
        },
      ],
      user_ai_profile: {
        goals: ["learning"],
        time_budget_daily_min: 60,
        intensity_preference: "balanced",
        preferred_time_blocks: ["evening"],
        structure_preference: "simple",
      },
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-preferred-block",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.focusSelectionReason, "highest_priority_flexible");
  assert.equal(context.focusOccurrenceForActiveDate?.id, "occ-evening");
  assert.equal(context.dayLoadSummary.targetBudgetMinutes, 60);
  assert.equal(context.dayLoadSummary.preferredBlockAlignment, "partial_match");
});

test("buildNowContext excludes the onboarding planning goal from gap-fill candidates", () => {
  const context = buildNowContext({
    data: {
      categories: [{ id: "cat-1", name: "Focus" }],
      goals: [
        {
          id: "goal-planning",
          title: "Planifier journée",
          type: "PROCESS",
          categoryId: "cat-1",
          status: "active",
          templateId: "ai_onboarding_planning",
        },
        {
          id: "goal-1",
          title: "Deep work",
          type: "PROCESS",
          categoryId: "cat-1",
          status: "active",
          sessionMinutes: 25,
        },
      ],
      occurrences: [],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-gap-skip-planning",
    trigger: "screen_open",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.gapSummary.candidateActionSummaries.length, 1);
  assert.equal(context.gapSummary.candidateActionSummaries[0].title, "Deep work");
});

test("buildNowContext exposes the active category profile summary when available", () => {
  const context = buildNowContext({
    data: {
      categories: [{ id: "cat-1", name: "Santé" }],
      category_profiles_v1: {
        version: 1,
        byCategoryId: {
          "cat-1": {
            categoryId: "cat-1",
            subject: "Reprendre ma forme",
            mainGoal: "Retrouver de l’énergie",
            currentPriority: "Dormir plus régulièrement",
          },
        },
      },
      goals: [{ id: "goal-1", title: "Marcher 20 min", type: "PROCESS", categoryId: "cat-1" }],
      occurrences: [{ id: "occ-1", goalId: "goal-1", date: "2026-03-06", status: "planned", start: "08:00" }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaState: { remaining: 3 },
    requestId: "req-profile",
    trigger: "manual",
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.deepEqual(context.activeCategoryProfileSummary, {
    categoryId: "cat-1",
    categoryLabel: "Santé",
    subject: "Reprendre ma forme",
    mainGoal: "Retrouver de l’énergie",
    currentPriority: "Dormir plus régulièrement",
    watchpoints: [],
    constraints: [],
    currentLevel: null,
    hasProfile: true,
  });
});
