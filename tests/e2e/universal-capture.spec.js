import { test, expect, devices } from "@playwright/test";
import { createEmptyCreateItemDraft } from "../../src/creation/createItemDraft.js";
import { buildBaseState, seedState } from "./utils/seed.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

function buildStateWithCreateDraft() {
  const state = buildBaseState({ withContent: false });
  state.ui.createDraft = {
    ...createEmptyCreateItemDraft(),
    kind: "action",
    actionDraft: {
      ...createEmptyCreateItemDraft().actionDraft,
      title: "Relancer le devis client",
      categoryId: "cat_business",
    },
    origin: {
      mainTab: "objectives",
      sourceSurface: "objectives",
      categoryId: "cat_business",
      libraryMode: "category-view",
    },
    status: "draft",
  };
  return state;
}

async function attachScreenshot(page, testInfo, name) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function openObjectivesCapture(page, state) {
  await seedState(page, state);
  await page.goto("/");
  await page.getByRole("button", { name: "Objectifs" }).click();
  await expect(page.locator(".pageHeader .pageTitle")).toHaveText("Objectifs");
  await page.getByTestId("objectives-universal-capture-button").click();
  await expect(page.getByTestId("universal-capture-surface")).toBeVisible();
}

test("objectives universal capture shows one input and discreet draft resume", async ({ page }, testInfo) => {
  await openObjectivesCapture(page, buildStateWithCreateDraft());

  await expect(page.getByText("Qu’est-ce que tu veux faire avancer ?")).toBeVisible();
  await expect(page.getByTestId("universal-capture-input")).toBeVisible();
  await expect(page.getByTestId("universal-capture-submit")).toBeDisabled();
  await expect(page.getByTestId("universal-capture-resume-draft")).toBeVisible();
  await expect(page.getByText("Créer une action")).toHaveCount(0);
  await expect(page.getByText("Créer un objectif")).toHaveCount(0);
  await expect(page.getByText("Passer en mode Plan")).toHaveCount(0);

  await attachScreenshot(page, testInfo, "objectives-universal-capture-open.png");
});

test("objectives universal capture routes a concrete intent to prefilled action create-item", async ({ page }, testInfo) => {
  await openObjectivesCapture(page, buildBaseState({ withContent: false }));

  await page.getByTestId("universal-capture-input").fill("Appeler le dentiste demain");
  await page.getByTestId("universal-capture-submit").click();

  await expect(page.getByText("Créer une action")).toBeVisible();
  await expect(page.locator("input").first()).toHaveValue("Appeler le dentiste demain");

  await attachScreenshot(page, testInfo, "objectives-universal-capture-action-prefill.png");
});

test("objectives universal capture routes a goal intent to prefilled outcome create-item", async ({ page }, testInfo) => {
  await openObjectivesCapture(page, buildBaseState({ withContent: false }));

  await page.getByTestId("universal-capture-input").fill("Lancer la nouvelle page d’accueil");
  await page.getByTestId("universal-capture-submit").click();

  await expect(page.getByText("Créer un objectif")).toBeVisible();
  await expect(page.locator("input").first()).toHaveValue("Lancer la nouvelle page d’accueil");

  await attachScreenshot(page, testInfo, "objectives-universal-capture-goal-prefill.png");
});

test("objectives universal capture routes ambiguous or composite intents to coach without auto-send", async ({ page }, testInfo) => {
  await openObjectivesCapture(page, buildBaseState({ withContent: false }));

  await page.getByTestId("universal-capture-input").fill("sport");
  await page.getByTestId("universal-capture-submit").click();
  await expect(page.getByText("Ton copilote stratégique")).toBeVisible();
  await expect(page.locator(".lovableCoachTextarea")).toHaveValue(
    'Aide-moi à clarifier cette intention et à en faire le prochain pas utile : "sport"'
  );
  await attachScreenshot(page, testInfo, "objectives-universal-capture-coach-clarify.png");

  await page.getByRole("button", { name: "Objectifs" }).click();
  await page.getByTestId("objectives-universal-capture-button").click();
  await page
    .getByTestId("universal-capture-input")
    .fill("Je veux mieux manger, reprendre le sport et organiser mes semaines");
  await page.getByTestId("universal-capture-submit").click();

  await expect(page.getByText("Ton copilote stratégique")).toBeVisible();
  await expect(page.locator(".lovableCoachTextarea")).toHaveValue(
    'Aide-moi à structurer ce que je veux faire avancer à partir de cette intention : "Je veux mieux manger, reprendre le sport et organiser mes semaines"'
  );

  await attachScreenshot(page, testInfo, "objectives-universal-capture-coach-structuring.png");
});
