import { test, expect } from "@playwright/test";
import { buildBaseState, seedState, getState } from "./utils/seed.js";

async function openTabPilotage(page) {
  await expect(page.locator("[data-tour-id=\"pilotage-load\"]")).toBeVisible();
  await expect(page.locator("[data-tour-id=\"pilotage-discipline\"]")).toBeVisible();
}

async function selectRadarCategory(page, slotIndex, label) {
  const panel = page.locator("[data-tour-id=\"pilotage-discipline\"] .pilotageRadarSelects");
  const trigger = panel.locator("button.selectTrigger").nth(slotIndex);
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.evaluate((targetLabel) => {
    const options = Array.from(document.querySelectorAll(".selectMenu button.selectOption"));
    const target = options.find((node) => (node.textContent || "").trim() === targetLabel);
    if (target) target.click();
  }, label);
  await expect(trigger).toContainText(label);
}

async function openCategoryGate(page) {
  await page.getByTestId("create-plus-button").click();
  await expect(page.getByTestId("category-gate-modal")).toBeVisible();
}

async function closeCategoryGate(page) {
  const modal = page.getByTestId("category-gate-modal");
  await modal.getByRole("button", { name: "Annuler" }).click();
  await expect(modal).toBeHidden();
}

test("Pilotage: Catégories visibles persistent après reload", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  state.profile.plan = "premium";
  state.ui.lastTab = "pilotage";
  await seedState(page, state);
  await page.goto("/");
  await openTabPilotage(page);

  const panel = page.locator("[data-tour-id=\"pilotage-discipline\"] .pilotageRadarSelects");
  await expect(panel.locator("button.selectTrigger")).toHaveCount(3);

  await selectRadarCategory(page, 0, "Business");
  await selectRadarCategory(page, 1, "Vide");
  await selectRadarCategory(page, 2, "Général");

  const labelsBeforeReload = await page
    .locator("[data-tour-id=\"pilotage-discipline\"] .pilotageRadarSelects button.selectTrigger")
    .allTextContents();
  const normalizedBefore = labelsBeforeReload.map((text) => text.replace("▾", "").trim());
  expect(normalizedBefore.length).toBe(3);
  expect(normalizedBefore.join("|")).not.toBe("Général|Business|Vide");

  const next = await getState(page);
  expect(Array.isArray(next?.ui?.pilotageRadarSelection)).toBeTruthy();
  expect((next?.ui?.pilotageRadarSelection || []).length).toBe(3);
  const expectedLabelsAfterReload = (next?.ui?.pilotageRadarSelection || []).map((id) => {
    const category = (next?.categories || []).find((item) => item?.id === id);
    return category?.name || "";
  });

  const reloaded = await page.context().newPage();
  await reloaded.goto("/");
  await openTabPilotage(reloaded);

  await expect
    .poll(async () => {
      const labelsAfterReload = await reloaded
        .locator("[data-tour-id=\"pilotage-discipline\"] .pilotageRadarSelects button.selectTrigger")
        .allTextContents();
      return labelsAfterReload
        .map((text) => text.replace("▾", "").trim())
        .sort((a, b) => a.localeCompare(b))
        .join("|");
    })
    .toBe(
      [...expectedLabelsAfterReload]
        .sort((a, b) => a.localeCompare(b))
        .join("|")
    );
  await reloaded.close();
});

test("Pilotage: sélection radar reste valide après suppression d'une catégorie sélectionnée", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  state.profile.plan = "premium";
  state.ui.lastTab = "pilotage";
  await seedState(page, state);
  await page.goto("/");
  await openTabPilotage(page);

  await openCategoryGate(page);
  await page.getByTestId("category-toggle-suggest_apprentissage").click();
  await closeCategoryGate(page);
  await openTabPilotage(page);

  const withSuggestion = await getState(page);
  const labelBusiness =
    (withSuggestion?.categories || []).find((category) => category?.id === "cat_business")?.name || "Business";
  const labelEmpty =
    (withSuggestion?.categories || []).find((category) => category?.id === "cat_empty")?.name || "Vide";
  const labelLearning =
    (withSuggestion?.categories || []).find((category) => category?.id === "suggest_apprentissage")?.name
    || "Apprentissage";

  await selectRadarCategory(page, 0, labelBusiness);
  await selectRadarCategory(page, 1, labelEmpty);
  await selectRadarCategory(page, 2, labelLearning);

  await openCategoryGate(page);
  await page.getByTestId("category-toggle-cat_empty").click();
  await expect
    .poll(async () => (await getState(page))?.categories?.some((category) => category?.id === "cat_empty"))
    .toBeFalsy();
  await closeCategoryGate(page);

  const reloaded = await page.context().newPage();
  await reloaded.goto("/");
  await openTabPilotage(reloaded);

  const next = await getState(reloaded);
  expect((next?.categories || []).some((category) => category?.id === "cat_empty")).toBeFalsy();
  expect((next?.ui?.pilotageRadarSelection || []).includes("cat_empty")).toBeFalsy();
  expect((next?.ui?.pilotageRadarSelection || []).length).toBe(3);
  expect(new Set(next?.ui?.pilotageRadarSelection || []).size).toBe(3);

  const remainingNames = new Set((next?.categories || []).map((category) => category?.name).filter(Boolean));
  const labelsAfterReload = await reloaded
    .locator("[data-tour-id=\"pilotage-discipline\"] .pilotageRadarSelects button.selectTrigger")
    .allTextContents();
  const normalizedLabelsAfterReload = labelsAfterReload.map((text) => text.replace("▾", "").trim());
  expect(normalizedLabelsAfterReload).toHaveLength(3);
  expect(normalizedLabelsAfterReload.includes(labelEmpty)).toBeFalsy();
  for (const label of normalizedLabelsAfterReload) {
    expect(remainingNames.has(label)).toBeTruthy();
  }
  await reloaded.close();
});
