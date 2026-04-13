import { test, expect, devices } from "@playwright/test";
import { buildBaseState, buildMockProfile, getUserData, seedState } from "./utils/seed.js";
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

test("guided launch shows preparing, spatial preview, and a compact guided runtime", async ({ page }, testInfo) => {
  await installSessionGuidanceMock(page);
  await openTimelineLaunch(page, buildLaunchState());

  await expect(page.getByTestId("session-launch-ready")).toBeVisible();
  await page.getByRole("button", { name: "Aller plus loin" }).click();

  await expect(page.getByTestId("session-launch-preparing")).toBeVisible();
  await expect(page.getByText("Préparation en cours")).toBeVisible();
  await expect(page.locator(".lovableTabBarWrap")).toHaveCount(0);
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "session-launch-preparing.png");

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByTestId("session-guided-preview-actions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Régénérer" })).toBeVisible();
  await expect(page.getByText("Plan du bloc")).toBeVisible();
  await expect(page.getByText("Mise en route")).toBeVisible();
  await expect(page.locator(".lovableTabBarWrap")).toHaveCount(0);
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "session-guided-preview.png");

  await page.getByRole("button", { name: "Revenir au standard" }).click();
  await expect(page.getByTestId("session-guided-preview-actions")).toHaveCount(0);
  await expect(page.getByTestId("session-guided-plan")).toHaveCount(0);

  await openTimelineLaunch(page, buildLaunchState());
  await expect(page.getByTestId("session-launch-ready")).toBeVisible();
  await page.getByRole("button", { name: "Aller plus loin" }).click();
  await expect(page.getByTestId("session-guided-preview-actions")).toBeVisible();

  await page.getByRole("button", { name: "Démarrer" }).click();

  await expect(page.getByTestId("session-guided-plan")).toBeVisible();
  await expect(page.getByTestId("session-action-protocol")).toHaveCount(0);
  await expect(page.getByTestId("session-action-dock")).toBeVisible();
  await expect(page.locator(".pageHeader")).toHaveCount(0);
  await expect(page.getByText("Plan du bloc")).toBeVisible();
  await expect(page.locator(".sessionRuntimeProgressLabel")).toHaveText("Étape 1/3");
  await expect(page.getByRole("button", { name: "Réajuster" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Outils" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Régénérer" })).toHaveCount(0);

  const persisted = await getUserData(page, E2E_USER_ID);
  expect(persisted?.ui?.activeSession?.occurrenceId ?? null).toBe("occ_launch");
  expect(persisted?.ui?.activeSession?.guidedRuntimeV1?.sessionRunbook?.version ?? null).toBe(2);

  await attachScreenshot(page, testInfo, "session-guided-plan-runtime.png");
});

test("premium guided prepare shows an explicit degraded state and retry can recover", async ({ page }, testInfo) => {
  let prepareAttempts = 0;
  await page.addInitScript(() => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = {
      ...(globalThis.process.env || {}),
      VITE_AI_BACKEND_URL: globalThis.location.origin,
    };
  });
  await page.route("**/ai/session-guidance", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.mode !== "prepare") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "SESSION_GUIDANCE_BACKEND_UNAVAILABLE",
          requestId: `req-session-guidance-${body.mode || "unknown"}`,
        }),
      });
      return;
    }

    prepareAttempts += 1;
    if (prepareAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "SESSION_GUIDANCE_BACKEND_UNAVAILABLE",
          requestId: "req-session-guidance-prepare-1",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "session_guidance",
        mode: "prepare",
        payload: {
          preparedRunbook: {
            version: 2,
            protocolType: "sport",
            occurrenceId: body.occurrenceId || "occ_launch",
            actionId: body.actionId || "goal_sport",
            dateKey: body.dateKey,
            title: body.actionTitle || "Séance guidée premium",
            categoryName: body.categoryName || "Sport",
            objective: {
              why: "tenir un bloc cardio-force net",
              successDefinition: "le circuit est tenu sans casser la forme",
            },
            steps: [
              {
                label: "Mise en route",
                purpose: "préparer les appuis",
                successCue: "souffle posé",
                items: [
                  {
                    kind: "warmup",
                    label: "Montées de genoux",
                    minutes: 3,
                    guidance: "alterne 30 sec dynamiques puis 30 sec plus calmes pour monter en température",
                    successCue: "respiration stable",
                  },
                  {
                    kind: "activation",
                    label: "Squats au poids du corps",
                    minutes: 2,
                    guidance: "2 séries de 12 reps en gardant le buste haut",
                    successCue: "genoux stables",
                  },
                ],
              },
              {
                label: "Bloc force",
                purpose: "tenir le coeur utile",
                successCue: "gainage propre",
                items: [
                  {
                    kind: "effort",
                    label: "Fentes alternées",
                    minutes: 4,
                    guidance: "2 séries de 10 reps par jambe sans te précipiter",
                    successCue: "appuis nets",
                    restSec: 25,
                  },
                  {
                    kind: "effort",
                    label: "Planche avant",
                    minutes: 4,
                    guidance: "3 passages de 40 sec avec 20 sec de repos entre les passages",
                    successCue: "bassin aligné",
                    restSec: 20,
                  },
                  {
                    kind: "effort",
                    label: "Pont fessier",
                    minutes: 3,
                    guidance: "2 séries de 15 reps avec montée contrôlée et pause d’une seconde en haut",
                    successCue: "fessiers engagés",
                    restSec: 20,
                  },
                ],
              },
              {
                label: "Retour au calme",
                purpose: "faire redescendre proprement",
                successCue: "souffle revenu",
                items: [
                  {
                    kind: "cooldown",
                    label: "Marche lente",
                    minutes: 2,
                    guidance: "marche en récupérant le souffle avant de t’arrêter",
                    successCue: "fréquence calmée",
                  },
                  {
                    kind: "breath",
                    label: "Étirements hanches et mollets",
                    minutes: 2,
                    guidance: "tiens 30 sec par côté sans forcer",
                    successCue: "tension relâchée",
                  },
                ],
              },
            ],
          },
          toolPlan: null,
          quality: {
            isPremiumReady: true,
            validationPassed: true,
            richnessPassed: true,
            reason: null,
          },
        },
        meta: {
          coachVersion: "v1",
          requestId: "req-session-guidance-prepare-2",
          aiIntent: "session_prepare",
          quotaRemaining: 5,
          source: "ai_premium",
        },
      }),
    });
  });

  await openTimelineLaunch(page, buildLaunchState());

  await page.getByRole("button", { name: "Aller plus loin" }).click();
  await expect(page.getByTestId("session-launch-degraded")).toBeVisible();
  await expect(page.getByText("Réessaye ou passe en standard.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Passer en standard" })).toBeVisible();

  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByTestId("session-guided-preview-actions")).toBeVisible();
  await expect(page.getByText("Mise en route")).toBeVisible();

  await attachScreenshot(page, testInfo, "session-guided-degraded-then-retry.png");
});

test("occurrences without blueprint bypass Séance prête and keep the current session behavior", async ({ page }, testInfo) => {
  await openTimelineLaunch(page, buildLaunchState({ withBlueprint: false }));

  await expect(page.getByTestId("session-launch-ready")).toHaveCount(0);
  await expect(page.getByTestId("session-action-protocol")).toBeVisible();
  await expect(page.getByTestId("session-guided-plan")).toHaveCount(0);

  await attachScreenshot(page, testInfo, "session-no-blueprint-bypass.png");
});
