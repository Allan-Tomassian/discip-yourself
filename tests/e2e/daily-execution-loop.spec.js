import { test, expect, devices } from "@playwright/test";
import { getState } from "./utils/seed.js";
import {
  buildCanonicalExecutionState,
  seedCurrentUser,
} from "./utils/currentProduct.js";

const iPhone13 = devices["iPhone 13"];

function currentReadyStartTime() {
  const now = new Date();
  const minutes = Math.max(0, (now.getHours() * 60) + now.getMinutes() - 5);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function makeTodayBlockReady(state) {
  const start = currentReadyStartTime();
  const action = state.goals.find((goal) => goal.id === "goal_action");
  if (action) {
    action.startTime = start;
    action.timeSlots = [start];
    action.durationMinutes = 60;
    action.sessionMinutes = 60;
  }
  const occurrence = state.occurrences.find((entry) => entry.id === "occ_today");
  if (occurrence) {
    occurrence.start = start;
    occurrence.slotKey = start;
    occurrence.durationMinutes = 60;
  }
}

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

test("daily execution: Today → Session → finish → feedback → surfaces update", async ({ page }) => {
  const state = buildCanonicalExecutionState();
  makeTodayBlockReady(state);
  await seedCurrentUser(page, state);

  await page.goto("/");
  await expect(page.locator(".todayCockpitTitle")).toHaveText("Home");
  await expect(page.getByTestId("today-trajectory-card")).toBeVisible();
  await expect(page.getByTestId("today-ai-insight-card")).toBeVisible();
  await expect(page.getByTestId("today-primary-action-card")).toContainText("Prochaine action");
  await page.locator(".todayCommitmentButton").click();

  await expect(page.getByText("Protège ce bloc.")).toBeVisible();
  await page.getByRole("button", { name: "Démarrer le bloc" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Terminer le bloc" }).click();
  await expect(page.getByText("Bloc terminé ?").first()).toBeVisible();
  await page.getByRole("button", { name: "normal" }).click();
  await page.getByRole("button", { name: "Valider la session" }).click();
  await expect(page.getByText("Preuve validée.").first()).toBeVisible();
  await page.getByRole("button", { name: "Retour à Today" }).click();

  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
  await expect(page.getByTestId("today-primary-action-card")).not.toContainText("Démarrer le bloc");

  const next = await getState(page);
  expect(next.occurrences.find((occurrence) => occurrence.id === "occ_today")?.status).toBe("done");
  expect((next.sessionHistory || []).some((entry) => entry.occurrenceId === "occ_today" && entry.endedReason === "done")).toBeTruthy();

  await page.getByLabel("Navigation principale").getByRole("button", { name: "Planning" }).click();
  await expect(page.getByText("Bloc d’exécution client", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Terminé|Validé|fait|done/i).first()).toBeVisible();

  await page.getByLabel("Navigation principale").getByRole("button", { name: "Objectifs" }).click();
  await expect(page.getByText("Lancer le système client", { exact: true })).toBeVisible();
  await expect(page.getByText("Progression d’exécution").first()).toBeVisible();

  await page.getByLabel("Navigation principale").getByRole("button", { name: "Ajuster" }).click();
  await expect(page.locator(".pageTitle")).toContainText("Ajuster");
  await expect(page.getByText(/diagnostic|recommandation|système/i).first()).toBeVisible();
});
