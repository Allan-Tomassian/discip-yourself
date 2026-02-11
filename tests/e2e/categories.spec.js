import { test, expect } from "@playwright/test";
import { buildBaseState, seedState, getState } from "./utils/seed.js";

async function openGate(page) {
  await page.goto("/");
  await page.getByTestId("create-plus-button").click();
  await expect(page.getByTestId("category-gate-modal")).toBeVisible();
}

async function openLibrary(page) {
  await page.goto("/");
  const nav = page.locator("[data-tour-id=\"topnav-tabs\"]");
  await nav.getByRole("button", { name: /Bibliothèque/i }).click();
  await expect(page.locator("[data-tour-id=\"library-title\"]")).toBeVisible();
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

test("Bibliothèque: gérer active l'édition inline sans navigation et persiste", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  state.categories = [
    ...(state.categories || []),
    { id: "cat_inline", name: "Inline Seed", color: "#A855F7" },
  ];
  state.ui.categoryRailOrder = ["cat_inline", ...(state.ui.categoryRailOrder || [])];
  state.ui.selectedCategoryByView = {
    ...(state.ui.selectedCategoryByView || {}),
    library: "cat_inline",
  };
  await seedState(page, state);

  const updatedName = "Inline Custom E2E";
  const updatedWhy = "Mini-why inline e2e";

  await openLibrary(page);
  const beforeManageUrl = page.url();

  await page.locator("[data-tour-id=\"library-category-list\"]").getByText("Inline Seed", { exact: true }).first().click();
  await page.getByRole("button", { name: "Gérer" }).first().click();
  await expect(page).toHaveURL(beforeManageUrl);
  await expect(page.getByRole("button", { name: "Terminer" }).first()).toBeVisible();
  await expect(page.getByTestId("library-detail-name-cat_inline")).toBeVisible();
  await expect(page.getByTestId("library-detail-why-cat_inline")).toBeVisible();

  await page.getByTestId("library-detail-name-cat_inline").fill(updatedName);
  await page.getByTestId("library-detail-name-cat_inline").press("Enter");
  await page.getByTestId("library-detail-why-cat_inline").fill(updatedWhy);
  await page.getByRole("button", { name: "Terminer" }).first().click();
  await expect(page.getByRole("button", { name: "Gérer" }).first()).toBeVisible();

  await page.locator("[data-tour-id=\"library-category-list\"]").getByText("Business", { exact: true }).first().click();
  await page.getByRole("button", { name: "Gérer" }).first().click();
  await expect(page.getByTestId("library-detail-name-cat_inline")).toHaveCount(0);
  await expect(page.getByTestId("library-detail-name-cat_business")).toBeVisible();
  await page.getByRole("button", { name: "Terminer" }).first().click();

  await expect
    .poll(async () => {
      const snapshot = await getState(page);
      const inlineSnapshot = (snapshot.categories || []).find((c) => c?.id === "cat_inline");
      return inlineSnapshot?.name || "";
    })
    .toBe(updatedName);
  await expect
    .poll(async () => {
      const snapshot = await getState(page);
      const inlineSnapshot = (snapshot.categories || []).find((c) => c?.id === "cat_inline");
      return inlineSnapshot?.whyText || "";
    })
    .toBe(updatedWhy);

  const persistedPage = await page.context().newPage();
  await openLibrary(persistedPage);
  const next = await getState(persistedPage);
  const inlineCategory = (next.categories || []).find((c) => c?.id === "cat_inline");
  expect(inlineCategory?.name).toBe(updatedName);
  expect(inlineCategory?.whyText).toBe(updatedWhy);
  await persistedPage.close();
});

test("Bibliothèque: gérer permet d'éditer projets/actions inline et d'ouvrir le panneau d'édition sans navigation", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);

  const updatedProject = "Projet Seed Renommé";
  const updatedAction = "Action Seed Renommée";

  await openLibrary(page);
  const libraryUrl = page.url();

  await page.locator("[data-tour-id=\"library-category-list\"]").getByText("Business", { exact: true }).first().click();
  await page.getByRole("button", { name: "Gérer" }).first().click();
  await expect(page).toHaveURL(libraryUrl);

  await page.getByTestId("library-project-rename-goal_proj").click();
  await page.getByTestId("library-project-title-input-goal_proj").fill(updatedProject);
  await page.getByTestId("library-project-title-input-goal_proj").press("Enter");
  await page.getByTestId("library-action-rename-goal_action").click();
  await page.getByTestId("library-action-title-input-goal_action").fill(updatedAction);
  await page.getByTestId("library-action-title-input-goal_action").press("Enter");

  await page.getByTestId("library-action-edit-goal_action").click();
  await expect(page).toHaveURL(libraryUrl);
  await expect(page.getByRole("button", { name: "Fermer" })).toBeVisible();
  await page.getByRole("button", { name: "Fermer" }).click();

  await page.getByRole("button", { name: "Terminer" }).first().click();

  await expect
    .poll(async () => {
      const snapshot = await getState(page);
      const project = (snapshot.goals || []).find((g) => g?.id === "goal_proj");
      const action = (snapshot.goals || []).find((g) => g?.id === "goal_action");
      return {
        projectTitle: project?.title || "",
        actionTitle: action?.title || "",
      };
    })
    .toEqual({ projectTitle: updatedProject, actionTitle: updatedAction });

  await page.getByRole("button", { name: "Gérer" }).first().click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("library-project-delete-goal_proj").click();
  await page.getByRole("button", { name: "Terminer" }).first().click();

  await expect
    .poll(async () => {
      const snapshot = await getState(page);
      const hasProject = (snapshot.goals || []).some((g) => g?.id === "goal_proj");
      const action = (snapshot.goals || []).find((g) => g?.id === "goal_action");
      return {
        hasProject,
        actionTitle: action?.title || "",
      };
    })
    .toEqual({ hasProject: false, actionTitle: updatedAction });

  const persistedPage = await page.context().newPage();
  await openLibrary(persistedPage);
  const persisted = await getState(persistedPage);
  expect((persisted.goals || []).some((g) => g?.id === "goal_proj")).toBeFalsy();
  expect((persisted.goals || []).find((g) => g?.id === "goal_action")?.title || "").toBe(updatedAction);
  await persistedPage.close();
});
