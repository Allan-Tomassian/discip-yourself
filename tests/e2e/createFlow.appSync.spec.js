import { test, expect } from "@playwright/test";
import { buildBaseState, seedState, getState, getTodayKey } from "./utils/seed.js";

const BUSINESS_ID = "cat_business";
const INBOX_ID = "sys_inbox";

function addDaysKey(dateKey, deltaDays) {
  const [yyyy, mm, dd] = String(dateKey || "").split("-").map((v) => Number(v));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
  const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function plannedCount(locator) {
  return Number((await locator.getAttribute("data-planned")) || "0");
}

async function expectMonthCellPlannedCount(page, dateKey, expected) {
  const cell = page.locator(`[data-tour-id="today-calendar-month-grid"] [data-datekey="${dateKey}"]`).first();
  await expect(cell).toBeVisible();
  await expect(cell).toHaveAttribute("aria-label", new RegExp(`^${dateKey}\\s·`));
  await expect.poll(async () => plannedCount(cell)).toBe(expected);
}

async function selectBusinessInRail(page) {
  const rail = page.locator(".categoryRailScroll");
  await expect(rail.getByRole("button", { name: "Business", exact: true }).first()).toBeVisible();
  await rail.getByRole("button", { name: "Business", exact: true }).first().click();
}

async function openTabToday(page) {
  const nav = page.locator("[data-tour-id=\"topnav-tabs\"]");
  await nav.getByRole("button", { name: /Aujourd/i }).click();
  await expect(page.locator("[data-tour-id=\"today-title\"]")).toBeVisible();
}

async function openTabLibrary(page) {
  const nav = page.locator("[data-tour-id=\"topnav-tabs\"]");
  await nav.getByRole("button", { name: /Bibliothèque/i }).click();
  await expect(page.locator("[data-tour-id=\"library-title\"]")).toBeVisible();
}

async function openTabPilotage(page) {
  const nav = page.locator("[data-tour-id=\"topnav-tabs\"]");
  await nav.getByRole("button", { name: /Pilotage/i }).click();
  await expect(page.locator("[data-tour-id=\"pilotage-title\"]")).toBeVisible();
}

async function openCreateFlowForBusiness(page) {
  await page.getByTestId("create-plus-button").click();
  await expect(page.getByTestId("category-gate-modal")).toBeVisible();
  await page.getByTestId(`category-row-${BUSINESS_ID}`).click();
  await page.getByTestId("category-gate-continue").click();
  await expect(page.getByTestId("create-flow-modal")).toBeVisible();
}

async function completePickCategoryToBusiness(page) {
  const picker = page
    .locator(".flowShellBody")
    .filter({ hasText: "Dans quelle catégorie veux-tu agir ?" })
    .first();
  await expect(picker).toBeVisible();
  await picker.locator("button.selectTrigger").first().click();
  await page.getByRole("option", { name: "Business", exact: true }).click();
  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(page.getByTestId("create-flow-modal")).toBeHidden();
}

async function completeLinkOutcomeThenPickBusiness(page) {
  await expect(page.getByText(/Quel est le .* de cette action/i)).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await completePickCategoryToBusiness(page);
}

async function assertCalendarIndicatorsForDate(page, dateKey) {
  const neighborDateKey = addDaysKey(dateKey, 1);
  const monthNeighborDateKey =
    neighborDateKey.slice(0, 7) === String(dateKey || "").slice(0, 7) ? neighborDateKey : addDaysKey(dateKey, -1);

  const dayCell = page.locator(`[data-tour-id="today-calendar-rail"] [data-datekey="${dateKey}"]`).first();
  const dayNeighborCell = page.locator(
    `[data-tour-id="today-calendar-rail"] [data-datekey="${neighborDateKey}"]`
  ).first();
  await expect(dayCell).toBeVisible();
  await expect(dayCell).toHaveAttribute("aria-label", new RegExp(`^${dateKey}\\s·`));
  await expect.poll(async () => plannedCount(dayCell)).toBeGreaterThan(0);
  await expect(dayNeighborCell).toBeVisible();
  await expect.poll(async () => plannedCount(dayNeighborCell)).toBe(0);

  await page.locator("[data-tour-id=\"today-calendar-month\"]").click();
  const monthCell = page.locator(`[data-tour-id="today-calendar-month-grid"] [data-datekey="${dateKey}"]`).first();
  const monthNeighborCell = page
    .locator(`[data-tour-id="today-calendar-month-grid"] [data-datekey="${monthNeighborDateKey}"]`)
    .first();
  await expect(monthCell).toBeVisible();
  await expect(monthCell).toHaveAttribute("aria-label", new RegExp(`^${dateKey}\\s·`));
  await expect.poll(async () => plannedCount(monthCell)).toBeGreaterThan(0);
  await expect(monthNeighborCell).toBeVisible();
  await expect.poll(async () => plannedCount(monthNeighborCell)).toBe(0);
}

async function assertCreatedContentAcrossApp(
  page,
  {
    categoryName,
    titles,
    expectedDateKey,
    requireScheduledFocus = true,
    requireCalendarIndicator = true,
  }
) {
  await openTabLibrary(page);
  const list = page.locator("[data-tour-id=\"library-category-list\"]");
  await list.getByText(categoryName, { exact: true }).first().click();
  for (const title of titles) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }

  await openTabToday(page);
  await selectBusinessInRail(page);
  await expect(page.locator("[data-tour-id=\"today-focus-card\"]")).toBeVisible();
  if (requireScheduledFocus) {
    await expect(page.locator("[data-tour-id=\"today-focus-card\"]")).not.toContainText(
      "Rien de prévu, choisis une action prioritaire."
    );
  }
  await expect(page.locator("[data-tour-id=\"today-calendar-card\"]")).toBeVisible();
  if (requireCalendarIndicator) {
    await assertCalendarIndicatorsForDate(page, expectedDateKey);
  }

  await openTabPilotage(page);
  const categoryRow = page.getByLabel(new RegExp(`Catégorie\\s+${categoryName}`, "i")).first();
  await expect(categoryRow).toBeVisible();
  await expect(categoryRow).not.toContainText("Aucun élément");
}

