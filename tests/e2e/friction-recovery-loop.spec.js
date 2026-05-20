import { test, expect, devices } from "@playwright/test";
import { getState } from "./utils/seed.js";
import {
  addDaysKey,
  buildCanonicalExecutionState,
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

async function openAndStartSession(page) {
  await page.goto("/");
  await page.locator(".todayCommitmentButton").click();
  await expect(page.getByText("Protège ce bloc.")).toBeVisible();
  await page.getByRole("button", { name: "Démarrer le bloc" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
}

test("friction recovery: blocage visible dans Today, Planning et Ajuster", async ({ page }) => {
  await seedCurrentUser(page, buildCanonicalExecutionState());

  await openAndStartSession(page);
  await page.getByRole("button", { name: "Bloquer" }).click();
  await expect(page.getByText("Bloc marqué comme bloqué.")).toBeVisible();
  await page.getByRole("button", { name: "Retour à Today" }).click();

  const next = await getState(page);
  expect((next.sessionHistory || []).some((entry) => entry.occurrenceId === "occ_today" && entry.endedReason === "blocked")).toBeTruthy();
  expect(next.occurrences.find((occurrence) => occurrence.id === "occ_today")?.status).toBe("planned");

  await expect(page.getByTestId("today-primary-action-card")).toContainText(/bloqu|récup|reprendre|ajuster/i);
  await page.getByLabel("Navigation principale").getByRole("button", { name: "Planning" }).click();
  await expect(page.getByText(/bloqu|reprendre|récup/i).first()).toBeVisible();
  await page.getByLabel("Navigation principale").getByRole("button", { name: "Ajuster" }).click();
  await expect(page.getByText(/bloc|friction|bloqu/i).first()).toBeVisible();
});

test("friction recovery: report demain déplace le bloc sans lancer l’ancien créneau", async ({ page }) => {
  const state = buildCanonicalExecutionState();
  const today = state.ui.selectedDate;
  state.occurrences = state.occurrences.map((occurrence) =>
    occurrence.id === "occ_today"
      ? { ...occurrence, date: addDaysKey(today, 1), repairV1: { version: 1, type: "move_tomorrow", protectFromRuleSync: true } }
      : occurrence
  );
  state.sessionHistory = [
    ...(state.sessionHistory || []),
    {
      id: "hist_reported_e2e",
      occurrenceId: "occ_today",
      goalId: "goal_action",
      dateKey: today,
      startedAt: `${today}T09:00:00.000Z`,
      endedAt: `${today}T09:05:00.000Z`,
      endedReason: "reported",
      durationSec: 300,
    },
  ];
  await seedCurrentUser(page, state);

  await page.goto("/");

  const next = await getState(page);
  const occurrence = next.occurrences.find((entry) => entry.id === "occ_today");
  expect(occurrence?.date).toBe(addDaysKey(today, 1));
  expect(occurrence?.status).toBe("planned");
  expect((next.sessionHistory || []).some((entry) => entry.occurrenceId === "occ_today" && entry.endedReason === "reported")).toBeTruthy();

  await expect(page.getByTestId("today-primary-action-card")).not.toContainText("Démarrer le bloc");
  await page.getByLabel("Navigation principale").getByRole("button", { name: "Planning" }).click();
  await expect(page.getByText("Bloc d’exécution client", { exact: true }).first()).toBeVisible();
});
