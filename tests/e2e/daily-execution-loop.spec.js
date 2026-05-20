import { test, expect, devices } from "@playwright/test";
import { getState } from "./utils/seed.js";
import {
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

test("daily execution: Today → Session → finish → feedback → surfaces update", async ({ page }) => {
  const state = buildCanonicalExecutionState();
  await seedCurrentUser(page, state);

  await page.goto("/");
  await expect(page.getByTestId("today-primary-action-card")).toContainText("Bloc d’exécution client");
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