async function createGuidedProjectAndAction(page, { projectTitle, actionTitle }) {
  await openCreateFlowForBusiness(page);
  await page.getByTestId("create-choice-guided").click();

  await page.getByPlaceholder("Nom du projet").fill(projectTitle);
  await page.getByLabel("Date de début").click();
  await page.locator(".datePickerMenu .datePickerAction", { hasText: /Aujourd/i }).click();
  await page.getByRole("button", { name: "Continuer" }).click();

  await page.getByTestId("create-type-oneoff").click();
  await page.getByPlaceholder("Nouvelle action").fill(actionTitle);
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();

  await completePickCategoryToBusiness(page);
}

async function createOneOffAction(page, { title }) {
  await openCreateFlowForBusiness(page);
  await page.getByTestId("create-choice-action").click();
  await page.getByTestId("create-type-oneoff").click();
  await page.getByPlaceholder("Nouvelle action").fill(title);
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();
  await completeLinkOutcomeThenPickBusiness(page);
}

async function createRecurringAction(page, { title, startTime, durationMinutes }) {
  await openCreateFlowForBusiness(page);
  await page.getByTestId("create-choice-action").click();
  await page.getByTestId("create-type-recurring").click();

  await page.getByPlaceholder("Nouvelle action").fill(title);
  await page.locator("input[type=\"time\"]").first().fill(startTime);
  await page.locator("input[placeholder=\"Minutes\"]").first().fill(String(durationMinutes));
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();

  await completeLinkOutcomeThenPickBusiness(page);
}

async function createAnytimeAction(page, { title }) {
  await openCreateFlowForBusiness(page);
  await page.getByTestId("create-choice-action").click();
  await page.getByTestId("create-type-anytime").click();

  await page.getByPlaceholder("Nouvelle action").fill(title);
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();

  await completeLinkOutcomeThenPickBusiness(page);
}

