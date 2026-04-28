import { test, expect, devices } from "@playwright/test";
import { appendCoachConversationMessages } from "../../src/features/coach/coachStorage.js";
import { buildLocalUserDataKey } from "../../src/data/userDataApi.js";
import { LS_KEY } from "../../src/utils/storage.js";
import { buildBaseState, seedState } from "./utils/seed.js";

const iPhone13 = devices["iPhone 13"];
const E2E_USER_DATA_KEY = buildLocalUserDataKey("e2e-user-id");

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

function buildCoachCreatedProposalState() {
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
            id: "cat_sport",
            label: "Sport",
          },
          actionDrafts: [
            {
              title: "Séance de sport rapide de 20 minutes",
              oneOffDate: today,
              startTime: "19:00",
              durationMinutes: 20,
            },
          ],
          primaryActionRef: { index: 0 },
          sessionBlueprintDraft: {
            protocolType: "sport",
            why: "activer ton énergie et tenir le rythme",
            firstStep: "commence par 3 min d’échauffement",
            ifBlocked: "fais la version courte",
            successDefinition: "séance tenue ou version courte assumée",
            estimatedMinutes: 20,
          },
          unresolvedQuestions: [],
          requiresValidation: true,
        },
        createStatus: "created",
        createMessage: "",
        viewTarget: {
          type: "library-focus",
          categoryId: "cat_sport",
          section: "actions",
          outcomeId: null,
          actionIds: ["goal_sport_1"],
        },
      },
    },
  ];

  state.coach_conversations_v1 = appendCoachConversationMessages(null, {
    messages,
    contextSnapshot: { activeCategoryId: "cat_sport", dateKey: today },
    mode: "plan",
    planningState: {
      mode: "plan",
      entryPoint: "manual_reentry",
      intent: "quick_create",
      autoActivation: "allowed",
    },
  }).state;

  return state;
}

function buildFreeConversationReply() {
  return {
    kind: "conversation",
    mode: "free",
    decisionSource: "rules",
    message: "Commence par nommer le prochain pas concret à fermer aujourd'hui.",
    primaryAction: null,
    secondaryAction: null,
    proposal: null,
    meta: {
      coachVersion: "v1",
      requestId: "req_free_pending",
      selectedDateKey: "2026-04-10",
      activeCategoryId: "cat_business",
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Clarifier mon prochain pas",
    },
  };
}

function buildPlanConversationReply(today) {
  return {
    kind: "conversation",
    mode: "plan",
    decisionSource: "rules",
    message: "Je te propose un plan concret pour aujourd'hui.",
    primaryAction: null,
    secondaryAction: null,
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
      unresolvedQuestions: [],
      requiresValidation: true,
    },
    meta: {
      coachVersion: "v1",
      requestId: "req_plan_pending",
      selectedDateKey: today,
      activeCategoryId: "cat_business",
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Aide-moi à structurer ce que je veux faire avancer.",
    },
  };
}

async function installDelayedCoachReply(page, responseBody, { delayMs = 1800 } = {}) {
  await page.addInitScript(() => {
    globalThis.process = globalThis.process || {};
    globalThis.process.env = {
      ...(globalThis.process.env || {}),
      VITE_AI_BACKEND_URL: globalThis.location.origin,
    };
  });

  await page.route("**/ai/chat", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseBody),
    });
  });
}

async function readPersistedCoachMessages(page) {
  return page.evaluate(
    ({ lsKey, userDataKey }) => {
      const parse = (key) => {
        try {
          return JSON.parse(localStorage.getItem(key) || "null");
        } catch {
          return null;
        }
      };
      const userScoped = parse(userDataKey);
      const localScoped = parse(lsKey);
      const source =
        userScoped?.coach_conversations_v1?.conversations?.length
          ? userScoped
          : localScoped?.coach_conversations_v1?.conversations?.length
            ? localScoped
            : userScoped || localScoped || {};
      const conversations = Array.isArray(source?.coach_conversations_v1?.conversations)
        ? source.coach_conversations_v1.conversations
        : [];
      const activeConversation = conversations[0] || null;
      const messages = Array.isArray(activeConversation?.messages) ? activeConversation.messages : [];
      return {
        conversationCount: conversations.length,
        totalMessages: messages.length,
        assistantMessages: messages.filter((message) => message?.role === "assistant").length,
        userMessages: messages.filter((message) => message?.role === "user").length,
      };
    },
    { lsKey: LS_KEY, userDataKey: E2E_USER_DATA_KEY }
  );
}

async function attachScreenshot(page, testInfo, name) {
  const path = testInfo.outputPath(name);
  await page.screenshot({ path, fullPage: false });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function openCoach(page, state) {
  await seedState(page, state);
  await page.goto("/");
  await page.getByRole("button", { name: "Coach IA" }).click();
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
  await expect(page.getByText("Lecture des catégories")).toHaveCount(0);

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
  await expect(page.getByText("Séance type")).toBeVisible();
  await expect(page.getByText(/Cap ·/)).toBeVisible();
  await expect(page.getByText("Finaliser la section hero •")).toBeVisible();
  await expect(page.getByText("Lecture des catégories")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "coach-text-visible-proposal.png");
});

