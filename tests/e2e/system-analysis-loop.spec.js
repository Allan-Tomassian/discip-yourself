import { test, expect, devices } from "@playwright/test";
import { getState } from "./utils/seed.js";
import {
  addDaysKey,
  buildCanonicalExecutionState,
  buildEligibleSystemAnalysisState,
  E2E_USER_ID,
  seedCurrentUser,
} from "./utils/currentProduct.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

async function installSystemAnalysisMock(page) {
  await page.addInitScript(() => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = {
      ...(globalThis.process.env || {}),
      VITE_AI_BACKEND_URL: globalThis.location.origin,
    };
  });

  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/ai/system-analysis", async (route) => {
    const request = route.request().postDataJSON();
    const period = request.snapshot.period;
    const referenceDateKey = request.referenceDateKey || period.endDateKey;
    const tomorrow = addDaysKey(referenceDateKey, 1);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        period,
        executiveSummary: "Ton système avance, mais le bloc principal gagne à être raccourci.",
        invisibleFriction: [
          {
            title: "Créneau trop exposé",
            evidenceIds: ["occ_today"],
            message: "Le matin concentre déjà trop d’effort.",
          },
        ],
        systemWeaknesses: [
          {
            title: "Charge concentrée",
            evidenceIds: ["occ_today"],
            message: "Un bloc plus tardif protège mieux l’exécution.",
          },
        ],
        strongestPatterns: [
          {
            title: "Les blocs courts tiennent mieux",
            evidenceIds: ["hist_done_1"],
            message: "Les sessions courtes sont les plus stables.",
          },
        ],
        recommendedCorrections: [
          {
            title: "Réduire le bloc client à 20 minutes",
            evidenceIds: ["occ_today"],
            reason: "Réduit la friction sans supprimer l’action.",
          },
        ],
        correctionDraft: {
          correctedLoad: {
            targetBlocksPerDay: 2,
            maxDailyMinutes: 70,
            reason: "Garder une charge réaliste.",
          },
          occurrenceAdjustments: [
            {
              occurrenceId: "occ_today",
              action: "reduce_duration",
              proposedDurationMinutes: 20,
              reason: "Créneau plus stable pour ce bloc.",
              expectedImpact: "Moins de friction sur le bloc principal.",
              confidence: 0.82,
            },
          ],
          objectiveAdjustments: [
            {
              goalId: "goal_outcome",
              action: "protect",
              reason: "Objectif moteur à conserver.",
            },
          ],
          actionAdjustments: [],
          next7DaysPlan: [
            {
              dateKey: tomorrow,
              focus: "Reprendre le bloc client en version courte.",
              blocks: [],
              totalMinutes: 25,
              riskLevel: "low",
            },
          ],
          validationRequirements: ["user_confirmation"],
          userConfirmationRequired: true,
        },
        next7DaysFocus: [
          {
            dateKey: tomorrow,
            focus: "Reprendre le bloc client en version courte.",
          },
        ],
        coachQuestions: ["Quel créneau est vraiment protégé ?"],
        confidence: 0.76,
        dataLimitations: ["Analyse locale limitée aux données déjà synchronisées."],
        safetyNotes: ["Aucune correction n’a été appliquée automatiquement."],
        generatedAt: "2026-05-20T12:00:00.000Z",
        modelMeta: {
          model: "mock-system-analysis",
          promptVersion: "e2e",
          requestId: "req-system-analysis-e2e",
        },
      }),
    });
  });
}