test("CreateFlow: projet + action met à jour Bibliothèque/Aujourd’hui/Calendrier/Pilotage", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  const projectTitle = "E2E Projet + Action";
  const actionTitle = "E2E Action liée";
  const todayKey = getTodayKey();

  await page.goto("/");
  await createGuidedProjectAndAction(page, { projectTitle, actionTitle });

  const next = await getState(page);
  const project = next.goals.find((g) => g.title === projectTitle);
  const action = next.goals.find((g) => g.title === actionTitle);
  expect(project?.categoryId).toBe(BUSINESS_ID);
  expect(action?.categoryId).toBe(BUSINESS_ID);
  expect((next.occurrences || []).some((o) => o.goalId === action.id && o.date === todayKey)).toBeTruthy();

  await assertCreatedContentAcrossApp(page, {
    categoryName: "Business",
    titles: [projectTitle, actionTitle],
    expectedDateKey: todayKey,
  });
});

test("CreateFlow: action ponctuelle met à jour toute l’app", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  const title = "E2E Action ponctuelle";
  const todayKey = getTodayKey();

  await page.goto("/");
  await createOneOffAction(page, { title });

  const next = await getState(page);
  const action = next.goals.find((g) => g.title === title);
  expect(action?.categoryId).toBe(BUSINESS_ID);
  expect(action?.planType).toBe("ONE_OFF");
  expect((next.occurrences || []).some((o) => o.goalId === action.id && o.date === todayKey)).toBeTruthy();

  await assertCreatedContentAcrossApp(page, {
    categoryName: "Business",
    titles: [title],
    expectedDateKey: todayKey,
  });
});

test("CreateFlow: action récurrente valide planning/durée + conflit bloquant", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  const recurringTitle = "E2E Action récurrente";
  const blockedTitle = "E2E Action conflit";
  const todayKey = getTodayKey();

  await page.goto("/");
  await createRecurringAction(page, { title: recurringTitle, startTime: "10:30", durationMinutes: 45 });

  let next = await getState(page);
  const recurring = next.goals.find((g) => g.title === recurringTitle);
  const recurringOccurrences = (next.occurrences || []).filter((o) => o.goalId === recurring.id);
  const expectedRecurringDate =
    recurringOccurrences.find((o) => o?.date === todayKey)?.date || recurringOccurrences[0]?.date || todayKey;
  expect(recurring?.categoryId).toBe(BUSINESS_ID);
  expect(recurring?.repeat).toBe("weekly");
  expect(recurring?.timeMode).toBe("FIXED");
  expect(recurring?.startTime).toBe("10:30");
  expect(recurring?.durationMinutes).toBe(45);
  expect(recurringOccurrences.length).toBeGreaterThan(0);

  await assertCreatedContentAcrossApp(page, {
    categoryName: "Business",
    titles: [recurringTitle],
    expectedDateKey: expectedRecurringDate,
    requireScheduledFocus: false,
    requireCalendarIndicator: false,
  });

  await openTabToday(page);
  await openCreateFlowForBusiness(page);
  await page.getByTestId("create-choice-action").click();
  await page.getByTestId("create-type-recurring").click();
  await page.getByPlaceholder("Nouvelle action").fill(blockedTitle);
  await page.locator("input[type=\"time\"]").first().fill("10:30");
  await page.getByTestId("action-add").click();
  await page.getByTestId("action-save").click();

  await expect(page.getByTestId("conflict-resolver-modal")).toBeVisible();
  await expect(page.getByText("Conflit d’horaire")).toBeVisible();

  next = await getState(page);
  expect(next.goals.some((g) => g.title === blockedTitle)).toBeFalsy();
  await page.getByTestId("conflict-resolver-cancel").click();
});