test("coach created proposal stays the single success surface", async ({ page }, testInfo) => {
  await openCoach(page, buildCoachCreatedProposalState());

  await expect(page.getByText("Plan créé")).toBeVisible();
  await expect(page.getByRole("button", { name: "Voir dans l’app" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Valider" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Modifier" })).toHaveCount(0);
  await expect(page.getByText("Créé dans l’app.")).toHaveCount(0);
  await expect(page.getByText("Créé dans Sport.")).toHaveCount(0);
  await expect(page.getByText("Lecture des catégories")).toHaveCount(0);
  expect(await page.locator(".lovableCoachBubble.is-assistant").count()).toBe(1);
  await attachScreenshot(page, testInfo, "coach-success-single-surface.png");
});

test("coach free mode shows a non-persisted pending bubble", async ({ page }, testInfo) => {
  await installDelayedCoachReply(page, buildFreeConversationReply());
  await openCoach(page, buildBaseState({ withContent: true }));

  await page.locator(".lovableCoachTextarea").fill("Clarifie mon prochain pas.");
  await page.evaluate(() => {
    document.querySelector(".lovableCoachComposerSend")?.click();
  });
  await expect(page.locator(".lovableCoachTextarea")).toHaveValue("");
  await expect(page.locator(".lovableCoachBubble.is-user").last()).toContainText("Clarifie mon prochain pas.");

  await expect(page.locator(".coachSurfacePending--free")).toBeVisible();
  await expect(page.locator(".coachSurfacePending--free .coachSurfacePendingLabel")).toHaveCount(0);
  await expect(page.locator(".coachSurfacePending--free .coachSurfacePendingDot")).toHaveCount(3);
  await expect(page.getByText("Lecture des catégories")).toHaveCount(0);
  await expect(page.getByText("Chargement")).toHaveCount(0);
  await expect(page.getByText("Je réfléchis")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "coach-free-pending.png");

  await expect(page.getByText("Commence par nommer le prochain pas concret à fermer aujourd'hui.")).toBeVisible();
  await expect(page.locator(".coachSurfacePending")).toHaveCount(0);
  expect(await readPersistedCoachMessages(page)).toMatchObject({
    assistantMessages: 1,
    userMessages: 1,
  });
});

test("coach plan mode shows a pending plan state without persisting it", async ({ page }, testInfo) => {
  const state = buildBaseState({ withContent: true });
  const today = state.ui?.selectedDate || new Date().toISOString().slice(0, 10);
  await installDelayedCoachReply(page, buildPlanConversationReply(today));
  await openCoach(page, state);

  await page.locator(".coachSurfaceComposerPlus").click();
  await page.getByRole("menuitem", { name: /Structurer/i }).click();
  await expect(page.getByText("Plan actif")).toBeVisible();
  await page.evaluate(() => {
    document.querySelector(".lovableCoachComposerSend")?.click();
  });
  await expect(page.locator(".lovableCoachTextarea")).toHaveValue("");
  await expect(page.locator(".lovableCoachBubble.is-user").last()).toContainText(
    "Aide-moi à structurer ce que je veux faire avancer."
  );

  await expect(page.locator(".coachSurfacePending--plan")).toBeVisible();
  await expect(page.getByText("Préparation du plan")).toBeVisible();
  await expect(page.locator(".coachSurfacePending--plan .coachSurfacePendingDot")).toHaveCount(3);
  await expect(page.getByText("Lecture des catégories")).toHaveCount(0);
  await expect(page.getByText("Chargement")).toHaveCount(0);
  await expect(page.getByText("Je réfléchis")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "coach-plan-pending.png");

  await expect(page.getByText("Plan proposé")).toBeVisible();
  await expect(page.locator(".coachSurfacePending")).toHaveCount(0);
  await attachScreenshot(page, testInfo, "coach-plan-pending-clean.png");
  expect(await readPersistedCoachMessages(page)).toMatchObject({
    assistantMessages: 1,
    userMessages: 1,
  });
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
  await expect(page.getByText("Plan actif")).toBeVisible();
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
  await expect(page.getByText("Plan actif")).toBeVisible();
  await attachScreenshot(page, testInfo, "coach-plus-quick-create-focus.png");
});

test("coach plan pill stays stable above the composer without moving the header", async ({ page }, testInfo) => {
  await openCoach(page, buildCoachConversationState());

  await page.locator(".coachSurfaceComposerPlus").click();
  await page.getByRole("menuitem", { name: /Structurer/i }).click();
  await expect(page.getByText("Plan actif")).toBeVisible();

  const headerBefore = await page.locator(".pageHeader").boundingBox();
  await expect(page.getByRole("button", { name: "Fermer le mode plan" })).toBeVisible();
  const headerAfter = await page.locator(".pageHeader").boundingBox();

  expect(headerBefore?.y).toBeCloseTo(headerAfter?.y ?? -1, 1);
  await attachScreenshot(page, testInfo, "coach-plan-pill-stable.png");
});

test("coach empty state still shows intro and composer immediately", async ({ page }, testInfo) => {
  await openCoach(page, buildBaseState({ withContent: true }));

  await expect(page.locator(".lovableCoachIntro")).toBeVisible();
  await expect(page.locator(".lovableCoachComposerWrap")).toBeVisible();
  await attachScreenshot(page, testInfo, "coach-empty-open.png");
});
