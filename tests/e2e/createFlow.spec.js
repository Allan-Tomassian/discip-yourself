import { test, expect } from "@playwright/test";
import { buildBaseState, getState, getTodayKey, seedState } from "./utils/seed.js";

function applyActionDraft(state, actionDraft = {}) {
  state.ui.createDraft = {
    version: 1,
    kind: "action",
    origin: { mainTab: "home", sourceSurface: "today" },
    intent: null,
    proposal: null,
    actionDraft: {
      categoryId: "cat_business",
      ...actionDraft,
    },
    outcomeDraft: null,
    status: "draft",
  };
  return state;
}

function buildCreateState({ withContent = false, actionDraft = null } = {}) {
  const state = buildBaseState({ withContent });
  state.profile = {
    ...(state.profile || {}),
    plan: "premium",
    entitlements: { premium: true },
  };
  if (actionDraft) applyActionDraft(state, actionDraft);
  return state;
}

async function openCreate(page, state) {
  await seedState(page, state);
  await page.goto("/create");
  await expect(page.locator(".pageTitle")).toContainText("Créer une action");
  await expect(page.getByPlaceholder(/Envoyer la proposition|Nom de l'action/i).first()).toBeVisible();
}

async function fillActionTitle(page, title) {
  await page.getByPlaceholder(/Envoyer la proposition|Nom de l'action/i).first().fill(title);
}

async function saveAction(page) {
  await page.getByRole("button", { name: /Créer l.action|Créer une action/ }).click();
}

async function chooseTiming(page, label) {
  await page.getByRole("button", { name: new RegExp(`^${label}\\b`) }).click();
}

test("CreateItem: action maintenant -> occurrence aujourd’hui sans heure fixe", async ({ page }) => {
  await openCreate(page, buildCreateState());

  await fillActionTitle(page, "Action maintenant E2E");
  await chooseTiming(page, "Maintenant");
  await saveAction(page);

  const next = await getState(page);
  const action = next.goals.find((goal) => goal.title === "Action maintenant E2E");
  expect(action).toBeTruthy();
  expect(action.categoryId).toBe("cat_business");
  expect(action.planType).toBe("ONE_OFF");
  expect(action.timeMode).toBe("NONE");
  expect(action.startTime || "").toBe("");
  expect((next.occurrences || []).some((occ) => occ.goalId === action.id && occ.date === getTodayKey())).toBeTruthy();
});

test("CreateItem: action aujourd’hui à heure fixe -> planning et durée persistés", async ({ page }) => {
  await openCreate(page, buildCreateState({
    actionDraft: {
      repeat: "none",
      oneOffDate: getTodayKey(),
      timeMode: "FIXED",
      startTime: "10:30",
      durationMinutes: 45,
    },
  }));

  await fillActionTitle(page, "Action heure fixe E2E");
  await expect(page.locator("input[type=\"time\"]").first()).toHaveValue("10:30");
  await saveAction(page);

  const next = await getState(page);
  const action = next.goals.find((goal) => goal.title === "Action heure fixe E2E");
  expect(action).toBeTruthy();
  expect(action.oneOffDate).toBe(getTodayKey());
  expect(action.timeMode).toBe("FIXED");
  expect(action.startTime).toBe("10:30");
  expect(action.durationMinutes).toBe(45);
  expect((next.occurrences || []).some((occ) => occ.goalId === action.id && occ.start === "10:30")).toBeTruthy();
});

test("CreateItem: action récurrente -> cadence et génération d’occurrences", async ({ page }) => {
  await openCreate(page, buildCreateState({
    actionDraft: {
      repeat: "daily",
      timeMode: "FIXED",
      startTime: "11:15",
      durationMinutes: 30,
    },
  }));

  await fillActionTitle(page, "Action récurrente E2E");
  await expect(page.locator("input[type=\"time\"]").first()).toHaveValue("11:15");
  await saveAction(page);

  const next = await getState(page);
  const action = next.goals.find((goal) => goal.title === "Action récurrente E2E");
  expect(action).toBeTruthy();
  expect(action.repeat).toBe("daily");
  expect(action.timeMode).toBe("FIXED");
  expect(action.startTime).toBe("11:15");
  expect(action.durationMinutes).toBe(30);
  const occurrences = (next.occurrences || []).filter((occ) => occ.goalId === action.id);
  expect(occurrences.length).toBeGreaterThan(0);
  expect(occurrences.some((occ) => occ.start === "11:15")).toBeTruthy();
});

test("CreateItem: conflit horaire reste une dette UI hors flux canonique", async ({ page }) => {
  const state = buildCreateState({
    withContent: true,
    actionDraft: {
      repeat: "none",
      oneOffDate: getTodayKey(),
      timeMode: "FIXED",
      startTime: "09:00",
    },
  });
  await openCreate(page, state);

  await fillActionTitle(page, "Action même créneau E2E");
  await saveAction(page);

  const next = await getState(page);
  const action = next.goals.find((goal) => goal.title === "Action même créneau E2E");
  expect(action).toBeTruthy();
  await expect(page.getByTestId("conflict-resolver-modal")).toHaveCount(0);
});
