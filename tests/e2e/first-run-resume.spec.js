import { test, expect } from "@playwright/test";
import { buildMockAuthSession, buildMockProfile, seedAuthSession, seedProfile } from "./utils/seed.js";

function buildFirstRunPlanResponse() {
  return {
    version: 2,
    source: "ai_backend",
    inputHash: "e2e-first-run-hash",
    generatedAt: "2026-04-19T08:00:00.000Z",
    requestId: "req-e2e-first-run",
    model: "gpt-5.4",
    promptVersion: "first_run_plan_v1",
    plans: [
      {
        id: "tenable",
        variant: "tenable",
        title: "Plan tenable",
        summary: "Une première semaine crédible et respirable.",
        comparisonMetrics: {
          weeklyMinutes: 150,
          totalBlocks: 5,
          activeDays: 4,
          recoverySlots: 3,
          dailyDensity: "respirable",
          engagementLevel: "tenable",
        },
        categories: [
          { id: "cat_business", label: "Business", role: "primary", blockCount: 3 },
          { id: "cat_health", label: "Santé", role: "support", blockCount: 2 },
        ],
        preview: [
          {
            dayKey: "2026-04-19",
            dayLabel: "DIM 19/04",
            slotLabel: "08:00 - 08:25",
            categoryId: "cat_business",
            categoryLabel: "Business",
            title: "Bloc roadmap",
            minutes: 25,
          },
        ],
        todayPreview: [
          {
            dayKey: "2026-04-19",
            dayLabel: "DIM 19/04",
            slotLabel: "08:00 - 08:25",
            categoryId: "cat_business",
            categoryLabel: "Business",
            title: "Bloc roadmap",
            minutes: 25,
          },
        ],
        rationale: {
          whyFit: "Le plan protège l'élan.",
          capacityFit: "La charge reste respirable.",
          constraintFit: "Les contraintes sont respectées.",
        },
        commitDraft: {
          version: 1,
          categories: [
            { id: "cat_business", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 },
            { id: "cat_health", templateId: "health", name: "Santé", color: "#22c55e", order: 1 },
          ],
          goals: [{ id: "goal_business", categoryId: "cat_business", title: "Relancer le projet", type: "OUTCOME", order: 0 }],
          actions: [
            {
              id: "action_roadmap",
              categoryId: "cat_business",
              parentGoalId: "goal_business",
              title: "Bloc roadmap",
              type: "PROCESS",
              order: 0,
              repeat: "weekly",
              daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
              timeMode: "FIXED",
              startTime: "08:00",
              timeSlots: ["08:00"],
              durationMinutes: 25,
              sessionMinutes: 25,
            },
          ],
          occurrences: [{ id: "occ_t_1", goalId: "action_roadmap", date: "2026-04-19", start: "08:00", durationMinutes: 25, status: "planned" }],
        },
      },
      {
        id: "ambitious",
        variant: "ambitious",
        title: "Plan ambitieux",
        summary: "Une version plus dense pour accélérer.",
        comparisonMetrics: {
          weeklyMinutes: 225,
          totalBlocks: 7,
          activeDays: 5,
          recoverySlots: 2,
          dailyDensity: "soutenue",
          engagementLevel: "ambitious",
        },
        categories: [
          { id: "cat_business", label: "Business", role: "primary", blockCount: 4 },
          { id: "cat_health", label: "Santé", role: "support", blockCount: 3 },
        ],
        preview: [
          {
            dayKey: "2026-04-19",
            dayLabel: "DIM 19/04",
            slotLabel: "07:30 - 08:15",
            categoryId: "cat_business",
            categoryLabel: "Business",
            title: "Bloc roadmap",
            minutes: 45,
          },
        ],
        todayPreview: [
          {
            dayKey: "2026-04-19",
            dayLabel: "DIM 19/04",
            slotLabel: "07:30 - 08:15",
            categoryId: "cat_business",
            categoryLabel: "Business",
            title: "Bloc roadmap",
            minutes: 45,
          },
        ],
        rationale: {
          whyFit: "Le plan accélère dès la première semaine.",
          capacityFit: "La charge monte d'un cran.",
          constraintFit: "Les créneaux favorables sont exploités.",
        },
        commitDraft: {
          version: 1,
          categories: [
            { id: "cat_business", templateId: "business", name: "Business", color: "#0ea5e9", order: 0 },
            { id: "cat_health", templateId: "health", name: "Santé", color: "#22c55e", order: 1 },
          ],
          goals: [{ id: "goal_business", categoryId: "cat_business", title: "Relancer le projet", type: "OUTCOME", order: 0 }],
          actions: [
            {
              id: "action_roadmap",
              categoryId: "cat_business",
              parentGoalId: "goal_business",
              title: "Bloc roadmap",
              type: "PROCESS",
              order: 0,
              repeat: "weekly",
              daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
              timeMode: "FIXED",
              startTime: "07:30",
              timeSlots: ["07:30"],
              durationMinutes: 45,
              sessionMinutes: 45,
            },
          ],
          occurrences: [{ id: "occ_a_1", goalId: "action_roadmap", date: "2026-04-19", start: "07:30", durationMinutes: 45, status: "planned" }],
        },
      },
    ],
  };
}

