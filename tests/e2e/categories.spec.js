import { test, expect } from "@playwright/test";
import { buildBaseState, seedState, getState } from "./utils/seed.js";

async function openGate(page) {
  await page.goto("/");
  await page.getByTestId("create-plus-button").click();
  await expect(page.getByTestId("category-gate-modal")).toBeVisible();
}

test("activer puis désactiver une suggestion vide", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  state.profile.plan = "premium";
  await seedState(page, state);

  await openGate(page);
  await page.getByTestId("category-toggle-suggest_apprentissage").click();

  let next = await getState(page);
  expect(next.categories.some((c) => c.id === "suggest_apprentissage")).toBeTruthy();
  expect(next.ui.categoryRailOrder.slice(-1)[0]).toBe("suggest_apprentissage");

  await page.getByTestId("category-toggle-suggest_apprentissage").click();
  next = await getState(page);
  expect(next.categories.some((c) => c.id === "suggest_apprentissage")).toBeFalsy();
  expect(next.ui.categoryRailOrder.includes("suggest_apprentissage")).toBeFalsy();
});

test("désactiver une catégorie vide", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  await openGate(page);
  await page.getByTestId("category-toggle-cat_empty").click();

  const next = await getState(page);
  expect(next.categories.some((c) => c.id === "cat_empty")).toBeFalsy();
  expect(next.ui.categoryRailOrder.includes("cat_empty")).toBeFalsy();
});

test("désactiver une catégorie non vide -> migrer", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);

  await openGate(page);
  const before = await getState(page);
  const beforeGoalIds = (before.goals || []).filter((g) => g?.categoryId === "cat_business").map((g) => g.id);
  const beforeHabitIds = (before.habits || []).filter((h) => h?.categoryId === "cat_business").map((h) => h.id);
  const trackedIds = new Set([...beforeGoalIds, ...beforeHabitIds].filter(Boolean));
  const beforeOccurrencesCount = (before.occurrences || []).filter((o) => trackedIds.has(o?.goalId)).length;
  const beforeRemindersCount = (before.reminders || []).filter((r) => trackedIds.has(r?.goalId)).length;

  await page.getByTestId("category-toggle-cat_business").click();
  await expect(page.getByTestId("category-gate-confirm")).toBeVisible();
  await page.getByTestId("category-confirm-migrate").click();

  const next = await getState(page);
  expect(next.categories.some((c) => c.id === "cat_business")).toBeFalsy();
  expect(beforeGoalIds.length).toBeGreaterThan(0);
  expect(beforeHabitIds.length).toBeGreaterThan(0);
  for (const goalId of beforeGoalIds) {
    const moved = (next.goals || []).find((g) => g?.id === goalId);
    expect(moved?.categoryId).toBe("sys_inbox");
  }
  for (const habitId of beforeHabitIds) {
    const moved = (next.habits || []).find((h) => h?.id === habitId);
    expect(moved?.categoryId).toBe("sys_inbox");
  }
  const afterOccurrencesCount = (next.occurrences || []).filter((o) => trackedIds.has(o?.goalId)).length;
  const afterRemindersCount = (next.reminders || []).filter((r) => trackedIds.has(r?.goalId)).length;
  expect(afterOccurrencesCount).toBe(beforeOccurrencesCount);
  expect(afterRemindersCount).toBe(beforeRemindersCount);
});

test("désactiver une catégorie non vide -> delete", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);

  await openGate(page);
  const before = await getState(page);
  const beforeGoalIds = (before.goals || []).filter((g) => g?.categoryId === "cat_business").map((g) => g.id);
  const beforeHabitIds = (before.habits || []).filter((h) => h?.categoryId === "cat_business").map((h) => h.id);
  const trackedIds = new Set([...beforeGoalIds, ...beforeHabitIds].filter(Boolean));

  await page.getByTestId("category-toggle-cat_business").click();
  await expect(page.getByTestId("category-gate-confirm")).toBeVisible();
  await page.getByTestId("category-confirm-delete").click();

  const next = await getState(page);
  expect(next.categories.some((c) => c.id === "cat_business")).toBeFalsy();
  expect(next.goals.some((g) => g.categoryId === "cat_business")).toBeFalsy();
  expect(next.habits.some((h) => h.categoryId === "cat_business")).toBeFalsy();
  for (const goalId of beforeGoalIds) {
    expect((next.goals || []).some((g) => g?.id === goalId)).toBeFalsy();
  }
  for (const habitId of beforeHabitIds) {
    expect((next.habits || []).some((h) => h?.id === habitId)).toBeFalsy();
  }
  expect((next.occurrences || []).some((o) => trackedIds.has(o?.goalId))).toBeFalsy();
  expect((next.reminders || []).some((r) => trackedIds.has(r?.goalId))).toBeFalsy();
});

test("inbox/system non désactivable", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  await openGate(page);
  await expect(page.getByTestId("category-toggle-sys_inbox")).toBeDisabled();
});
