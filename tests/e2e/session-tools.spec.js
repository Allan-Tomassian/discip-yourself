import { test, expect, devices } from "@playwright/test";
import { buildBaseState, buildMockProfile, seedState } from "./utils/seed.js";

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
    estimatedMinutes: 30,
    conversationId: "conv_session_blueprint",
    ...overrides,
  };
}

function buildState({ protocolType = "sport", title = "Faire une marche rapide de 30 minutes", categoryId = "cat_sport", categoryName = "Sport" } = {}) {
  const state = buildBaseState({ withContent: true });
  const today = state.ui.selectedDate;

  state.categories = [
    { id: "sys_inbox", name: "Général", color: "#64748B", isSystem: true },
    { id: categoryId, name: categoryName, color: protocolType === "sport" ? "#22C55E" : "#0EA5E9" },
  ];
  state.ui.categoryRailOrder = [categoryId, "sys_inbox"];
  state.ui.selectedCategoryId = categoryId;
  state.ui.selectedCategoryByView = {
    home: categoryId,
    library: categoryId,
    plan: categoryId,
    pilotage: categoryId,
  };

  state.goals = [
    {
      id: "goal_guided",
      categoryId,
      title,
      type: "PROCESS",
      planType: "ONE_OFF",
      status: "active",
      oneOffDate: today,
      timeMode: "FIXED",
      startTime: "19:00",
      timeSlots: ["19:00"],
      reminderTime: "18:40",
      sessionMinutes: 30,
      sessionBlueprintV1: buildBlueprint({
        protocolType,
        why:
          protocolType === "deep_work"
            ? "sortir une structure claire et exploitable"
            : "activer ton énergie et tenir le rythme",
        firstStep:
          protocolType === "deep_work"
            ? "rouvre la zone utile et fixe le point d’entrée"
            : "commence par 3 min d’échauffement",
        ifBlocked:
          protocolType === "deep_work"
            ? "réduis à une première trame"
            : "fais la version courte",
        successDefinition:
          protocolType === "deep_work"
            ? "une base exploitable existe"
            : "séance tenue ou version courte assumée",
      }),
    },
  ];
  state.habits = [];
  state.occurrences = [
    {
      id: "occ_guided",
      goalId: "goal_guided",
      date: today,
      start: "19:00",
      slotKey: "19:00",
      durationMinutes: 30,
      status: "planned",
    },
  ];

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

async function openGuidedRuntime(page, state) {
  await seedApp(page, state);
  await page.goto("/");
  await page.getByRole("button", { name: "Planning" }).click();
  await page.locator(".lovableTimelineCardButton").first().click();
  await page.getByRole("button", { name: /Démarrer la session|Reprendre la session/i }).click();
  await page.getByRole("button", { name: "Aller plus loin" }).click();
  await expect(page.getByTestId("session-launch-plan-ready")).toBeVisible();
  await page.getByRole("button", { name: "Lancer la session" }).click();
  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
}

test("sport guided tools open a local active utility without changing the runbook", async ({ page }, testInfo) => {
  await openGuidedRuntime(page, buildState());

  await page.getByRole("button", { name: "Outils" }).click();
  await expect(page.getByTestId("session-tools-sheet")).toBeVisible();
  await expect(page.getByRole("button", { name: /Minuteur ciblé/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "session-tools-sheet-sport.png");

  await page.getByRole("button", { name: /Minuteur ciblé/i }).click();
  await expect(page.getByTestId("session-tool-tray")).toBeVisible();
  await expect(page.getByTestId("session-guided-plan")).toBeVisible();

  await attachScreenshot(page, testInfo, "session-tool-tray-sport.png");
});

test("deep work guided tools produce a reusable support artifact in a result sheet", async ({ page }, testInfo) => {
  await openGuidedRuntime(
    page,
    buildState({
      protocolType: "deep_work",
      title: "Structurer la note produit",
      categoryId: "cat_work",
      categoryName: "Travail",
    })
  );

  await page.getByRole("button", { name: "Outils" }).click();
  await expect(page.getByTestId("session-tools-sheet")).toBeVisible();
  await expect(page.getByRole("button", { name: /Checklist ciblée/i })).toBeVisible();

  await page.getByRole("button", { name: /Checklist ciblée/i }).click();
  await expect(page.getByTestId("session-tool-result")).toBeVisible();
  await expect(page.getByText("À faire maintenant")).toBeVisible();

  await attachScreenshot(page, testInfo, "session-tool-result-deep-work.png");
});

