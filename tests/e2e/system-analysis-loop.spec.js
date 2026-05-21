import { test, expect, devices } from "@playwright/test";
import { getState } from "./utils/seed.js";
import {
  addDaysKey,
  buildCanonicalExecutionState,
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
    expect(request.snapshot.analysisModeRecommendation).toBe("initial_analysis");
    const period = request.snapshot.period;
    const referenceDateKey = request.referenceDateKey || period.endDateKey;
    const tomorrow = addDaysKey(referenceDateKey, 1);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 2,
        period,
        analysisMode: "initial_analysis",
        diagnosisSummary: {
          primaryFinding: "Le bloc principal est trop lourd.",
          risk: "La charge augmente la friction avant l’exécution.",
          opportunity: "Une version plus courte peut protéger l’avancée.",
          evidence: [{
            source: "snapshot",
            dateKey: referenceDateKey,
            occurrenceId: "occ_today",
            historyId: null,
            actionId: "goal_action",
            goalId: "goal_outcome",
            objectiveId: "goal_outcome",
            count: 1,
            facts: ["1 bloc prioritaire à raccourcir"],
          }],
          confidence: 0.76,
        },
        executiveSummary: "Ton système avance, mais le bloc principal gagne à être raccourci.",
        invisibleFriction: [
          {
            title: "Créneau trop exposé",
            message: "Le matin concentre déjà trop d’effort.",
            evidence: [{
              source: "snapshot",
              dateKey: referenceDateKey,
              occurrenceId: "occ_today",
              historyId: null,
              actionId: "goal_action",
              goalId: "goal_outcome",
              objectiveId: "goal_outcome",
              count: 1,
              facts: ["Bloc prioritaire observé"],
            }],
            confidence: 0.76,
          },
        ],
        systemWeaknesses: [
          {
            title: "Charge concentrée",
            message: "Un bloc plus tardif protège mieux l’exécution.",
            evidence: [{
              source: "snapshot",
              dateKey: referenceDateKey,
              occurrenceId: "occ_today",
              historyId: null,
              actionId: "goal_action",
              goalId: "goal_outcome",
              objectiveId: "goal_outcome",
              count: 1,
              facts: ["Charge concentrée sur le bloc principal"],
            }],
            confidence: 0.74,
          },
        ],
        strongestPatterns: [
          {
            title: "Les blocs courts tiennent mieux",
            message: "Les sessions courtes sont les plus stables.",
            evidence: [{
              source: "sessionHistory",
              dateKey: referenceDateKey,
              occurrenceId: "occ_today",
              historyId: "hist_done_1",
              actionId: "goal_action",
              goalId: "goal_outcome",
              objectiveId: "goal_outcome",
              count: 1,
              facts: ["Une session courte terminée"],
            }],
            confidence: 0.72,
          },
        ],
        recommendedCorrections: [
          {
            title: "Réduire le bloc client à 20 minutes",
            message: "Réduit la friction sans supprimer l’action.",
            evidence: [{
              source: "snapshot",
              dateKey: referenceDateKey,
              occurrenceId: "occ_today",
              historyId: null,
              actionId: "goal_action",
              goalId: "goal_outcome",
              objectiveId: "goal_outcome",
              count: 1,
              facts: ["Bloc principal trop long"],
            }],
            confidence: 0.82,
          },
        ],
        correctionDraft: {
          version: 2,
          userConfirmationRequired: true,
          correctionItems: [
            {
              id: "ci_reduce_occ_today",
              type: "occurrence_reduce",
              targetType: "occurrence",
              targetId: "occ_today",
              action: "reduce",
              title: "Réduire le bloc client",
              whatChanges: "Réduire à 20 min.",
              why: "Créneau plus stable pour ce bloc.",
              evidence: [{
                source: "snapshot",
                dateKey: referenceDateKey,
                occurrenceId: "occ_today",
                historyId: null,
                actionId: "goal_action",
                goalId: "goal_outcome",
                objectiveId: "goal_outcome",
                count: 1,
                facts: ["Bloc prioritaire trop long"],
              }],
              expectedImpact: "Moins de friction sur le bloc principal.",
              risk: "Risque faible : le bloc reste présent.",
              confidence: 0.82,
              supportStatus: "applicable",
              destructive: false,
              confirmationLevel: "standard",
              validationRequirements: ["user_confirmation"],
              proposedDateKey: null,
              proposedStart: null,
              proposedDurationMinutes: 20,
              proposedLoad: null,
            },
            {
              id: "ci_remove_low_value_action",
              type: "action_remove",
              targetType: "action",
              targetId: "goal_action",
              action: "remove",
              title: "Supprimer une action faible",
              whatChanges: "Retirer une action peu utilisée.",
              why: "Cette proposition demande une décision manuelle.",
              evidence: [{
                source: "snapshot",
                dateKey: referenceDateKey,
                occurrenceId: "occ_today",
                historyId: null,
                actionId: "goal_action",
                goalId: "goal_outcome",
                objectiveId: "goal_outcome",
                count: 1,
                facts: ["Action à revoir"],
              }],
              expectedImpact: "Alléger le système.",
              risk: "Risque de supprimer un support utile.",
              confidence: 0.62,
              supportStatus: "unsupported",
              destructive: true,
              confirmationLevel: "destructive",
              validationRequirements: ["manual_review"],
              proposedDateKey: null,
              proposedStart: null,
              proposedDurationMinutes: null,
              proposedLoad: null,
            },
          ],
          correctedLoad: {
            targetBlocksPerDay: 2,
            maxDailyMinutes: 70,
            reason: "Garder une charge réaliste.",
          },
          occurrenceAdjustments: [
            {
              occurrenceId: "occ_today",
              action: "reduce_duration",
              proposedDateKey: null,
              proposedStart: null,
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
        },
        next7DaysFocus: [
          {
            title: "Reprendre le bloc client en version courte",
            message: "Garder un bloc plus court demain.",
            evidence: [{
              source: "snapshot",
              dateKey: tomorrow,
              occurrenceId: "occ_today",
              historyId: null,
              actionId: "goal_action",
              goalId: "goal_outcome",
              objectiveId: "goal_outcome",
              count: 1,
              facts: ["Focus 7 jours"],
            }],
            confidence: 0.7,
          },
        ],
        coachQuestions: ["Quel créneau est vraiment protégé ?"],
        confidence: 0.76,
        dataLimitations: ["Analyse locale limitée aux données déjà synchronisées."],
        safetyNotes: ["Aucune correction n’a été appliquée automatiquement."],
        generatedAt: "2026-05-20T12:00:00.000Z",
        modelMeta: {
          model: "mock-system-analysis",
          promptVersion: "system_analysis_v2_0",
          requestId: "req-system-analysis-e2e",
          snapshotHash: request.snapshot.snapshotHash,
        },
      }),
    });
  });
}

test("System Analysis: preview, review, final apply and local history metadata", async ({ page }) => {
  await installSystemAnalysisMock(page);
  const state = buildCanonicalExecutionState({ premium: true, withHistory: false });
  const today = state.ui.selectedDate;
  state.occurrences.unshift({
    id: "occ_activation",
    goalId: "goal_action",
    date: addDaysKey(today, -12),
    start: "09:00",
    slotKey: "09:00",
    durationMinutes: 20,
    status: "planned",
  });
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

  await expect(page.locator('[data-system-analysis-correction-id="ci_reduce_occ_today"]').getByText("Réduire", { exact: true })).toBeVisible();
  await expect(page.getByText("Réduire à 20 min.")).toBeVisible();
  await expect(page.getByText("DESTRUCTIF")).toBeVisible();
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
  expect(afterApply.goals.find((goal) => goal.id === "goal_action")).toBeTruthy();
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

test("System Analysis: empty system opens command sheet without backend call", async ({ page }) => {
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
  state.categories = [];
  state.goals = [];
  state.occurrences = [];
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
