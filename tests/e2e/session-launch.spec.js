import { test, expect, devices } from "@playwright/test";
import { buildBaseState, buildMockProfile, getUserData, seedState } from "./utils/seed.js";

const iPhone13 = devices["iPhone 13"];
const E2E_USER_ID = "e2e-user-id";

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

async function attachScreenshot(page, testInfo, name) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

function buildBlueprint(overrides = {}) {
  return {
    version: 1,
    status: "validated",
    source: "coach_plan",
    protocolType: "sport",
    why: "activer ton énergie et tenir le rythme",
    firstStep: "commence par 3 min d’échauffement",
    ifBlocked: "fais la version courte",
    successDefinition: "séance tenue ou version courte assumée",
    estimatedMinutes: 20,
    conversationId: "conv_session_blueprint",
    ...overrides,
  };
}

function buildLaunchState({ withBlueprint = true } = {}) {
  const state = buildBaseState({ withContent: true });
  const today = state.ui.selectedDate;

  state.categories = [
    { id: "sys_inbox", name: "Général", color: "#64748B", isSystem: true },
    { id: "cat_sport", name: "Sport", color: "#22C55E" },
  ];
  state.ui.categoryRailOrder = ["cat_sport", "sys_inbox"];
  state.ui.selectedCategoryId = "cat_sport";
  state.ui.selectedCategoryByView = {
    home: "cat_sport",
    library: "cat_sport",
    plan: "cat_sport",
    pilotage: "cat_sport",
  };

  state.goals = [
    {
      id: "goal_sport",
      categoryId: "cat_sport",
      title: "Séance de sport rapide de 20 minutes",
      type: "PROCESS",
      planType: "ONE_OFF",
      status: "active",
      oneOffDate: today,
      timeMode: "FIXED",
      startTime: "19:00",
      timeSlots: ["19:00"],
      reminderTime: "18:40",
      sessionMinutes: 20,
      ...(withBlueprint ? { sessionBlueprintV1: buildBlueprint() } : {}),
    },
  ];
  state.habits = [];
  state.occurrences = [
    {
      id: "occ_launch",
      goalId: "goal_sport",
      date: today,
      start: "19:00",
      slotKey: "19:00",
      durationMinutes: 20,
      status: "planned",
    },
  ];
  state.reminders = [];

  return state;
}

async function seedApp(page, state) {
  await seedState(page, state, {
    profile: buildMockProfile({
      userId: E2E_USER_ID,
      username: "allan",
      fullName: "Allan",
    }),
  });
}

async function openTimelineLaunch(page, state) {
  await seedApp(page, state);
  await page.goto("/");
  await page.getByRole("button", { name: "Planning" }).click();
  await expect(page.locator(".lovableTimelineCardButton").first()).toBeVisible();
  await page.locator(".lovableTimelineCardButton").first().click();
  await page.getByRole("button", { name: /Démarrer la session|Reprendre la session/i }).click();
}

test("timeline opens a blueprint-backed block into Séance prête", async ({ page }, testInfo) => {
  await openTimelineLaunch(page, buildLaunchState());

  await expect(page.getByTestId("session-launch-ready")).toBeVisible();
  await expect(page.getByText("Séance prête")).toBeVisible();
  await expect(page.getByRole("button", { name: "Session standard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aller plus loin" })).toBeVisible();
  await expect(page.locator(".lovableTabBarWrap")).toHaveCount(0);
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await expect(page.getByTestId("session-top-chrome")).toBeVisible();
  await expect(page.getByText(/Exécution ·/)).toHaveCount(0);

  await attachScreenshot(page, testInfo, "session-launch-ready-timeline.png");
});

test("standard launch keeps the existing runtime and does not auto-start", async ({ page }, testInfo) => {
  await openTimelineLaunch(page, buildLaunchState());

  await expect(page.getByTestId("session-launch-ready")).toBeVisible();
  await page.getByRole("button", { name: "Session standard" }).click();

  await expect(page.getByTestId("session-launch-ready")).toHaveCount(0);
  await expect(page.getByTestId("session-action-protocol")).toBeVisible();
  await expect(page.getByTestId("session-guided-plan")).toHaveCount(0);
  await expect(page.getByTestId("session-action-dock")).toBeVisible();
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Démarrer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();

  const persisted = await getUserData(page, E2E_USER_ID);
  expect(persisted?.ui?.activeSession ?? null).toBeNull();

  await attachScreenshot(page, testInfo, "session-standard-runtime.png");
});

test("guided launch shows preparing, plan ready, and a compact guided runtime", async ({ page }, testInfo) => {
  await openTimelineLaunch(page, buildLaunchState());

  await expect(page.getByTestId("session-launch-ready")).toBeVisible();
  await page.getByRole("button", { name: "Aller plus loin" }).click();

  await expect(page.getByTestId("session-launch-preparing")).toBeVisible();
  await expect(page.getByText("Préparation en cours")).toBeVisible();
  await expect(page.locator(".lovableTabBarWrap")).toHaveCount(0);
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "session-launch-preparing.png");

  await expect(page.getByTestId("session-launch-plan-ready")).toBeVisible();
  await expect(page.getByText("Plan prêt")).toBeVisible();
  await expect(page.getByText("Échauffement")).toBeVisible();
  await expect(page.locator(".lovableTabBarWrap")).toHaveCount(0);
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "session-launch-plan-ready.png");

  await page.getByRole("button", { name: "Revenir au standard" }).click();
  await expect(page.getByTestId("session-launch-ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "Session standard" })).toBeVisible();

  await page.getByRole("button", { name: "Aller plus loin" }).click();
  await expect(page.getByTestId("session-launch-plan-ready")).toBeVisible();

  await page.getByRole("button", { name: "Lancer la session" }).click();

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByTestId("session-action-protocol")).toHaveCount(0);
  await expect(page.getByTestId("session-action-dock")).toBeVisible();
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await expect(page.getByText("Plan du bloc")).toBeVisible();
  await expect(page.getByText(/Étape 1\/3 · Item 1\//)).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();
  await expect(page.getByText("Outils")).toHaveCount(0);

  const persisted = await getUserData(page, E2E_USER_ID);
  expect(persisted?.ui?.activeSession ?? null).toBeNull();
  expect(JSON.stringify(persisted || {})).not.toContain("\"sessionRunbook\"");

  await attachScreenshot(page, testInfo, "session-guided-plan-runtime.png");
});

test("occurrences without blueprint bypass Séance prête and keep the current session behavior", async ({ page }, testInfo) => {
  await openTimelineLaunch(page, buildLaunchState({ withBlueprint: false }));

  await expect(page.getByTestId("session-launch-ready")).toHaveCount(0);
  await expect(page.getByTestId("session-action-protocol")).toBeVisible();
  await expect(page.getByTestId("session-guided-plan")).toHaveCount(0);

  await attachScreenshot(page, testInfo, "session-no-blueprint-bypass.png");
});
