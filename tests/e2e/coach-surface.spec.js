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

function buildCoachProposalState() {
  const state = buildBaseState({ withContent: true });
  const today = state.ui?.selectedDate || new Date().toISOString().slice(0, 10);
  const messages = [
    {
      role: "assistant",
      text: "Je te propose un plan concret pour aujourd'hui.",
      createdAt: "2026-04-07T11:00:00.000Z",
      coachReply: {
        kind: "conversation",
        mode: "plan",
        message: "Je te propose un plan concret pour aujourd'hui.",
        proposal: {
          kind: "assistant",
          categoryDraft: {
            mode: "existing",
            id: "cat_business",
            label: "Business",
          },
          outcomeDraft: {
            title: "Lancer la nouvelle page d'accueil",
          },
          actionDrafts: [
            {
              title: "Finaliser la section hero",
              oneOffDate: today,
              startTime: "10:00",
            },
            {
              title: "Vérifier le CTA principal",
              oneOffDate: today,
              startTime: "11:00",
            },
          ],
          unresolvedQuestions: ["Quel créneau veux-tu protéger ?"],
          requiresValidation: true,
        },
      },
    },
  ];

  state.coach_conversations_v1 = appendCoachConversationMessages(null, {
    messages,
    contextSnapshot: { activeCategoryId: "cat_business", dateKey: today },
    mode: "plan",
  }).state;

  return state;
}

async function attachScreenshot(page, testInfo, name) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function openCoach(page, state) {
  await seedState(page, state);
  await page.goto("/");
  await page.getByRole("button", { name: "Coach" }).click();
  await expect(page.getByText("Ton copilote stratégique")).toBeVisible();
}

async function collectBubbleAudit(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".lovableCoachBubble")).map((bubble) => {
      const textNode = bubble.querySelector(".coachSurfaceMessageText, .lovableCoachText");
      const bubbleStyles = window.getComputedStyle(bubble);
      const textStyles = textNode ? window.getComputedStyle(textNode) : null;
      return {
        text: textNode?.textContent?.trim() || "",
        bubbleClientHeight: bubble.clientHeight,
        bubbleScrollHeight: bubble.scrollHeight,
        bubbleOverflow: bubbleStyles.overflow,
        color: textStyles?.color || "",
        opacity: Number(textStyles?.opacity || "0"),
        visibility: textStyles?.visibility || "",
        display: textStyles?.display || "",
        fontSize: Number.parseFloat(textStyles?.fontSize || "0"),
        lineHeight: textStyles?.lineHeight || "",
      };
    })
  );
}

test("coach structure remains stable and text is visible at open", async ({ page }, testInfo) => {
  await openCoach(page, buildCoachConversationState());

  await expect(page.locator(".lovableCoachComposerWrap")).toBeVisible();
  await expect(page.locator(".lovableCoachTextarea")).toBeVisible();
  await expect(page.locator(".coachSurfaceComposerPlus")).toBeVisible();
  await expect(page.getByText("Finaliser la page d'accueil.")).toBeVisible();
  await expect(page.getByText("Bien. Commence par la section hero puis verrouille le CTA principal.")).toBeVisible();

  const openMetrics = await page.evaluate(() => {
    const composerCard = document.querySelector(".lovableCoachComposer")?.getBoundingClientRect();
    const viewport = document.querySelector(".lovableCoachMessages")?.getBoundingClientRect();
    const tabBar = document.querySelector(".lovableTabBarWrap")?.getBoundingClientRect();
    return {
      windowScrollY: window.scrollY,
      composerCardTop: composerCard?.top ?? -1,
      composerCardBottom: composerCard?.bottom ?? -1,
      viewportTop: viewport?.top ?? -1,
      viewportBottom: viewport?.bottom ?? -1,
      viewportHeight: window.innerHeight,
      tabBarTop: tabBar?.top ?? -1,
    };
  });
  const bubbleAudit = await collectBubbleAudit(page);

  expect(openMetrics.windowScrollY).toBe(0);
  expect(openMetrics.composerCardTop).toBeGreaterThan(openMetrics.viewportTop);
  expect(openMetrics.composerCardBottom).toBeLessThanOrEqual(openMetrics.viewportHeight);
  expect(openMetrics.composerCardBottom).toBeLessThanOrEqual(openMetrics.tabBarTop);
  expect(bubbleAudit.length).toBeGreaterThan(0);
  expect(bubbleAudit.every((entry) => entry.text.length > 0)).toBe(true);
  expect(bubbleAudit.every((entry) => entry.visibility === "visible")).toBe(true);
  expect(bubbleAudit.every((entry) => entry.display !== "none")).toBe(true);
  expect(bubbleAudit.every((entry) => entry.opacity > 0)).toBe(true);
  expect(bubbleAudit.every((entry) => entry.fontSize > 0)).toBe(true);
  expect(bubbleAudit.every((entry) => entry.lineHeight !== "")).toBe(true);
  expect(bubbleAudit.every((entry) => entry.color !== "rgba(0, 0, 0, 0)")).toBe(true);
  expect(bubbleAudit.every((entry) => entry.bubbleScrollHeight <= entry.bubbleClientHeight + 2)).toBe(true);

  await attachScreenshot(page, testInfo, "coach-open-bottom.png");
  await attachScreenshot(page, testInfo, "coach-text-visible-mixed.png");
  await attachScreenshot(page, testInfo, "coach-composer-plus.png");
  await attachScreenshot(page, testInfo, "coach-text-visible-assistant.png");
  await attachScreenshot(page, testInfo, "coach-text-visible-user.png");

  const headerBefore = await page.locator(".pageHeader").boundingBox();
  await page.locator(".lovableCoachMessages").evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.waitForTimeout(120);

  const headerAfter = await page.locator(".pageHeader").boundingBox();
  const scrolledMetrics = await page.evaluate(() => ({
    windowScrollY: window.scrollY,
    messageScrollTop: document.querySelector(".lovableCoachMessages")?.scrollTop ?? -1,
  }));

  expect(headerBefore?.y).toBeCloseTo(headerAfter?.y ?? -1, 1);
  expect(scrolledMetrics.windowScrollY).toBe(0);
  expect(scrolledMetrics.messageScrollTop).toBe(0);
  await attachScreenshot(page, testInfo, "coach-scrolled-history.png");
});

