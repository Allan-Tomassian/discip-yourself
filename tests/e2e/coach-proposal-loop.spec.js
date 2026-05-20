import { test, expect, devices } from "@playwright/test";
import { appendCoachConversationMessages } from "../../src/features/coach/coachStorage.js";
import { getState } from "./utils/seed.js";
import {
  buildCanonicalExecutionState,
  seedCurrentUser,
} from "./utils/currentProduct.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

function buildCoachState({ unresolved = false } = {}) {
  const state = buildCanonicalExecutionState({ premium: true });
  const today = state.ui.selectedDate;
  const proposal = {
    kind: "assistant",
    categoryDraft: {
      mode: "existing",
      id: "cat_business",
      label: "Business",
    },
    outcomeDraft: unresolved ? null : { title: "Stabiliser le lancement client" },
    actionDrafts: [
      {
        title: unresolved ? "Action à clarifier" : "Préparer le jalon client",
        categoryId: "cat_business",
        oneOffDate: today,
        startTime: "16:00",
        durationMinutes: 25,
      },
    ],
    unresolvedQuestions: unresolved ? ["Quel créneau veux-tu vraiment protéger ?"] : [],
    requiresValidation: true,
  };

  state.coach_conversations_v1 = appendCoachConversationMessages(null, {
    messages: [
      {
        role: "assistant",
        text: "Je te propose un plan concret.",
        createdAt: "2026-05-20T10:00:00.000Z",
        coachReply: {
          kind: "conversation",
          mode: "plan",
          message: "Je te propose un plan concret.",
          proposal,
        },
      },
    ],
    contextSnapshot: { activeCategoryId: "cat_business", dateKey: today },
    mode: "plan",
  }).state;

  return state;
}

test("Coach Plan: les questions en suspens bloquent la création", async ({ page }) => {
  await seedCurrentUser(page, buildCoachState({ unresolved: true }));

  await page.goto("/coach");
  await expect(page.getByText("Plan proposé")).toBeVisible();
  await expect(page.getByText("Quel créneau veux-tu vraiment protéger ?")).toBeVisible();
  await page.getByRole("button", { name: "Valider" }).click();

  await expect(page.getByText("Confirme d’abord les points en suspens avec le coach.")).toBeVisible();
  const next = await getState(page);
  expect(next.goals.some((goal) => goal.title === "Action à clarifier")).toBeFalsy();
});

test("Coach Plan: une proposition valide peut être revue puis créée", async ({ page }) => {
  await seedCurrentUser(page, buildCoachState({ unresolved: false }));

  await page.goto("/coach");
  await expect(page.getByText("Plan proposé")).toBeVisible();
  await page.getByRole("button", { name: "Modifier" }).click();

  await expect(page).toHaveURL(/\/create$/);
  await expect(page.locator(".pageTitle")).toContainText("Valider la proposition");
  await expect(page.getByPlaceholder("Nom de l'action")).toHaveValue("Préparer le jalon client");
  await page.getByRole("button", { name: "Valider la proposition" }).click();

  const next = await getState(page);
  const action = next.goals.find((goal) => goal.title === "Préparer le jalon client");
  const outcome = next.goals.find((goal) => goal.title === "Stabiliser le lancement client");
  expect(action).toBeTruthy();
  expect(outcome).toBeTruthy();
  expect(action.parentId || action.outcomeId).toBe(outcome.id);
  expect((next.occurrences || []).some((occurrence) => occurrence.goalId === action.id)).toBeTruthy();

  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByText("Plan créé")).toBeVisible();
  await page.getByRole("button", { name: "Voir dans l’app" }).click();
  await expect(page).toHaveURL(/\/objectives$/);
  await expect(page.locator(".objectivesActionTitle", { hasText: "Préparer le jalon client" }).first()).toBeVisible();
});
