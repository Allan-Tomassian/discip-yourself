import { test, expect, devices } from "@playwright/test";
import { E2E_AUTH_SESSION_KEY } from "../../src/auth/constants.js";
import { buildLocalUserDataKey } from "../../src/data/userDataApi.js";
import { buildLocalProfileKey, LOCAL_PROFILE_USERNAME_MAP_KEY } from "../../src/profile/profileApi.js";
import { LS_KEY } from "../../src/utils/storage.js";
import { buildBaseState, buildMockAuthSession, buildMockProfile, seedState } from "./utils/seed.js";
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
    estimatedMinutes: 25,
    conversationId: "conv_guided_spatial",
    ...overrides,
  };
}

function buildState({
  protocolType = "sport",
  title = "Séance de sport légère de 25 minutes",
  categoryId = "cat_sport",
  categoryName = "Sport",
  durationMinutes = 25,
} = {}) {
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
      id: "goal_guided_spatial",
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
      sessionMinutes: durationMinutes,
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
        estimatedMinutes: durationMinutes,
      }),
    },
  ];
  state.habits = [];
  state.occurrences = [
    {
      id: "occ_guided_spatial",
      goalId: "goal_guided_spatial",
      date: today,
      start: "19:00",
      slotKey: "19:00",
      durationMinutes,
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

async function seedAppOnce(page, state) {
  const authSession = buildMockAuthSession({ userId: E2E_USER_ID });
  const profile = buildMockProfile({
    userId: E2E_USER_ID,
    username: "allan",
    fullName: "Allan",
  });

  await page.goto("/");
  await page.evaluate(
    ({
      stateValue,
      authKey,
      authSessionValue,
      lsKey,
      userDataKey,
      profileKey,
      profileValue,
      usernamesKey,
      username,
      userId,
    }) => {
      localStorage.setItem(lsKey, JSON.stringify(stateValue));
      localStorage.setItem(authKey, JSON.stringify(authSessionValue));
      localStorage.setItem(userDataKey, JSON.stringify(stateValue));
      localStorage.setItem(profileKey, JSON.stringify(profileValue));
      const currentMap = JSON.parse(localStorage.getItem(usernamesKey) || "{}");
      currentMap[username] = userId;
      localStorage.setItem(usernamesKey, JSON.stringify(currentMap));
    },
    {
      stateValue: state,
      authKey: E2E_AUTH_SESSION_KEY,
      authSessionValue: authSession,
      lsKey: LS_KEY,
      userDataKey: buildLocalUserDataKey(E2E_USER_ID),
      profileKey: buildLocalProfileKey(E2E_USER_ID),
      profileValue: profile,
      usernamesKey: LOCAL_PROFILE_USERNAME_MAP_KEY,
      username: profile.username,
      userId: E2E_USER_ID,
    }
  );
  await page.reload();
}

function buildCoachFreeReply({ dateKey = "2026-04-11", categoryId = "cat_sport" } = {}) {
  return {
    kind: "conversation",
    mode: "free",
    decisionSource: "rules",
    message: "Reprends l’étape active, puis ferme un seul prochain item concret.",
    primaryAction: null,
    secondaryAction: null,
    proposal: null,
    meta: {
      coachVersion: "v1",
      requestId: "req_guided_to_coach",
      selectedDateKey: dateKey,
      activeCategoryId: categoryId,
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Aide-moi à reprendre proprement.",
    },
  };
}

function buildCoachPlanReply({ dateKey = "2026-04-11", categoryId = "cat_sport" } = {}) {
  return {
    kind: "conversation",
    mode: "plan",
    decisionSource: "rules",
    message: "Je te propose un plan concret pour aujourd'hui.",
    primaryAction: null,
    secondaryAction: null,
    proposal: {
      kind: "assistant",
      categoryDraft: {
        mode: "existing",
        id: categoryId,
        label: categoryId === "cat_sport" ? "Sport" : "Business",
      },
      outcomeDraft: {
        title: "Relancer proprement la séance guidée",
      },
      actionDrafts: [
        {
          title: "Reprendre l'étape active",
          oneOffDate: dateKey,
          startTime: "19:00",
        },
        {
          title: "Fermer le prochain item utile",
          oneOffDate: dateKey,
          startTime: "19:15",
        },
      ],
      unresolvedQuestions: [],
      requiresValidation: true,
    },
    meta: {
      coachVersion: "v1",
      requestId: "req_guided_to_coach_plan",
      selectedDateKey: dateKey,
      activeCategoryId: categoryId,
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Aide-moi à structurer ce que je veux faire avancer.",
    },
  };
}

async function installCoachReply(page, responseBody) {
  await page.addInitScript(() => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = {
      ...(globalThis.process.env || {}),
      VITE_AI_BACKEND_URL: globalThis.location.origin,
    };
  });

  await page.route("**/ai/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseBody),
    });
  });
}

async function openGuidedPreview(page, state) {
  await installSessionGuidanceMock(page);
  await seedApp(page, state);
  await page.goto("/");
  await page.getByRole("button", { name: "Planning" }).click();
  await page.locator(".lovableTimelineCardButton").first().click();
  await page.getByRole("button", { name: /Démarrer la session|Reprendre la session/i }).click();
  await page.getByRole("button", { name: "Aller plus loin" }).click();
  await expect(page.getByTestId("session-launch-preparing")).toBeVisible();
  await expect(page.getByTestId("session-guided-preview-actions")).toBeVisible();
}

