import { test, expect } from "@playwright/test";
import { buildBaseState, getState, seedState } from "./utils/seed.js";

test("Objectifs: catégorie directe affiche un détail avec retour et gestion", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);

  await page.goto("/category/cat_business");

  await expect(page.locator(".pageTitle")).toContainText("Business");
  await expect(page.getByRole("button", { name: /Objectifs|Retour/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Gérer" })).toBeVisible();
  await expect(page.getByText("Projet Seed")).toBeVisible();
  await expect(page.getByText("Action Seed")).toBeVisible();

  await page.getByRole("button", { name: /Objectifs|Retour/i }).first().click();
  await expect(page).toHaveURL(/\/objectives$/);
  await expect(page.locator(".pageTitle")).toContainText("Objectifs");
});

test("Objectifs: catégorie introuvable n’est pas un cul-de-sac", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);

  await page.goto("/category/missing-category");

  await expect(page.getByText("Catégorie introuvable")).toBeVisible();
  await page.getByRole("button", { name: /Objectifs|Retour/i }).first().click();
  await expect(page).toHaveURL(/\/objectives$/);
});

test("Objectifs: une action liée reste rattachée à sa catégorie et à son objectif", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  state.goals = state.goals.map((goal) =>
    goal.id === "goal_action"
      ? { ...goal, parentId: "goal_proj", outcomeId: "goal_proj" }
      : goal
  );
  await seedState(page, state);

  await page.goto("/objectives");
  await expect(page.locator(".pageTitle")).toContainText("Objectifs");
  await expect(page.getByText("Projet Seed", { exact: true })).toBeVisible();
  await page.getByText("Projet Seed", { exact: true }).click();
  await expect(page.locator(".objectivesActionTitle", { hasText: "Action Seed" }).first()).toBeVisible();

  const snapshot = await getState(page);
  const action = snapshot.goals.find((goal) => goal.id === "goal_action");
  expect(action.categoryId).toBe("cat_business");
  expect(action.parentId || action.outcomeId).toBe("goal_proj");
});
