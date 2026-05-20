import { test, expect } from "@playwright/test";
import { buildBaseState, getState, getTodayKey, seedState } from "./utils/seed.js";

function buildPremiumState() {
  const state = buildBaseState({ withContent: false });
  state.profile = {
    ...(state.profile || {}),
    plan: "premium",
    entitlements: { premium: true },
  };
  return state;
}

function applyFixedCreateDraft(state, title) {
  state.ui.createDraft = {
    version: 1,
    kind: "action",
    origin: { mainTab: "home", sourceSurface: "today" },
    intent: null,
    proposal: null,
    actionDraft: {
      title,
      categoryId: "cat_business",
      repeat: "none",
      oneOffDate: getTodayKey(),
      timeMode: "FIXED",
      startTime: "14:00",
      durationMinutes: 35,
    },
    outcomeDraft: null,
    status: "draft",
  };
}

async function createFixedAction(page, title) {
  await page.goto("/create");
  await expect(page.locator(".pageTitle")).toContainText("Créer une action");
  await expect(page.getByPlaceholder(/Envoyer la proposition|Nom de l'action/i).first()).toHaveValue(title);
  await expect(page.locator("input[type=\"time\"]").first()).toHaveValue("14:00");
  await page.getByRole("button", { name: /Créer l.action|Créer une action/ }).click();
}

test("CreateItem: action créée visible dans Today, Planning, Objectifs et Ajuster", async ({ page }) => {
  const state = buildPremiumState();
  const title = "E2E Action canonique";
  applyFixedCreateDraft(state, title);
  await seedState(page, state);

  await createFixedAction(page, title);

  const next = await getState(page);
  const action = next.goals.find((goal) => goal.title === title);
  expect(action).toBeTruthy();
  expect(action.categoryId).toBe("cat_business");
  expect((next.occurrences || []).some((occ) => occ.goalId === action.id && occ.date === getTodayKey())).toBeTruthy();

  await page.getByLabel("Navigation principale").getByRole("button", { name: "Home" }).click();
  await expect(page.getByTestId("today-primary-action-card")).toContainText(title);

  await page.getByLabel("Navigation principale").getByRole("button", { name: "Planning" }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  await page.getByLabel("Navigation principale").getByRole("button", { name: "Objectifs" }).click();
  await page.getByRole("button", { name: /Business actions/i }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();

  await page.getByLabel("Navigation principale").getByRole("button", { name: "Ajuster" }).click();
  await expect(page.locator(".pageTitle")).toContainText("Ajuster");
  await expect(page.getByText(/diagnostic|recommandation|système/i).first()).toBeVisible();
});

test("CreateItem: action anytime reste sans horaire après reload", async ({ page }) => {
  const state = buildPremiumState();
  await seedState(page, state);
  const title = "E2E Action souple";

  await page.goto("/create");
  await page.getByPlaceholder(/Envoyer la proposition|Nom de l'action/i).first().fill(title);
  await page.getByRole("button", { name: /Créer l.action|Créer une action/ }).click();

  let next = await getState(page);
  const action = next.goals.find((goal) => goal.title === title);
  expect(action).toBeTruthy();
  expect(action.timeMode).toBe("NONE");
  expect(action.startTime || "").toBe("");
  expect((next.occurrences || []).filter((occ) => occ.goalId === action.id).length).toBeGreaterThan(0);

  const reloaded = await page.context().newPage();
  await reloaded.goto("/");
  next = await getState(reloaded);
  const persistedAction = next.goals.find((goal) => goal.title === title);
  expect(persistedAction?.timeMode).toBe("NONE");
  expect(persistedAction?.startTime || "").toBe("");
  await reloaded.close();
});