async function openGuidedActive(page, state) {
  await openGuidedPreview(page, state);
  await page.getByRole("button", { name: "Démarrer" }).click();
  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();
  await expect(page.getByTestId("session-guided-preview-actions")).toHaveCount(0);
}

async function openGuidedActiveWithOneShotSeed(page, state) {
  await installSessionGuidanceMock(page);
  await seedAppOnce(page, state);
  await page.getByRole("button", { name: "Planning" }).click();
  await page.locator(".lovableTimelineCardButton").first().click();
  await page.getByRole("button", { name: /Démarrer la session|Reprendre la session/i }).click();
  await page.getByRole("button", { name: "Aller plus loin" }).click();
  await expect(page.getByTestId("session-guided-preview-actions")).toBeVisible();
  await page.getByRole("button", { name: "Démarrer" }).click();
  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();
}

test("guided preview opens directly after preparing and can return to standard", async ({ page }, testInfo) => {
  await openGuidedPreview(page, buildState());

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Démarrer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Régénérer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Outils" })).toHaveCount(0);
  await attachScreenshot(page, testInfo, "session-guided-spatial-preview.png");

  await page.getByRole("button", { name: "Revenir au standard" }).click();
  await expect(page.getByTestId("session-guided-preview-actions")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Régénérer" })).toHaveCount(0);
});

test("active guided keeps the spatial deck visible without surfacing recenter chrome by default", async ({ page }, testInfo) => {
  await openGuidedActive(page, buildState());

  await expect(page.getByTestId("session-guided-active-step-notice")).toHaveCount(0);
  await expect(page.locator(".sessionRuntimeProgressLabel")).toHaveText("Étape 1/3");
  await expect(page.getByTestId("session-guided-slide-track")).toBeVisible();
  await expect(page.getByTestId("session-guided-slide-viewed")).toContainText("Étape 1/3");
  await attachScreenshot(page, testInfo, "session-guided-spatial-consulted.png");
});

test("deep work guided uses checklist-style execution without changing the global timer model", async ({ page }, testInfo) => {
  await openGuidedActive(
    page,
    buildState({
      protocolType: "deep_work",
      title: "Structurer la note produit",
      categoryId: "cat_work",
      categoryName: "Travail",
      durationMinutes: 30,
    })
  );

  const firstChecklistRow = page.locator(".sessionGuidedChecklistRow").first();
  await expect(firstChecklistRow).toBeVisible();
  await firstChecklistRow.click();
  await page.getByRole("button", { name: "Étape terminée" }).click();
  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();
  await attachScreenshot(page, testInfo, "session-guided-spatial-checklist.png");
});

test("guided active survives an app-level route leave and reopening without falling back to standard", async ({ page }) => {
  const state = buildState();
  await openGuidedActive(page, state);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/timeline");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/timeline/);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/session/occ_guided_spatial");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();
  await expect(page.getByTestId("session-action-protocol")).toHaveCount(0);
  await expect(page.getByTestId("session-guided-preview-actions")).toHaveCount(0);
});

test("guided active survives close and reopening from the timeline entry", async ({ page }) => {
  const state = buildState();
  await openGuidedActive(page, state);

  await page.getByLabel("Retour").click();
  await expect(page).toHaveURL(/\/timeline/);
  await page.locator(".lovableTimelineCardButton").first().click();
  await page.getByRole("button", { name: /Démarrer la session|Reprendre la session/i }).click();

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();
  await expect(page.getByTestId("session-action-protocol")).toHaveCount(0);
});

test("guided active survives a full reload and stays guided on the same device", async ({ page }) => {
  const state = buildState();
  await openGuidedActiveWithOneShotSeed(page, state);

  await page.reload();

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();
  await expect(page.getByTestId("session-action-protocol")).toHaveCount(0);
  await expect(page.getByTestId("session-guided-preview-actions")).toHaveCount(0);
});

test("guided active can route back to coach without surfacing the unavailable fallback", async ({ page }) => {
  const state = buildState();
  await installCoachReply(
    page,
    buildCoachFreeReply({
      dateKey: state.ui.selectedDate,
      categoryId: state.ui.selectedCategoryId,
    })
  );
  await openGuidedActive(page, state);

  await page.evaluate(() => {
    window.history.pushState({}, "", "/coach");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByText("Ton copilote stratégique")).toBeVisible();
  await page.locator(".lovableCoachTextarea").fill("Aide-moi à reprendre proprement.");
  await page.evaluate(() => {
    document.querySelector(".lovableCoachComposerSend")?.click();
  });

  await expect(page.getByText("Coach indisponible.")).toHaveCount(0);
  await expect(page.getByText("Reprends l’étape active, puis ferme un seul prochain item concret.")).toBeVisible();
});

test("guided active can route back to coach plan mode without surfacing the unavailable fallback", async ({ page }) => {
  const state = buildState();
  await installCoachReply(
    page,
    buildCoachPlanReply({
      dateKey: state.ui.selectedDate,
      categoryId: state.ui.selectedCategoryId,
    })
  );
  await openGuidedActive(page, state);

  await page.evaluate(() => {
    window.history.pushState({}, "", "/coach");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByText("Ton copilote stratégique")).toBeVisible();
  await page.locator(".coachSurfaceComposerPlus").click();
  await page.getByRole("menuitem", { name: /Plan/i }).click();
  await expect(page.getByText("Plan actif")).toBeVisible();
  await page.evaluate(() => {
    document.querySelector(".lovableCoachComposerSend")?.click();
  });

  await expect(page.getByText("Coach indisponible.")).toHaveCount(0);
  await expect(page.getByText("Plan proposé")).toBeVisible();
});
