import { test, expect, devices } from "@playwright/test";
import {
  buildCanonicalExecutionState,
  openMainTab,
  seedCurrentUser,
} from "./utils/currentProduct.js";

const iPhoneSE = devices["iPhone SE"];

test.use({
  viewport: iPhoneSE.viewport,
  userAgent: iPhoneSE.userAgent,
  deviceScaleFactor: iPhoneSE.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

async function attachScreenshot(page, testInfo, name) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function expectNoHorizontalOverflow(page) {
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
    .toBeTruthy();
}

function futureStartTime() {
  const now = new Date();
  const minutes = Math.min((23 * 60) + 30, (now.getHours() * 60) + now.getMinutes() + 90);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function keepCanonicalBlockUpcoming(state) {
  const start = futureStartTime();
  const action = state.goals.find((goal) => goal.id === "goal_action");
  if (action) {
    action.startTime = start;
    action.timeSlots = [start];
  }
  const occurrence = state.occurrences.find((entry) => entry.id === "occ_today");
  if (occurrence) {
    occurrence.start = start;
    occurrence.slotKey = start;
    occurrence.status = "planned";
  }
}

test("Ajuster simplification: primary decision and collapsed details stay mobile-safe", async ({ page }, testInfo) => {
  const state = buildCanonicalExecutionState();
  keepCanonicalBlockUpcoming(state);
  await seedCurrentUser(page, state);
  await page.goto("/");
  await openMainTab(page, "Ajuster");

  await expect(page.locator(".pageTitle")).toContainText("Ajuster");
  await expect(page.getByRole("button", { name: /Analyser le système|Analyse système/i })).toBeVisible();
  await expect(page.getByTestId("adjust-primary-decision")).toBeVisible();
  await expect(page.locator(".adjustHero")).toHaveCount(0);
  await expect(page.getByText("SIGNAL SYSTÈME")).toHaveCount(0);
  await expect(page.getByText("RECOMMANDATION")).toHaveCount(0);
  await expect(page.getByText(/PROCHAIN BLOC/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "adjust-collapsed-default-small-iphone.png");

  const signals = page.getByRole("button", { name: /Signaux détectés/i });
  const trends = page.getByRole("button", { name: /Tendances et catégories/i });
  const actions = page.getByRole("button", { name: /Autres leviers/i });
  const diagnostic = page.getByRole("button", { name: /Détails du diagnostic/i });

  await expect(signals).toHaveAttribute("aria-expanded", "false");
  await signals.click();
  await trends.click();
  await actions.click();
  await diagnostic.click();

  await expect(signals).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/Rien ne justifie une alerte|Charge restante/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Réorganiser les horaires/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Simplifier la journée/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "adjust-details-expanded-small-iphone.png");

  await page.getByTestId("adjust-primary-decision").getByRole("button").click();
  await expect(page.locator(".pageTitle")).toContainText("Coach");
});

test("Ajuster simplification: concrete recovery remains the dominant action", async ({ page }, testInfo) => {
  const state = buildCanonicalExecutionState();
  const today = state.ui.selectedDate;
  state.sessionHistory = [
    {
      id: "hist_blocked_adjust",
      occurrenceId: "occ_today",
      goalId: "goal_action",
      dateKey: today,
      startedAt: `${today}T09:00:00.000Z`,
      endedAt: `${today}T09:10:00.000Z`,
      endedReason: "blocked",
      state: "ended",
      durationSec: 600,
    },
  ];

  await seedCurrentUser(page, state);
  await page.goto("/");
  await openMainTab(page, "Ajuster");

  await expect(page.getByTestId("adjust-primary-decision")).toContainText("Bloc bloqué");
  await expect(page.getByTestId("adjust-primary-decision")).toContainText("1 bloc bloqué aujourd’hui.");
  await expect(page.getByRole("button", { name: "Réparer ce bloc" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Autres leviers/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await attachScreenshot(page, testInfo, "adjust-concrete-recovery-small-iphone.png");

  await page.getByRole("button", { name: /Signaux détectés/i }).click();
  await expect(page.getByText("Un bloc a rencontré une friction concrète.")).toBeVisible();
  await attachScreenshot(page, testInfo, "adjust-recovery-signals-expanded-small-iphone.png");

  await page.getByRole("button", { name: "Réparer ce bloc" }).click();
  await expect(page.getByTestId("unified-recovery-sheet")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ce bloc a été interrompu." })).toBeVisible();
});
