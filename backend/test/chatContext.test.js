import test from "node:test";
import assert from "node:assert/strict";
import { buildChatContext } from "../src/services/context/chatContext.js";

test("buildChatContext injects the active profile and related profiles mentioned by the user", () => {
  const context = buildChatContext({
    data: {
      categories: [
        { id: "cat-finance", name: "Finance" },
        { id: "cat-work", name: "Travail" },
      ],
      category_profiles_v1: {
        version: 1,
        byCategoryId: {
          "cat-finance": {
            categoryId: "cat-finance",
            subject: "Assainir mes finances",
            mainGoal: "Retrouver de la marge",
            currentPriority: "Réduire les dépenses fixes",
          },
          "cat-work": {
            categoryId: "cat-work",
            subject: "Stabiliser mon activité",
            mainGoal: "Signer une nouvelle mission",
            currentPriority: "Envoyer des propositions",
          },
        },
      },
      goals: [
        { id: "goal-finance", title: "Revoir budget", type: "PROCESS", categoryId: "cat-finance" },
        { id: "goal-work", title: "Préparer une offre", type: "PROCESS", categoryId: "cat-work" },
      ],
      occurrences: [{ id: "occ-finance", goalId: "goal-finance", date: "2026-03-06", status: "planned", start: "09:00" }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-finance",
    quotaState: { remaining: 3 },
    requestId: "req-chat-profile",
    body: {
      message: "Je veux arbitrer entre Finance et Travail aujourd’hui.",
      recentMessages: [],
    },
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.deepEqual(context.activeCategoryProfileSummary, {
    categoryId: "cat-finance",
    categoryLabel: "Finance",
    subject: "Assainir mes finances",
    mainGoal: "Retrouver de la marge",
    currentPriority: "Réduire les dépenses fixes",
    watchpoints: [],
    constraints: [],
    currentLevel: null,
    hasProfile: true,
  });
  assert.equal(Array.isArray(context.relatedCategoryProfileSummaries), true);
  assert.equal(context.relatedCategoryProfileSummaries.length, 1);
  assert.deepEqual(context.relatedCategoryProfileSummaries[0], {
    categoryId: "cat-work",
    categoryLabel: "Travail",
    subject: "Stabiliser mon activité",
    mainGoal: "Signer une nouvelle mission",
    currentPriority: "Envoyer des propositions",
    watchpoints: [],
    constraints: [],
    currentLevel: null,
    hasProfile: true,
  });
  assert.equal(context.locale, "fr-FR");
  assert.equal(context.useCase, "general");
  assert.deepEqual(context.coachBehavior, {
    mode: "clarity",
    overlays: ["choice_narrowing"],
    horizon: "today",
    intensity: "standard",
  });
});

test("buildChatContext preserves locale and useCase from /ai/chat payload", () => {
  const context = buildChatContext({
    data: {
      categories: [{ id: "cat-focus", name: "Focus" }],
      goals: [{ id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-focus" }],
      occurrences: [{ id: "occ-1", goalId: "goal-1", date: "2026-03-06", status: "planned", start: "09:00" }],
      ui: { activeSession: null },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-focus",
    quotaState: { remaining: 3 },
    requestId: "req-chat-locale",
    body: {
      mode: "plan",
      locale: "fr-CA",
      useCase: "life_plan",
      message: "Aide-moi à structurer cette catégorie.",
      recentMessages: [{ role: "user", content: "Je veux un plan simple." }],
    },
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.chatMode, "plan");
  assert.equal(context.locale, "fr-CA");
  assert.equal(context.useCase, "life_plan");
  assert.deepEqual(context.recentMessages, [{ role: "user", content: "Je veux un plan simple." }]);
  assert.deepEqual(context.coachBehavior, {
    mode: "clarity",
    overlays: [],
    horizon: "now",
    intensity: "standard",
  });
});

test("buildChatContext ignores guided runtime extras inside ui.activeSession", () => {
  const context = buildChatContext({
    data: {
      categories: [{ id: "cat-focus", name: "Focus" }],
      goals: [{ id: "goal-1", title: "Deep work", type: "PROCESS", categoryId: "cat-focus" }],
      occurrences: [{ id: "occ-1", goalId: "goal-1", date: "2026-03-06", status: "planned", start: "09:00" }],
      ui: {
        activeSession: {
          id: "sess-guided",
          occurrenceId: "occ-1",
          objectiveId: null,
          habitIds: ["goal-1"],
          dateKey: "2026-03-06",
          runtimePhase: "in_progress",
          status: "partial",
          timerRunning: true,
          timerStartedAt: "2026-03-06T09:00:00.000Z",
          timerAccumulatedSec: 120,
          experienceMode: "guided",
          guidedRuntimeV1: {
            version: 1,
            occurrenceId: "occ-1",
            guidedSpatialState: { mode: "active" },
          },
        },
      },
      sessionHistory: [],
    },
    selectedDateKey: "2026-03-06",
    activeCategoryId: "cat-focus",
    quotaState: { remaining: 3 },
    requestId: "req-chat-guided-active-session",
    body: {
      mode: "free",
      message: "Aide-moi à garder le cap.",
      recentMessages: [],
    },
    now: new Date(2026, 2, 6, 12, 0, 0),
  });

  assert.equal(context.activeSessionForActiveDate?.id, "sess-guided");
  assert.equal(context.activeSessionForActiveDate?.occurrenceId, "occ-1");
  assert.equal("experienceMode" in context.activeSessionForActiveDate, false);
  assert.equal("guidedRuntimeV1" in context.activeSessionForActiveDate, false);
});