test("CreateFlow: action anytime sans horaire + présence dans les vues attendues", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  const title = "E2E Action anytime";
  const todayKey = getTodayKey();

  await page.goto("/");
  await createAnytimeAction(page, { title });

  const next = await getState(page);
  const action = next.goals.find((g) => g.title === title);
  const actionOccurrences = (next.occurrences || []).filter((o) => o?.goalId === action?.id);
  expect(action?.categoryId).toBe(BUSINESS_ID);
  expect(action?.habitType).toBe("ANYTIME");
  expect(action?.anytimeFlexible).toBe(false);
  expect(action?.repeat).toBe("weekly");
  expect(action?.timeMode).toBe("NONE");
  expect(action?.startTime || "").toBe("");
  expect(action?.oneOffDate || "").toBe("");
  expect(Array.isArray(action?.timeSlots) ? action.timeSlots : []).toEqual([]);
  expect(action?.schedule?.timeMode || "").not.toBe("FIXED");
  expect(action?.reminderTime || "").toBe("");
  expect(Array.isArray(action?.schedule?.timeSlots) ? action.schedule.timeSlots : []).toEqual([]);
  expect(action?.schedule?.windowStart || "").toBe("");
  expect(action?.schedule?.windowEnd || "").toBe("");
  expect(actionOccurrences.length).toBeGreaterThan(0);
  expect(actionOccurrences.every((o) => o?.noTime === true || o?.start === "00:00")).toBeTruthy();

  await assertCreatedContentAcrossApp(page, {
    categoryName: "Business",
    titles: [title],
    expectedDateKey: todayKey,
  });

  const persistedPage = await page.context().newPage();
  await persistedPage.goto("/");
  const persisted = await getState(persistedPage);
  const persistedAction = persisted.goals.find((g) => g.title === title);
  expect(persistedAction?.timeMode || "").not.toBe("FIXED");
  expect(persistedAction?.startTime || "").toBe("");
  expect(Array.isArray(persistedAction?.timeSlots) ? persistedAction.timeSlots : []).toEqual([]);
  expect(persistedAction?.schedule?.timeMode || "").not.toBe("FIXED");
  const persistedOccurrences = (persisted.occurrences || []).filter((o) => o?.goalId === persistedAction?.id);
  expect(persistedOccurrences.every((o) => o?.noTime === true || o?.start === "00:00")).toBeTruthy();
  await persistedPage.close();
});

test("Calendrier mois: anti-décalage fin de mois vers mois suivant", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  state.ui.selectedDate = "2026-02-10";
  state.ui.selectedDateKey = "2026-02-10";
  state.goals = [
    {
      id: "goal_month_boundary",
      categoryId: BUSINESS_ID,
      title: "E2E Frontière Mois",
      type: "PROCESS",
      planType: "ONE_OFF",
      status: "active",
      oneOffDate: "2026-02-28",
      timeMode: "NONE",
    },
  ];
  state.occurrences = [
    {
      id: "occ_feb_28",
      goalId: "goal_month_boundary",
      date: "2026-02-28",
      start: "00:00",
      slotKey: "00:00",
      status: "planned",
      noTime: true,
    },
    {
      id: "occ_mar_01",
      goalId: "goal_month_boundary",
      date: "2026-03-01",
      start: "00:00",
      slotKey: "00:00",
      status: "planned",
      noTime: true,
    },
  ];
  await seedState(page, state);

  await page.goto("/");
  await openTabToday(page);
  await page.locator("[data-tour-id=\"today-calendar-month\"]").click();
  await expect(page.locator(".calendarMonthTitle").first()).toContainText(/f[eé]vrier 2026/i);

  await expectMonthCellPlannedCount(page, "2026-02-28", 1);
  await expect(page.locator(`[data-tour-id="today-calendar-month-grid"] [data-datekey="2026-03-01"]`)).toHaveCount(0);
  await expectMonthCellPlannedCount(page, "2026-02-27", 0);
  const febCells = page.locator(`[data-tour-id="today-calendar-month-grid"] .calendarMonthCell[data-datekey]`);
  await expect(febCells).toHaveCount(28);
  const febKeys = await febCells.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-datekey") || ""));
  expect(febKeys.every((key) => /^2026-02-\d{2}$/.test(key))).toBeTruthy();
  const febDayNumbers = await febCells.locator(".calendarMonthDay").allTextContents();
  expect(
    febDayNumbers.every((text) => {
      const day = Number(text.trim());
      return Number.isInteger(day) && day >= 1 && day <= 28;
    })
  ).toBeTruthy();
  const placeholderWithData = page.locator(
    `[data-tour-id="today-calendar-month-grid"] .calendarMonthCellPlaceholder[data-datekey], ` +
      `[data-tour-id="today-calendar-month-grid"] .calendarMonthCellPlaceholder[data-planned], ` +
      `[data-tour-id="today-calendar-month-grid"] .calendarMonthCellPlaceholder[data-done]`
  );
  await expect(placeholderWithData).toHaveCount(0);
  const placeholderTexts = await page
    .locator(`[data-tour-id="today-calendar-month-grid"] .calendarMonthCellPlaceholder`)
    .allTextContents();
  expect(placeholderTexts.every((text) => !/\d/.test(text))).toBeTruthy();

  await page
    .locator('.calendarMonthHeader button[aria-label="Mois suivant"]')
    .first()
    .click();
  await expect(page.locator(".calendarMonthTitle").first()).toContainText(/mars 2026/i);
  await expectMonthCellPlannedCount(page, "2026-03-01", 1);
  await expect(page.locator(`[data-tour-id="today-calendar-month-grid"] [data-datekey="2026-02-28"]`)).toHaveCount(0);
  await expectMonthCellPlannedCount(page, "2026-03-02", 0);

  await page
    .locator(`[data-tour-id="today-calendar-month-grid"] [data-datekey="2026-03-01"]`)
    .first()
    .click();
  await page.locator("[data-tour-id=\"today-calendar-day\"]").click();

  const dayCell = page.locator(`[data-tour-id="today-calendar-rail"] [data-datekey="2026-03-01"]`).first();
  const dayNeighborCell = page.locator(`[data-tour-id="today-calendar-rail"] [data-datekey="2026-03-02"]`).first();
  await expect(dayCell).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => plannedCount(dayCell)).toBe(1);
  await expect.poll(async () => plannedCount(dayNeighborCell)).toBe(0);
});