test("coach proposal card stays readable with assistant text", async ({ page }, testInfo) => {
  await openCoach(page, buildCoachProposalState());

  await expect(page.getByText("Je te propose un plan concret pour aujourd'hui.")).toBeVisible();
  await expect(page.getByText("Plan proposé")).toBeVisible();
  await expect(page.getByText("Finaliser la section hero •")).toBeVisible();
  await attachScreenshot(page, testInfo, "coach-text-visible-proposal.png");
});

test("coach plus menu triggers structurer without moving layout", async ({ page }, testInfo) => {
  await openCoach(page, buildCoachConversationState());

  const composerBeforeMenu = await page.locator(".lovableCoachComposer").boundingBox();
  const textareaBeforeMenu = await page.locator(".lovableCoachTextarea").boundingBox();
  await page.locator(".coachSurfaceComposerPlus").click();

  await expect(page.getByRole("menu", { name: "Intentions du coach" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Structurer/i })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /Créer vite/i })).toBeVisible();
  await attachScreenshot(page, testInfo, "coach-plus-menu-open.png");

  const composerAfterMenu = await page.locator(".lovableCoachComposer").boundingBox();
  expect(composerAfterMenu?.height).toBeCloseTo(composerBeforeMenu?.height ?? 0, 1);
  expect(composerAfterMenu?.y).toBeCloseTo(composerBeforeMenu?.y ?? 0, 1);
  expect(textareaBeforeMenu?.width ?? 0).toBeGreaterThan(180);

  await page.getByRole("menuitem", { name: /Structurer/i }).click();
  await expect(page.locator(".lovableCoachTextarea")).toHaveValue(
    "Aide-moi à structurer ce que je veux faire avancer."
  );
  await attachScreenshot(page, testInfo, "coach-plus-structurer-focus.png");

  await page.locator(".lovableCoachTextarea").focus();
  await page.evaluate(() => {
    document.documentElement.classList.add("keyboardOpen");
  });
  await attachScreenshot(page, testInfo, "coach-keyboard-open.png");
  await page.evaluate(() => {
    document.documentElement.classList.remove("keyboardOpen");
  });
});

test("coach plus menu triggers quick create without changing page", async ({ page }, testInfo) => {
  await openCoach(page, buildCoachConversationState());

  await page.locator(".coachSurfaceComposerPlus").click();
  await page.getByRole("menuitem", { name: /Créer vite/i }).click();
  await expect(page.locator(".lovableCoachTextarea")).toHaveValue(
    "Aide-moi à transformer vite cette intention en brouillon concret."
  );
  await attachScreenshot(page, testInfo, "coach-plus-quick-create-focus.png");
});

test("coach empty state still shows intro and composer immediately", async ({ page }, testInfo) => {
  await openCoach(page, buildBaseState({ withContent: true }));

  await expect(page.locator(".lovableCoachIntro")).toBeVisible();
  await expect(page.locator(".lovableCoachComposerWrap")).toBeVisible();
  await attachScreenshot(page, testInfo, "coach-empty-open.png");
});
