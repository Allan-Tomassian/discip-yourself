import { test, expect } from "@playwright/test";
import { buildMockAuthSession, buildMockProfile, seedAuthSession, seedProfile } from "./utils/seed.js";

function buildFirstRunStarterHintsResponse() {
  return {
    version: 1,
    source: "ai_starter_hints",
    inputHash: "e2e-first-run-starter-hints-hash",
    generatedAt: "2026-04-19T08:00:00.000Z",
    planStrategy: {
      planTitle: "Plan recommandé",
      summary: "Relancer le projet principal avec une charge réaliste.",
      weekGoal: "Créer une preuve d’exécution sur le projet principal.",
      weekBenefit: "Le système démarre avec un premier bloc activable aujourd’hui.",
      reasoningBullets: ["Le plan reste concentré sur le projet.", "La cadence respecte une capacité stable."],
    },
    actionHints: [
      {
        id: "project-main-block",
        categoryId: "business",
        title: "Relancer le projet principal",
        purpose: "Créer une avancée concrète sur le projet.",
        outcomeLink: "Relancer mon projet principal",
        suggestedDurationMinutes: 30,
        cadence: "3x",
        priority: 5,
        preferredWindowTag: "morning",
        avoidWindowTags: ["work"],
        todayCandidate: true,
      },
    ],
    riskRituals: [],
    ai: {
      status: "succeeded",
      missingInformation: [],
    },
  };
}

async function installFirstRunStarterHintsMock(page, { delayMs = 0, fail = false, onCall = null } = {}) {
  await page.addInitScript(() => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = {
      ...(globalThis.process.env || {}),
      VITE_AI_BACKEND_URL: globalThis.location.origin,
    };
  });

  await page.route("**/ai/first-run-starter-hints", async (route) => {
    if (typeof onCall === "function") onCall();
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    if (fail) {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({
          error: "FIRST_RUN_STARTER_HINTS_PROVIDER_TIMEOUT",
          requestId: "req-e2e-starter-timeout",
          message: "First run starter hints provider timed out.",
          details: { providerStatus: "timeout", timeoutMs: 8000 },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildFirstRunStarterHintsResponse()),
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
  await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
  await whyInput.fill("Retrouver une semaine maitrisable.");
  await expect(page.getByRole("button", { name: "Continuer" })).toBeEnabled();

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
  await installFirstRunStarterHintsMock(page, { fail: true });
  await bootFirstRunUser(page);
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByTestId("first-run-why-input").fill("Je veux reprendre le controle.");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page.getByTestId("first-run-screen-signals")).toBeVisible();
  await page.getByTestId("first-run-primary-goal-input").fill("Relancer mon projet principal");
  await page.getByText("Stable").click();
  await page.getByText("Business").click();
  await page.getByRole("button", { name: "Générer les plans" }).click();

  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText("Ton plan recommandé est prêt.")).toBeVisible();
  let persistedUi = await readPersistedUiState(page);
  expect(persistedUi?.onboardingCompleted).toBe(false);
  expect(persistedUi?.firstRunV1?.status).toBe("compare");
  expect(persistedUi?.firstRunV1?.generatedPlans?.version).toBe(3);
  expect(persistedUi?.firstRunV1?.selectedPlanId).toBe("recommended");
  await page.getByRole("button", { name: "Activer ce plan" }).click();

  await expect(page.getByTestId("first-run-screen-commit")).toBeVisible();
  persistedUi = await readPersistedUiState(page);
  expect(persistedUi?.onboardingCompleted).toBe(false);
  expect(persistedUi?.firstRunV1?.status).toBe("commit");

  await page.getByRole("button", { name: "Activer mon plan" }).click();
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
  await installFirstRunStarterHintsMock(page, {
    fail: true,
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

  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible({ timeout: 12_000 });
  const persistedBeforeReload = await readPersistedUiState(page);
  const inputHashBeforeReload = persistedBeforeReload?.firstRunV1?.inputHash;
  const generatedAtBeforeReload = persistedBeforeReload?.firstRunV1?.generatedPlans?.generatedAt;
  const callCountBeforeReload = callCount;
  expect(persistedBeforeReload?.firstRunV1?.status).toBe("compare");
  expect(persistedBeforeReload?.firstRunV1?.generatedPlans?.source).toBe("deterministic_starter");
  expect(persistedBeforeReload?.firstRunV1?.selectedPlanId).toBe("recommended");
  expect(inputHashBeforeReload).toBeTruthy();

  await page.reload();

  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible();
  const persistedAfterReload = await readPersistedUiState(page);
  expect(persistedAfterReload?.firstRunV1?.inputHash).toBe(inputHashBeforeReload);
  expect(persistedAfterReload?.firstRunV1?.generatedPlans?.generatedAt).toBe(generatedAtBeforeReload);
  expect(callCount).toBe(callCountBeforeReload);
  expect(callCount).toBe(1);
});

test("affiche le plan recommande apres l'attente IA bornee", async ({ page }) => {
  let callCount = 0;
  await installFirstRunStarterHintsMock(page, {
    delayMs: 10_000,
    fail: true,
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

  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText("Ton plan recommandé est prêt.")).toBeVisible();
  const persistedUi = await readPersistedUiState(page);
  expect(persistedUi?.firstRunV1?.generatedPlans?.version).toBe(3);
  expect(persistedUi?.firstRunV1?.generatedPlans?.source).toBe("deterministic_starter");
  expect(callCount).toBe(1);
});

test("affiche un plan assiste IA quand starter hints repond dans la fenetre bornee", async ({ page }) => {
  await installFirstRunStarterHintsMock(page);
  await bootFirstRunUser(page);
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByTestId("first-run-why-input").fill("Je veux reprendre le controle.");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByTestId("first-run-primary-goal-input").fill("Relancer mon projet principal");
  await page.getByText("Stable").click();
  await page.getByText("Business").click();
  await page.getByRole("button", { name: "Générer les plans" }).click();

  await expect(page.getByTestId("first-run-screen-compare")).toBeVisible({ timeout: 12_000 });
  await expect(page.getByTestId("first-run-v3-source-label")).toContainText("Affiné par l’IA à partir de tes signaux.");
  const persistedUi = await readPersistedUiState(page);
  expect(persistedUi?.firstRunV1?.generatedPlans?.version).toBe(3);
  expect(persistedUi?.firstRunV1?.generatedPlans?.source).toBe("ai_assisted_starter");
  expect(persistedUi?.firstRunV1?.selectedPlanId).toBe("recommended");
});