test("System Analysis: preview, review, final apply and local history metadata", async ({ page }) => {
  await installSystemAnalysisMock(page);
  const state = buildEligibleSystemAnalysisState();
  const today = state.ui.selectedDate;
  await seedCurrentUser(page, state, {
    appMetadata: { plan_tier: "premium" },
  });

  await page.goto("/adjust");
  await expect(page.getByRole("button", { name: /Analyser le système/i })).toBeVisible();
  await page.getByRole("button", { name: /Analyser le système/i }).click();

  await expect(page.getByRole("dialog").getByText("Analyse système", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Ce que l’analyse va lire")).toBeVisible();
  await page.getByRole("button", { name: "Lancer l’analyse" }).click();
  await expect(page.getByText("Analyse du système en cours…")).toBeVisible();
  await expect(page.getByText("Corrections proposées")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Rien n’est appliqué sans validation finale.").first()).toBeVisible();

  const beforeReview = await getState(page);
  expect(beforeReview.occurrences.find((occ) => occ.id === "occ_today")?.date).toBe(today);

  await expect(page.getByText("Réduire la durée")).toBeVisible();
  await expect(page.getByText("Réduire à 20 min.")).toBeVisible();
  await expect(page.getByText("Objectif moteur à conserver.")).toBeVisible();
  await page.getByRole("button", { name: "Sélectionner" }).first().click();

  const beforeApply = await getState(page);
  expect(beforeApply.occurrences.find((occ) => occ.id === "occ_today")?.date).toBe(today);

  await page.getByRole("button", { name: "Préparer la validation" }).click();
  await expect(page.getByText("Validation finale")).toBeVisible();
  await expect(page.getByText("Ces corrections vont modifier ton planning. Tu gardes le contrôle.")).toBeVisible();
  await expect(page.getByText("Aucune correction n’a encore été appliquée.")).toBeVisible();
  await page.getByRole("button", { name: "Appliquer les corrections" }).click();

  await expect(page.getByText("Corrections appliquées")).toBeVisible();
  const afterApply = await getState(page);
  const source = afterApply.occurrences.find((occ) => occ.id === "occ_today");
  expect(source?.status).toBe("planned");
  expect(source?.durationMinutes).toBe(20);
  expect((afterApply.occurrences || []).filter((occ) => occ.goalId === "goal_action" && occ.date === addDaysKey(today, 1))).toHaveLength(1);
  expect(afterApply.system_analysis_v1?.analyses?.[0]?.appliedCorrectionIds?.length).toBe(1);
  await expect.poll(async () => page.evaluate((userId) => {
    const raw = localStorage.getItem(`e2e.supabase.user_data.${userId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.system_analysis_v1?.analyses?.[0]?.appliedCorrectionIds?.length || 0;
  }, E2E_USER_ID)).toBe(1);

  await expect.poll(async () => page.evaluate((userId) => {
    const rawUserData = localStorage.getItem(`e2e.supabase.user_data.${userId}`);
    const rawLocalState = localStorage.getItem("discip_yourself_v2");
    const parsedUserData = rawUserData ? JSON.parse(rawUserData) : null;
    const parsedLocalState = rawLocalState ? JSON.parse(rawLocalState) : null;
    return (
      parsedUserData?.system_analysis_v1?.analyses?.[0]?.appliedCorrectionIds?.length ||
      parsedLocalState?.system_analysis_v1?.analyses?.[0]?.appliedCorrectionIds?.length ||
      0
    );
  }, E2E_USER_ID)).toBe(1);
  await page.getByRole("button", { name: "Retour à Ajuster" }).click();
  await expect(page.getByText("RECOMMANDATION")).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Analyser le système/i }).click();
  await expect(page.getByText("Dernière analyse")).toBeVisible();
  await expect(page.getByText("Ton système avance, mais le bloc principal gagne à être raccourci.")).toBeVisible();
  await expect(page.getByText("Déjà appliquée").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Sélectionner" })).toHaveCount(0);
});

test("System Analysis: thin data opens command sheet without backend call", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = {
      ...(globalThis.process.env || {}),
      VITE_AI_BACKEND_URL: globalThis.location.origin,
    };
  });
  let systemAnalysisRequests = 0;
  await page.route("**/ai/system-analysis", async (route) => {
    systemAnalysisRequests += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "unexpected" }),
    });
  });
  const state = buildCanonicalExecutionState({ premium: true, withHistory: false });
  state.occurrences = state.occurrences.slice(0, 1);
  state.sessionHistory = [];
  await seedCurrentUser(page, state, {
    appMetadata: { plan_tier: "premium" },
  });

  await page.goto("/adjust");
  await page.getByRole("button", { name: /Analyse système|Analyser le système/i }).click();

  await expect(page.getByRole("dialog").getByText("Données encore limitées.")).toBeVisible();
  await expect(page.getByText("L’analyse sera plus précise après quelques jours d’exécution.")).toBeVisible();
  await expect(page.getByText("Structure du planning")).toBeVisible();
  await expect(page.getByText("Créneaux libres")).toBeVisible();
  await page.getByRole("button", { name: "Compris" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(systemAnalysisRequests).toBe(0);
});
