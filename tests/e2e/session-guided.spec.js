import { test, expect, devices } from "@playwright/test";
import { buildBaseState, buildMockProfile, seedState } from "./utils/seed.js";
import { enablePremium, installSessionGuidanceMock } from "./utils/sessionGuidanceMock.js";

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

function buildLaunchState() {
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
      sessionBlueprintV1: buildBlueprint(),
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

  return enablePremium(state);
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
  await page.locator(".lovableTimelineCardButton").first().click();
  await page.getByRole("button", { name: /Démarrer la session|Reprendre la session/i }).click();
}

test("standard adjust applies a lightweight local patch without opening guided mode", async ({ page }, testInfo) => {
  await openTimelineLaunch(page, buildLaunchState());

  await page.getByRole("button", { name: "Session standard" }).click();
  await expect(page.getByTestId("session-action-protocol")).toBeVisible();
  await expect(page.getByTestId("session-action-dock")).toBeVisible();
  await expect(page.locator(".pageHeader")).toHaveCount(0);

  await page.getByRole("button", { name: "Réajuster" }).click();
  await expect(page.getByTestId("session-adjust-causes")).toBeVisible();
  await attachScreenshot(page, testInfo, "session-standard-adjust-sheet.png");
  await page.getByText("Moins de temps").click();
  await expect(page.getByTestId("session-adjust-options")).toBeVisible();
  await page.getByRole("button", { name: /Version courte/i }).click();

  await expect(page.getByTestId("session-adjustment-summary")).toBeVisible();
  await expect(page.getByText("Garde seulement le coeur utile de la séance.")).toBeVisible();
  await expect(page.getByTestId("session-guided-plan")).toHaveCount(0);
  await expect(page.getByText("18 min")).toBeVisible();

  await attachScreenshot(page, testInfo, "session-standard-adjusted-runtime.png");
});

test("guided adjust patches the runbook locally and keeps the runtime guided", async ({ page }, testInfo) => {
  await installSessionGuidanceMock(page);
  await openTimelineLaunch(page, buildLaunchState());

  await page.getByRole("button", { name: "Aller plus loin" }).click();
  await expect(page.getByTestId("session-guided-preview-actions")).toBeVisible();
  await page.getByRole("button", { name: "Démarrer" }).click();

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByTestId("session-action-dock")).toBeVisible();
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Régénérer" })).toHaveCount(0);
  await page.getByRole("button", { name: "Réajuster" }).click();
  await expect(page.getByTestId("session-adjust-causes")).toBeVisible();
  await attachScreenshot(page, testInfo, "session-guided-adjust-sheet.png");
  await page.getByText("Moins de temps").click();
  await expect(page.getByTestId("session-adjust-options")).toBeVisible();
  await page.getByRole("button", { name: /Raccourcir en gardant le coeur/i }).click();

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByTestId("session-adjustment-summary")).toBeVisible();
  await expect(page.getByText("Réduit la suite en conservant les segments qui comptent.")).toBeVisible();
  await expect(page.getByTestId("session-action-protocol")).toHaveCount(0);

  await attachScreenshot(page, testInfo, "session-guided-adjusted-runtime.png");
});
