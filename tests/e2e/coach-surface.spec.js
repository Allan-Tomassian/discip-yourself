import { test, expect, devices } from "@playwright/test";
import { appendCoachConversationMessages } from "../../src/features/coach/coachStorage.js";
import { buildBaseState, seedState } from "./utils/seed.js";

const iPhone13 = devices["iPhone 13"];

test.use({
  viewport: iPhone13.viewport,
  userAgent: iPhone13.userAgent,
  deviceScaleFactor: iPhone13.deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
});

function buildCoachConversationState() {
  const state = buildBaseState({ withContent: true });
  const today = state.ui?.selectedDate || new Date().toISOString().slice(0, 10);
  const messages = [
    {
      role: "assistant",
      text: "Bonjour toi. Je suis ton coach IA pour t'aider a rester clair, concentre et en mouvement.",
      createdAt: "2026-04-07T09:00:00.000Z",
    },
    {
      role: "user",
      text: "Bonjour",
      createdAt: "2026-04-07T09:01:00.000Z",
    },
    {
      role: "assistant",
      text: "Je peux t'aider a clarifier un bloc, arbitrer une hesitation ou recadrer un prochain pas.",
      createdAt: "2026-04-07T09:02:00.000Z",
    },
    {
      role: "user",
      text: "Je dois avancer sur le lancement.",
      createdAt: "2026-04-07T09:03:00.000Z",
    },
    {
      role: "assistant",
      text: "Quel est le prochain livrable concret a sortir aujourd'hui ?",
      createdAt: "2026-04-07T09:04:00.000Z",
    },
    {
      role: "user",
      text: "Finaliser la page d'accueil.",
      createdAt: "2026-04-07T09:05:00.000Z",
    },
    {
      role: "assistant",
      text: "Bien. Commence par la section hero puis verrouille le CTA principal.",
      createdAt: "2026-04-07T09:06:00.000Z",
    },
  ];

  state.coach_conversations_v1 = appendCoachConversationMessages(null, {
    messages,
    contextSnapshot: { activeCategoryId: "cat_business", dateKey: today },
    mode: "free",
  }).state;

  return state;
}

async function attachScreenshot(page, testInfo, name) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test("coach surface keeps the composer visible at open and only scrolls the message viewport", async ({ page }, testInfo) => {
  await seedState(page, buildCoachConversationState());
  await page.goto("/");
  await page.getByRole("button", { name: "Coach" }).click();

  await expect(page.getByText("Ton copilote stratégique")).toBeVisible();
  await expect(page.locator(".lovableCoachComposerWrap")).toBeVisible();
  await expect(page.locator(".lovableCoachTextarea")).toBeVisible();

  const openMetrics = await page.evaluate(() => {
    const shell = document.querySelector('[data-page-id="coach"]')?.getBoundingClientRect();
    const container = document.querySelector('[data-page-id="coach"] .container')?.getBoundingClientRect();
    const pageContent = document.querySelector('[data-page-id="coach"] .pageContent')?.getBoundingClientRect();
    const coachPage = document.querySelector(".lovableCoachPage")?.getBoundingClientRect();
    const composerCard = document.querySelector(".lovableCoachComposer")?.getBoundingClientRect();
    const composer = document.querySelector(".lovableCoachComposerWrap")?.getBoundingClientRect();
    const tabBar = document.querySelector(".lovableTabBarWrap")?.getBoundingClientRect();
    const viewport = document.querySelector(".lovableCoachMessages")?.getBoundingClientRect();
    return {
      windowScrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      shellTop: shell?.top ?? -1,
      shellBottom: shell?.bottom ?? -1,
      containerTop: container?.top ?? -1,
      containerBottom: container?.bottom ?? -1,
      pageContentTop: pageContent?.top ?? -1,
      pageContentBottom: pageContent?.bottom ?? -1,
      coachPageTop: coachPage?.top ?? -1,
      coachPageBottom: coachPage?.bottom ?? -1,
      composerCardTop: composerCard?.top ?? -1,
      composerCardBottom: composerCard?.bottom ?? -1,
      composerTop: composer?.top ?? -1,
      composerBottom: composer?.bottom ?? -1,
      viewportTop: viewport?.top ?? -1,
      viewportBottom: viewport?.bottom ?? -1,
      tabBarTop: tabBar?.top ?? -1,
    };
  });

  await attachScreenshot(page, testInfo, "coach-open.png");
  expect(openMetrics.windowScrollY).toBe(0);
  expect(openMetrics.composerCardTop).toBeGreaterThan(openMetrics.viewportTop);
  expect(openMetrics.composerCardBottom).toBeLessThanOrEqual(openMetrics.viewportHeight);
  expect(openMetrics.composerCardBottom).toBeLessThanOrEqual(openMetrics.tabBarTop);

  const headerBefore = await page.locator(".pageHeader").boundingBox();
  await page.locator(".lovableCoachMessages").evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.waitForTimeout(100);

  const headerAfter = await page.locator(".pageHeader").boundingBox();
  const scrolledMetrics = await page.evaluate(() => ({
    windowScrollY: window.scrollY,
    messageScrollTop: document.querySelector(".lovableCoachMessages")?.scrollTop ?? -1,
  }));

  expect(headerBefore?.y).toBeCloseTo(headerAfter?.y ?? -1, 1);
  expect(scrolledMetrics.windowScrollY).toBe(0);
  expect(scrolledMetrics.messageScrollTop).toBe(0);
  await attachScreenshot(page, testInfo, "coach-scrolled-top.png");
});

test("coach empty state still shows the composer immediately", async ({ page }, testInfo) => {
  await seedState(page, buildBaseState({ withContent: true }));
  await page.goto("/");
  await page.getByRole("button", { name: "Coach" }).click();

  await expect(page.locator(".lovableCoachIntro")).toBeVisible();
  await expect(page.locator(".lovableCoachComposerWrap")).toBeVisible();
  await attachScreenshot(page, testInfo, "coach-empty-open.png");
});
