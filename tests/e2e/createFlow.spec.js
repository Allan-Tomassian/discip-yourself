import { test, expect } from "@playwright/test";
import { buildBaseState, seedState, getState, getTodayKey } from "./utils/seed.js";

async function openCreateFlow(page) {
  await page.goto("/");
  await page.getByTestId("create-plus-button").click();
  await expect(page.getByTestId("category-gate-modal")).toBeVisible();
  await page.getByTestId("category-row-cat_business").click();
  await page.getByTestId("category-gate-continue").click();
  await expect(page.getByTestId("create-flow-modal")).toBeVisible();
}

test("Projet + Action (guidé) -> ouvre l’étape projet", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  await openCreateFlow(page);
  await page.getByTestId("create-choice-guided").click();
  await expect(page.getByPlaceholder("Nom du projet")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
});

test("Action ponctuelle -> occurrence au bon jour", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  await openCreateFlow(page);
  await page.getByTestId("create-choice-action").click();
  await page.getByTestId("create-type-oneoff").click();

  await page.getByPlaceholder("Nouvelle action").fill("Action OneOff");
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();

  const next = await getState(page);
  const action = next.goals.find((g) => g.title === "Action OneOff");
  expect(action).toBeTruthy();
  const today = getTodayKey();
  const occ = next.occurrences.filter((o) => o.goalId === action.id);
  expect(occ.some((o) => o.date === today)).toBeTruthy();
});

test("Action récurrente planifiée -> planning + durée persistés", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  await openCreateFlow(page);
  await page.getByTestId("create-choice-action").click();
  await page.getByTestId("create-type-recurring").click();

  await page.getByPlaceholder("Nouvelle action").fill("Action Recurring Planned");
  await page.locator("input[type=\"time\"]").first().fill("10:30");
  await page.locator("input[placeholder=\"Minutes\"]").first().fill("45");
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();

  const next = await getState(page);
  const action = next.goals.find((g) => g.title === "Action Recurring Planned");
  expect(action).toBeTruthy();
  expect(action.repeat).toBe("weekly");
  expect(action.timeMode).toBe("FIXED");
  expect(action.startTime).toBe("10:30");
  expect(action.durationMinutes).toBe(45);
  const occ = next.occurrences.filter((o) => o.goalId === action.id);
  expect(occ.length).toBeGreaterThanOrEqual(1);
  expect(occ.some((o) => o.start === "10:30")).toBeTruthy();
});

test("Action récurrente -> conflit horaire bloquant avant résolution", async ({ page }) => {
  const state = buildBaseState({ withContent: true });
  await seedState(page, state);

  await openCreateFlow(page);
  await page.getByTestId("create-choice-action").click();
  await page.getByTestId("create-type-recurring").click();

  await page.getByPlaceholder("Nouvelle action").fill("Action Conflict Blocking");
  await page.locator("input[type=\"time\"]").first().fill("09:00");
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();

  await expect(page.getByTestId("conflict-resolver-modal")).toBeVisible();
  await expect(page.getByText("Conflit d’horaire")).toBeVisible();

  const next = await getState(page);
  expect(next.goals.some((g) => g.title === "Action Conflict Blocking")).toBeFalsy();
});

test("Action anytime -> sans date fixe", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  await openCreateFlow(page);
  await page.getByTestId("create-choice-action").click();
  await page.getByTestId("create-type-anytime").click();

  await page.getByPlaceholder("Nouvelle action").fill("Action Anytime");
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();

  const next = await getState(page);
  const action = next.goals.find((g) => g.title === "Action Anytime");
  expect(action).toBeTruthy();
  expect(action.habitType).toBe("ANYTIME");
  expect(action.timeMode).toBe("NONE");
  expect(action.startTime || "").toBe("");
  expect(Array.isArray(action.timeSlots) ? action.timeSlots : []).toEqual([]);

  const occ = next.occurrences.filter((o) => o.goalId === action.id);
  expect(occ.length).toBeGreaterThan(0);
  expect(occ.every((o) => o.start === "00:00" || o.noTime === true)).toBeTruthy();

  const createdIds = Array.isArray(next.ui?.createDraft?.createdActionIds)
    ? next.ui.createDraft.createdActionIds
    : [];
  expect(createdIds.includes(action.id)).toBeTruthy();
});

test("Ordre catégories = railOrder, modifier conserve ordre", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  await openCreateFlow(page);
  await page.getByTestId("create-change-category").click();
  await expect(page.getByTestId("category-gate-modal")).toBeVisible();

  const rows = page.locator("[data-testid^=\"category-row-\"]");
  const ids = await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  expect(ids[0]).toBe("category-row-cat_business");
  expect(ids[1]).toBe("category-row-cat_empty");
});