async function installFirstRunPlanMock(page, { delayMs = 0, failOnce = false, onCall = null } = {}) {
  await page.addInitScript(() => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = {
      ...(globalThis.process.env || {}),
      VITE_AI_BACKEND_URL: globalThis.location.origin,
    };
  });

  let shouldFail = failOnce;
  await page.route("**/ai/first-run-plan", async (route) => {
    if (typeof onCall === "function") onCall();
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    if (shouldFail) {
      shouldFail = false;
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({
          error: "FIRST_RUN_PLAN_PROVIDER_TIMEOUT",
          requestId: "req-e2e-timeout",
          message: "First run plan provider timed out.",
          details: { providerStatus: "timeout", timeoutMs: 45000 },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildFirstRunPlanResponse()),
    });
  });
}

async function readPersistedUiState(page, userId = "e2e-user-id") {
  return page.evaluate((id) => {
    const raw = localStorage.getItem(`e2e.supabase.user_data.${id}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.ui || null;
  }, userId);
}

async function bootFirstRunUser(page, userId = "e2e-user-id") {
  const authSession = buildMockAuthSession({ userId, verified: true });
  await seedAuthSession(page, authSession);
  await seedProfile(page, userId, buildMockProfile({ userId, username: "firstrunuser" }));
  await page.goto("/");
  await expect(page.getByTestId("first-run-screen-intro")).toBeVisible();
}

test("reprend exactement sur why apres refresh", async ({ page }) => {
  await bootFirstRunUser(page);
  await page.getByRole("button", { name: "Commencer" }).click();

  const whyInput = page.getByTestId("first-run-why-input");
  await expect(page.getByTestId("first-run-screen-why")).toBeVisible();
  await whyInput.fill("Retrouver une semaine maitrisable.");

  await page.reload();

  await expect(page.getByTestId("first-run-screen-why")).toBeVisible();
  await expect(page.getByTestId("first-run-why-input")).toHaveValue("Retrouver une semaine maitrisable.");
});

test("reprend exactement sur signals apres refresh", async ({ page }) => {
  await bootFirstRunUser(page);
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByTestId("first-run-why-input").fill("Je veux remettre mon projet en route.");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByTestId("first-run-screen-signals")).toBeVisible();
  await page.getByTestId("first-run-primary-goal-input").fill("Relancer la roadmap");

  await page.reload();

  await expect(page.getByTestId("first-run-screen-signals")).toBeVisible();
  await expect(page.getByTestId("first-run-primary-goal-input")).toHaveValue("Relancer la roadmap");
});

test("ne force pas onboardingCompleted trop tot et passe a done uniquement a la fin", async ({ page }) => {
  await installFirstRunPlanMock(page, { delayMs: 120 });
  await bootFirstRunUser(page);
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByTestId("first-run-why-input").fill("Je veux reprendre le controle.");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByTestId("first-run-screen-signals")).toBeVisible();
  await page.getByTestId("first-run-primary-goal-input").fill("Relancer mon projet principal");
  await page.getByText("Stable").click();
  await page.getByText("Business").click();
  await page.getByRole("button", { name: "Générer les plans" }).click();

  await expect(page.getByTestId("first-run-screen-generate")).toBeVisible();
  let persistedUi = await readPersistedUiState(page);
  expect(persistedUi?.onboardingCompleted).toBe(false);
  expect(persistedUi?.firstRunV1?.status).toBe("generate");

  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible();
  await page.getByText("Plan tenable").first().click();
  await page.getByRole("button", { name: "Continuer avec ce plan" }).click();

  await expect(page.getByTestId("first-run-screen-commit")).toBeVisible();
  persistedUi = await readPersistedUiState(page);
  expect(persistedUi?.onboardingCompleted).toBe(false);
  expect(persistedUi?.firstRunV1?.status).toBe("commit");

  await page.getByRole("button", { name: "Valider ce choix" }).click();
  await expect(page.getByTestId("first-run-screen-discovery")).toBeVisible();
  await page.getByRole("button", { name: "Entrer dans l'app" }).click();

  await expect(page.locator("[data-tour-id=\"topnav-tabs\"]")).toBeVisible();
  persistedUi = await readPersistedUiState(page);
  expect(persistedUi?.onboardingCompleted).toBe(true);
  expect(persistedUi?.firstRunV1?.status).toBe("done");
  expect(persistedUi?.firstRunV1?.discoveryDone).toBe(true);
});

test("ne regenere pas apres refresh quand le hash d'entree n'a pas change", async ({ page }) => {
  let callCount = 0;
  await installFirstRunPlanMock(page, {
    onCall: () => {
      callCount += 1;
    },
  });
  await bootFirstRunUser(page);
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByTestId("first-run-why-input").fill("Je veux reprendre le controle.");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByTestId("first-run-primary-goal-input").fill("Relancer mon projet principal");
  await page.getByText("Stable").click();
  await page.getByText("Business").click();
  await page.getByRole("button", { name: "Générer les plans" }).click();

  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible();
  expect(callCount).toBe(1);

  await page.reload();

  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible();
  expect(callCount).toBe(1);
});

test("affiche un etat d'erreur propre puis relance la generation", async ({ page }) => {
  let callCount = 0;
  await installFirstRunPlanMock(page, {
    failOnce: true,
    onCall: () => {
      callCount += 1;
    },
  });
  await bootFirstRunUser(page);
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByTestId("first-run-why-input").fill("Je veux reprendre le controle.");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByTestId("first-run-primary-goal-input").fill("Relancer mon projet principal");
  await page.getByText("Stable").click();
  await page.getByText("Business").click();
  await page.getByRole("button", { name: "Générer les plans" }).click();

  await expect(page.getByTestId("first-run-screen-generate")).toBeVisible();
  await expect(page.getByText("La génération a pris trop de temps. Réessaie.")).toBeVisible();
  expect(callCount).toBe(1);

  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible();
  expect(callCount).toBe(2);
});
