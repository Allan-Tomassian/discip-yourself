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
});