test("CategoryGate: désactivation non vide avec migration vers Général", async ({ page }) => {
  const state = buildBaseState({ withContent: false });
  await seedState(page, state);

  const title = "E2E Action à migrer";

  await page.goto("/");
  await createOneOffAction(page, { title });

  await page.getByTestId("create-plus-button").click();
  await expect(page.getByTestId("category-gate-modal")).toBeVisible();
  await page.getByTestId(`category-toggle-${BUSINESS_ID}`).click();
  await expect(page.getByTestId("category-gate-confirm")).toBeVisible();
  await page.getByTestId("category-confirm-migrate").click();
  await page.getByTestId("category-gate-modal").getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByTestId("category-gate-modal")).toBeHidden();

  const next = await getState(page);
  const migrated = next.goals.find((g) => g.title === title);
  expect(migrated?.categoryId).toBe(INBOX_ID);
  expect(next.categories.some((c) => c.id === BUSINESS_ID)).toBeFalsy();
  expect(next.ui?.selectedCategoryId).toBe(INBOX_ID);
  expect(next.ui?.librarySelectedCategoryId).not.toBe(BUSINESS_ID);
  expect(next.ui?.selectedCategoryByView?.home).not.toBe(BUSINESS_ID);
  expect(next.ui?.selectedCategoryByView?.library).not.toBe(BUSINESS_ID);
  expect(next.ui?.selectedCategoryByView?.pilotage).not.toBe(BUSINESS_ID);

  await openTabLibrary(page);
  const list = page.locator("[data-tour-id=\"library-category-list\"]");
  await expect(list.getByText("Business", { exact: true })).toHaveCount(0);
  await expect(page.locator(".categoryRailScroll").getByRole("button", { name: "Business", exact: true })).toHaveCount(0);
  const activeRail = page.locator(".categoryRailScroll .navBtnActive");
  await expect(activeRail).toContainText("Général");
  await list.getByText("Général", { exact: true }).first().click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  const persistedPage = await page.context().newPage();
  await persistedPage.goto("/");
  await openTabLibrary(persistedPage);
  const reloadedList = persistedPage.locator("[data-tour-id=\"library-category-list\"]");
  await expect(reloadedList.getByText("Business", { exact: true })).toHaveCount(0);
  const generalCard = reloadedList.locator(".accentItem").filter({ hasText: "Général" }).first();
  await expect(generalCard).toBeVisible();
  await expect(generalCard).not.toContainText("Aucun élément");
  await persistedPage.close();
});
