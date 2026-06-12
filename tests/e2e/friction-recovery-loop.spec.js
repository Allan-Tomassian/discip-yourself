import { test, expect, devices } from "@playwright/test";
import { getUserData } from "./utils/seed.js";
import {
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

function currentReadyStartTime() {
  const now = new Date();
  const minutes = Math.max(0, (now.getHours() * 60) + now.getMinutes() - 5);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function makeTodayBlockReady(state) {
  const start = currentReadyStartTime();
  const today = state.ui.selectedDate;
  state.ui.firstRunV1 = {
    ...(state.ui.firstRunV1 || {}),
    commitV1: {
      ...((state.ui.firstRunV1 && typeof state.ui.firstRunV1.commitV1 === "object") ? state.ui.firstRunV1.commitV1 : {}),
      status: "applied",
      appliedAt: `${today}T08:00:00.000Z`,
      createdActionIds: ["goal_action"],
    },
  };
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

async function openAndStartSession(page) {
  await page.goto("/");
  await page.locator(".todayCommitmentButton").click();
  await expect(page.getByText("Protège ce bloc.")).toBeVisible();
  await page.getByRole("button", { name: "Démarrer le bloc" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
}

test("friction recovery: blocked session opens recovery sheet after recording outcome", async ({ page }) => {
  const state = buildCanonicalExecutionState();
  makeTodayBlockReady(state);
  await seedCurrentUser(page, state);

  await openAndStartSession(page);
  await page.getByRole("button", { name: "Bloquer" }).click();
  await expect(page.getByTestId("unified-recovery-sheet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ce bloc a été interrompu." })).toBeVisible();

  await expect
    .poll(async () => {
      const current = await getUserData(page, E2E_USER_ID);
      return (current.sessionHistory || []).some(
        (entry) => entry.occurrenceId === "occ_today" && entry.endedReason === "blocked"
      );
    })
    .toBeTruthy();
  const blockedState = await getUserData(page, E2E_USER_ID);
  expect((blockedState.sessionHistory || []).some((entry) => entry.occurrenceId === "occ_today" && entry.endedReason === "blocked")).toBeTruthy();
  expect(blockedState.occurrences.find((occurrence) => occurrence.id === "occ_today")?.status).toBe("planned");

  await page.getByRole("button", { name: /Réduire à/i }).click();
  await page.getByRole("button", { name: /^Confirmer/ }).click();
  await expect(page.getByRole("heading", { name: "Bloc ajusté" })).toBeVisible();
  await page.getByRole("button", { name: "Retour à Home" }).click();

  const repairedState = await getUserData(page, E2E_USER_ID);
  const source = repairedState.occurrences.find((occurrence) => occurrence.id === "occ_today");
  expect(source?.status).toBe("rescheduled");
  expect(
    repairedState.occurrences.some(
      (occurrence) => occurrence.id !== "occ_today" && occurrence.repairV1?.sourceOccurrenceId === "occ_today" && occurrence.status === "planned"
    )
  ).toBeTruthy();

  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
  await page.getByLabel("Navigation principale").getByRole("button", { name: "Planning" }).click();
  await expect(page.getByText("Bloc d’exécution client", { exact: true }).first()).toBeVisible();
});

test("friction recovery: reported session opens recovery sheet without legacy double move", async ({ page }) => {
  const state = buildCanonicalExecutionState();
  makeTodayBlockReady(state);
  const today = state.ui.selectedDate;
  await seedCurrentUser(page, state);

  await openAndStartSession(page);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Reporter" }).click();
  await expect(page.getByTestId("unified-recovery-sheet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ce bloc a été signalé." })).toBeVisible();

  await expect
    .poll(async () => {
      const current = await getUserData(page, E2E_USER_ID);
      return (current.sessionHistory || []).some(
        (entry) => entry.occurrenceId === "occ_today" && entry.endedReason === "reported"
      );
    })
    .toBeTruthy();
  const reportedState = await getUserData(page, E2E_USER_ID);
  const reportedSource = reportedState.occurrences.find((entry) => entry.id === "occ_today");
  expect(reportedSource?.date).toBe(today);
  expect(reportedSource?.status).toBe("planned");
  expect((reportedState.sessionHistory || []).some((entry) => entry.occurrenceId === "occ_today" && entry.endedReason === "reported")).toBeTruthy();

  await page.getByRole("button", { name: /Reporter à|Reporter ce soir/i }).click();
  await page.getByRole("button", { name: /^Confirmer/ }).click();
  await expect(page.getByRole("heading", { name: "Bloc ajusté" })).toBeVisible();
  await page.getByRole("button", { name: "Retour à Home" }).click();

  const movedState = await getUserData(page, E2E_USER_ID);
  const movedSource = movedState.occurrences.find((entry) => entry.id === "occ_today");
  const movedTarget = movedState.occurrences.find((entry) => entry.id !== "occ_today" && entry.repairV1?.sourceOccurrenceId === "occ_today");
  expect(movedSource?.status).toBe("rescheduled");
  expect(movedSource?.date).toBe(today);
  expect(movedTarget?.status).toBe("planned");
  expect(movedTarget?.date).toBe(today);

  await expect(page.getByTestId("today-primary-action-card")).toBeVisible();
  await page.getByLabel("Navigation principale").getByRole("button", { name: "Planning" }).click();
  await expect(page.getByText("Bloc d’exécution client", { exact: true }).first()).toBeVisible();
});
