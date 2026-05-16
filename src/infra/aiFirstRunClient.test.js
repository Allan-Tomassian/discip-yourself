import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAiFirstRunWhyClarificationRequest,
  DEFAULT_AI_FIRST_RUN_WHY_CLARIFICATION_TIMEOUT_MS,
  buildAiFirstRunStarterHintsRequest,
  DEFAULT_AI_FIRST_RUN_STARTER_HINTS_TIMEOUT_MS,
  buildAiFirstRunPlanRequest,
  DEFAULT_AI_FIRST_RUN_TIMEOUT_MS,
  isAiFirstRunStarterHintsResponse,
  isAiFirstRunWhyClarificationResponse,
  normalizeAiFirstRunStarterHintsPayloadForTest,
  normalizeAiFirstRunWhyClarificationPayloadForTest,
  normalizeAiFirstRunPayloadForTest,
  requestAiFirstRunStarterHints,
  requestAiFirstRunWhyClarification,
  requestAiFirstRunPlan,
} from "./aiFirstRunClient";
import { resetAiBackendWarmupStateForTests } from "./aiBackendWarmup";

const VALID_RESPONSE = {
  version: 2,
  source: "ai_backend",
  inputHash: "hash-first-run",
  generatedAt: "2026-04-19T08:00:00.000Z",
  requestId: "req-first-run",
  model: "gpt-5.4",
  promptVersion: "first_run_plan_v1",
  plans: [
    {
      id: "tenable",
      variant: "tenable",
      title: "Plan tenable",
      summary: "Une semaine tenable dès le départ.",
      comparisonMetrics: {
        weeklyMinutes: 150,
        totalBlocks: 5,
        activeDays: 4,
        recoverySlots: 3,
        dailyDensity: "respirable",
        engagementLevel: "tenable",
      },
      categories: [{ id: "cat_health", label: "Santé", role: "primary", blockCount: 3 }],
      preview: [
        {
          dayKey: "2026-04-19",
          dayLabel: "DIM 19/04",
          slotLabel: "08:00 - 08:25",
          categoryId: "cat_health",
          categoryLabel: "Santé",
          title: "Marche active",
          minutes: 25,
        },
      ],
      todayPreview: [
        {
          dayKey: "2026-04-19",
          dayLabel: "DIM 19/04",
          slotLabel: "08:00 - 08:25",
          categoryId: "cat_health",
          categoryLabel: "Santé",
          title: "Marche active",
          minutes: 25,
        },
      ],
      rationale: {
        whyFit: "Le plan protège l'élan.",
        capacityFit: "La charge reste respirable.",
        constraintFit: "Les indisponibilités sont respectées.",
      },
      commitDraft: {
        version: 1,
        categories: [{ id: "cat_health", templateId: "health", name: "Santé", color: "#22c55e", order: 0 }],
        goals: [{ id: "goal_health", categoryId: "cat_health", title: "Retrouver de l'énergie", type: "OUTCOME", order: 0 }],
        actions: [
          {
            id: "action_walk",
            categoryId: "cat_health",
            parentGoalId: "goal_health",
            title: "Marche active",
            type: "PROCESS",
            order: 0,
            repeat: "weekly",
            daysOfWeek: [1, 3, 5],
            timeMode: "FIXED",
            startTime: "08:00",
            timeSlots: ["08:00"],
            durationMinutes: 25,
            sessionMinutes: 25,
          },
        ],
        occurrences: [{ id: "occ_walk_1", actionId: "action_walk", date: "2026-04-19", start: "08:00", durationMinutes: 25, status: "planned" }],
      },
    },
    {
      id: "ambitious",
      variant: "ambitious",
      title: "Plan ambitieux",
      summary: "Une semaine plus dense.",
      comparisonMetrics: {
        weeklyMinutes: 225,
        totalBlocks: 7,
        activeDays: 5,
        recoverySlots: 2,
        dailyDensity: "soutenue",
        engagementLevel: "ambitious",
      },
      categories: [{ id: "cat_health", label: "Santé", role: "primary", blockCount: 4 }],
      preview: [
        {
          dayKey: "2026-04-19",
          dayLabel: "DIM 19/04",
          slotLabel: "07:30 - 08:00",
          categoryId: "cat_health",
          categoryLabel: "Santé",
          title: "Marche active",
          minutes: 30,
        },
      ],
      todayPreview: [
        {
          dayKey: "2026-04-19",
          dayLabel: "DIM 19/04",
          slotLabel: "07:30 - 08:00",
          categoryId: "cat_health",
          categoryLabel: "Santé",
          title: "Marche active",
          minutes: 30,
        },
      ],
      rationale: {
        whyFit: "Le plan accélère dès la première semaine.",
        capacityFit: "La charge monte d'un cran.",
        constraintFit: "Les créneaux favorables sont exploités.",
      },
      commitDraft: {
        version: 1,
        categories: [{ id: "cat_health", templateId: "health", name: "Santé", color: "#22c55e", order: 0 }],
        goals: [{ id: "goal_health", categoryId: "cat_health", title: "Retrouver de l'énergie", type: "OUTCOME", order: 0 }],
        actions: [
          {
            id: "action_walk",
            categoryId: "cat_health",
            parentGoalId: "goal_health",
            title: "Marche active",
            type: "PROCESS",
            order: 0,
            repeat: "weekly",
            daysOfWeek: [1, 2, 3, 5, 6],
            timeMode: "FIXED",
            startTime: "07:30",
            timeSlots: ["07:30"],
            durationMinutes: 30,
            sessionMinutes: 30,
          },
        ],
        occurrences: [{ id: "occ_walk_2", actionId: "action_walk", date: "2026-04-19", start: "07:30", durationMinutes: 30, status: "planned" }],
      },
    },
  ],
};

const VALID_STARTER_HINTS_RESPONSE = {
  version: 1,
  source: "ai_starter_hints",
  inputHash: "hash-starter-hints",
  generatedAt: "2026-04-19T08:00:00.000Z",
  planStrategy: {
    planTitle: "Plan recommandé",
    summary: "Finir le parcours critique sans perdre le rythme.",
    weekGoal: "Finaliser l’application et tester l’entrée.",
    weekBenefit: "Une publication plus proche avec un système activable.",
    reasoningBullets: ["Le plan cible le parcours app.", "Les blocs évitent les horaires de travail."],
  },
  actionHints: [
    {
      id: "finish-first-access",
      categoryId: "business",
      title: "Finaliser le parcours First Access",
      purpose: "Terminer le parcours d’entrée.",
      outcomeLink: "Finir l’application",
      suggestedDurationMinutes: 45,
      cadence: "3x",
      priority: 5,
      preferredWindowTag: "morning",
      avoidWindowTags: ["work"],
      todayCandidate: true,
    },
    {
      id: "sport-light",
      categoryId: "health",
      title: "Séance sport légère",
      purpose: "Relancer la routine sportive.",
      outcomeLink: "Routine sportive",
      suggestedDurationMinutes: 25,
      cadence: "twice",
      priority: 3,
      preferredWindowTag: "evening",
      avoidWindowTags: ["work"],
      todayCandidate: false,
    },
  ],
  riskRituals: [
    {
      categoryId: "personal",
      title: "Revue anti-cigarette",
      durationMinutes: 5,
      trigger: "Envie de fumer",
      purpose: "Noter le déclencheur.",
    },
  ],
  ai: {
    status: "succeeded",
    missingInformation: [],
  },
};

const VALID_WHY_CLARIFICATION_RESPONSE = {
  version: 1,
  source: "ai_why_clarification",
  generatedAt: "2026-04-19T08:00:00.000Z",
  mode: "clarify",
  inspirationAxes: [
    { id: "project", label: "Projet", prompt: "Finir un projet important." },
    { id: "sport", label: "Sport", prompt: "Reprendre une routine sportive réaliste." },
  ],
  drafts: [
    {
      id: "draft_app_sport",
      title: "Projet et discipline",
      whyText:
        "Je veux publier mon application avant juin, reprendre une routine sportive réaliste et réduire les automatismes qui me freinent.",
    },
  ],
  clarification: {
    clarifiedWhy:
      "Je veux publier mon application avant juin, reprendre une routine sportive réaliste et réduire les automatismes qui me freinent.",
    primaryIntent: "Finir l’application",
    secondaryIntents: ["Reprendre le sport", "Réduire une mauvaise habitude"],
    frictions: ["Manque de constance", "Automatismes en fin de journée"],
    desiredIdentity: "Quelqu’un qui termine ce qu’il commence",
    executionRisks: ["Reporter les blocs difficiles", "Trop charger la semaine"],
    suggestedDomains: ["Business", "Santé", "Personnel"],
  },
  ai: {
    status: "succeeded",
    missingInformation: [],
  },
};

describe("aiFirstRunClient", () => {
  afterEach(() => {
    resetAiBackendWarmupStateForTests();
    vi.unstubAllGlobals();
  });

  it("normalise le payload first-run au submit en trimant le texte et en excluant les fenetres incomplètes", () => {
    expect(
      normalizeAiFirstRunPayloadForTest({
        whyText: "  Reprendre un cadre  ",
        primaryGoal: "  Relancer le projet  ",
        unavailableWindows: [
          { id: "u1", daysOfWeek: [1], startTime: "09:00", endTime: "", label: "  Travail  " },
          { id: "u2", daysOfWeek: [1, 1, 3], startTime: "09:00", endTime: "18:00", label: "  Bureau  " },
        ],
        preferredWindows: [
          { id: "p1", daysOfWeek: [2], startTime: "07:00", endTime: "08:00", label: "  Matin  " },
          { id: "p2", daysOfWeek: [4], startTime: "", endTime: "20:00", label: "  Soir  " },
        ],
        currentCapacity: "stable",
        priorityCategoryIds: ["business", "health"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      }),
    ).toEqual({
      whyText: "Reprendre un cadre",
      primaryGoal: "Relancer le projet",
      unavailableWindows: [{ id: "u2", daysOfWeek: [1, 3], startTime: "09:00", endTime: "18:00", label: "Bureau" }],
      preferredWindows: [{ id: "p1", daysOfWeek: [2], startTime: "07:00", endTime: "08:00", label: "Matin" }],
      currentCapacity: "stable",
      priorityCategoryIds: ["business", "health"],
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-04-19",
    });
  });

  it("construit un hash de payload stable", async () => {
    const left = await buildAiFirstRunPlanRequest({
      whyText: "Reprendre un cadre",
      primaryGoal: "Relancer le projet",
      currentCapacity: "stable",
      priorityCategoryIds: ["business"],
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-04-19",
    });
    const right = await buildAiFirstRunPlanRequest({
      whyText: "Reprendre un cadre",
      primaryGoal: "Relancer le projet",
      currentCapacity: "stable",
      priorityCategoryIds: ["business"],
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-04-19",
    });

    expect(left.inputHash).toBe(right.inputHash);
  });

  it("normalise le payload compact starter hints sans demander de commitDraft", async () => {
    const normalized = normalizeAiFirstRunStarterHintsPayloadForTest({
      whyText: "  Publier mon app  ",
      primaryGoal: "  Finir l’application  ",
      currentCapacity: "stable",
      priorityCategoryIds: ["business", "health", "unknown"],
      unavailableWindows: [{ id: "u1", daysOfWeek: [1], startTime: "09:30", endTime: "17:30", label: "Work" }],
      constraints: ["  Pas après 22h  ", "Pas après 22h"],
      contextPacks: [
        {
          type: "github",
          label: "Repo",
          summary: "Issues First Access à finir.",
          signals: ["signup", "first-run"],
          raw: "must-not-pass-through",
        },
      ],
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-04-19",
    });
    const request = await buildAiFirstRunStarterHintsRequest(normalized);

    expect(normalized).toEqual({
      whyText: "Publier mon app",
      primaryGoal: "Finir l’application",
      unavailableWindows: [{ id: "u1", daysOfWeek: [1], startTime: "09:30", endTime: "17:30", label: "Work" }],
      preferredWindows: [],
      currentCapacity: "stable",
      priorityCategoryIds: ["business", "health"],
      timezone: "Europe/Paris",
      locale: "fr-FR",
      referenceDateKey: "2026-04-19",
      constraints: ["Pas après 22h"],
      contextPacks: [
        {
          type: "github",
          label: "Repo",
          summary: "Issues First Access à finir.",
          signals: ["signup", "first-run"],
          updatedAt: "",
        },
      ],
    });
    expect(request.payload).not.toHaveProperty("commitDraft");
    expect(request.payload).not.toHaveProperty("occurrences");
  });

  it("validates the compact AI starter hints response shape", () => {
    expect(isAiFirstRunStarterHintsResponse(VALID_STARTER_HINTS_RESPONSE)).toBe(true);
    expect(isAiFirstRunStarterHintsResponse({ ...VALID_STARTER_HINTS_RESPONSE, commitDraft: {} })).toBe(true);
    expect(isAiFirstRunStarterHintsResponse({ ...VALID_STARTER_HINTS_RESPONSE, actionHints: [] })).toBe(false);
  });

  it("requests starter hints from the lightweight endpoint without backend warmup", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_STARTER_HINTS_RESPONSE,
    });

    const result = await requestAiFirstRunStarterHints({
      accessToken: "token",
      baseUrl: "https://ai.example.test",
      payload: {
        whyText: "Publier mon app",
        primaryGoal: "Finir l’application",
        currentCapacity: "stable",
        priorityCategoryIds: ["business", "health"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual(VALID_STARTER_HINTS_RESPONSE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://ai.example.test/ai/first-run-starter-hints");
    expect(fetchImpl.mock.calls[0][1].body).not.toContain("commitDraft");
    expect(fetchImpl.mock.calls[0][1].body).not.toContain("occurrences");
  });

  it("times out starter hints quickly so deterministic generation can continue", async () => {
    const fetchImpl = vi.fn((_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      })
    );

    const result = await requestAiFirstRunStarterHints({
      accessToken: "token",
      baseUrl: "https://ai.example.test",
      payload: {
        whyText: "Publier mon app",
        primaryGoal: "Finir l’application",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
      fetchImpl,
      timeoutMs: 1,
    });

    expect(DEFAULT_AI_FIRST_RUN_STARTER_HINTS_TIMEOUT_MS).toBe(8000);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("TIMEOUT");
  });

  it("normalise le payload compact why clarification", async () => {
    const normalized = normalizeAiFirstRunWhyClarificationPayloadForTest({
      version: 1,
      mode: "clarify",
      whyText: "  Publier mon app  ",
      locale: "fr-FR",
      timezone: "Europe/Paris",
      referenceDateKey: "2026-04-19",
      commitDraft: { should: "not pass" },
    });
    const request = await buildAiFirstRunWhyClarificationRequest(normalized);

    expect(normalized).toEqual({
      version: 1,
      mode: "clarify",
      whyText: "Publier mon app",
      timezone: "Europe/Paris",
      locale: "fr-FR",
      referenceDateKey: "2026-04-19",
    });
    expect(request.payload).not.toHaveProperty("commitDraft");
    expect(request.payload).not.toHaveProperty("occurrences");
    expect(request.payload).not.toHaveProperty("weekSchedule");
  });

  it("validates the AI why clarification response shape", () => {
    expect(isAiFirstRunWhyClarificationResponse(VALID_WHY_CLARIFICATION_RESPONSE)).toBe(true);
    expect(isAiFirstRunWhyClarificationResponse({ ...VALID_WHY_CLARIFICATION_RESPONSE, commitDraft: {} })).toBe(false);
    expect(
      isAiFirstRunWhyClarificationResponse({
        ...VALID_WHY_CLARIFICATION_RESPONSE,
        drafts: [{ id: "1", title: "A", whyText: "x" }, { id: "2", title: "B", whyText: "x" }, { id: "3", title: "C", whyText: "x" }, { id: "4", title: "D", whyText: "x" }],
      })
    ).toBe(false);
  });

  it("requests why clarification from the dedicated endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_WHY_CLARIFICATION_RESPONSE,
    });

    const result = await requestAiFirstRunWhyClarification({
      accessToken: "token",
      baseUrl: "https://ai.example.test",
      payload: {
        version: 1,
        mode: "clarify",
        whyText: "Publier mon app",
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual(VALID_WHY_CLARIFICATION_RESPONSE);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://ai.example.test/ai/first-run-why-clarification");
    expect(fetchImpl.mock.calls[0][1].body).not.toContain("commitDraft");
    expect(fetchImpl.mock.calls[0][1].body).not.toContain("occurrences");
  });

  it("maps why clarification auth and timeout failures", async () => {
    const authMissing = await requestAiFirstRunWhyClarification({
      accessToken: "",
      baseUrl: "https://ai.example.test",
      payload: {
        version: 1,
        mode: "inspiration",
        whyText: "",
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
      fetchImpl: vi.fn(),
    });
    expect(authMissing.ok).toBe(false);
    expect(authMissing.errorCode).toBe("AUTH_MISSING");

    const fetchImpl = vi.fn((_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      })
    );
    const timedOut = await requestAiFirstRunWhyClarification({
      accessToken: "token",
      baseUrl: "https://ai.example.test",
      payload: {
        version: 1,
        mode: "inspiration",
        whyText: "",
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
      fetchImpl,
      timeoutMs: 1,
    });

    expect(DEFAULT_AI_FIRST_RUN_WHY_CLARIFICATION_TIMEOUT_MS).toBe(8000);
    expect(timedOut.ok).toBe(false);
    expect(timedOut.errorCode).toBe("TIMEOUT");
  });

  it("envoie la requête backend first-run", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE",
        requestId: "req-first-run-backend-down",
      }),
    });

    await requestAiFirstRunPlan({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://ai.example.com/ai/first-run-plan");
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body || "{}").priorityCategoryIds).toEqual(["business"]);
  });

  it("préserve le code backend explicite pour un timeout provider", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({
        error: "FIRST_RUN_PLAN_PROVIDER_TIMEOUT",
        requestId: "req-first-run-timeout",
        message: "First run plan provider timed out.",
        details: { providerStatus: "timeout", timeoutMs: 45000 },
      }),
    });

    const result = await requestAiFirstRunPlan({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("TIMEOUT");
    expect(result.backendErrorCode).toBe("FIRST_RUN_PLAN_PROVIDER_TIMEOUT");
    expect(result.errorDetails).toEqual({ providerStatus: "timeout", timeoutMs: 45000 });
  });

  it("relève le budget frontend first-run pour rester compatible avec la route dédiée", () => {
    expect(DEFAULT_AI_FIRST_RUN_TIMEOUT_MS).toBe(60000);
  });

  it("mappe un timeout de transport frontend sur TIMEOUT", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    const fetchImpl = vi.fn().mockRejectedValue(abortError);

    const result = await requestAiFirstRunPlan({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("TIMEOUT");
    expect(result.requestId).toBe(null);
    expect(result.backendErrorCode).toBe(null);
  });

  it("rejette une réponse backend mal structurée", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...VALID_RESPONSE,
        plans: VALID_RESPONSE.plans.map((plan) => ({
          ...plan,
          commitDraft: null,
        })),
      }),
    });

    const result = await requestAiFirstRunPlan({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("INVALID_RESPONSE");
  });

  it("accepte une réponse backend valide avec commitDraft canonique", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => VALID_RESPONSE,
    });

    const result = await requestAiFirstRunPlan({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.payload?.plans?.[0]?.commitDraft?.categories?.[0]?.templateId).toBe("health");
  });

  it("reste compatible en lecture avec l'ancien shape occurrence.goalId", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ...VALID_RESPONSE,
        plans: VALID_RESPONSE.plans.map((plan) => ({
          ...plan,
          commitDraft: {
            ...plan.commitDraft,
            occurrences: plan.commitDraft.occurrences.map((occurrence) => ({
              ...occurrence,
              goalId: occurrence.actionId,
              actionId: undefined,
            })),
          },
        })),
      }),
    });

    const result = await requestAiFirstRunPlan({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("mappe un backend indisponible générique tout en conservant le backendErrorCode", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE",
        requestId: "req-first-run-backend-down",
      }),
    });

    const result = await requestAiFirstRunPlan({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("BACKEND_UNAVAILABLE");
    expect(result.backendErrorCode).toBe("FIRST_RUN_PLAN_BACKEND_UNAVAILABLE");
    expect(result.baseUrlUsed).toBe("https://ai.example.com");
  });

  it("réveille le backend avant la génération first-run dans le navigateur", async () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://test-discip-yourself.netlify.app",
        hostname: "test-discip-yourself.netlify.app",
      },
    });

    const fetchImpl = vi.fn().mockImplementation(async (url) => {
      if (String(url).endsWith("/health")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      }
      return {
        ok: false,
        status: 503,
        json: async () => ({
          error: "FIRST_RUN_PLAN_BACKEND_UNAVAILABLE",
          requestId: "req-first-run-after-warmup",
        }),
      };
    });

    const result = await requestAiFirstRunPlan({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        currentCapacity: "stable",
        priorityCategoryIds: ["business"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://ai.example.com/health");
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("https://ai.example.com/ai/first-run-plan");
    expect(result.ok).toBe(false);
    expect(result.transportMeta).toMatchObject({
      wakeState: "healthy",
      lastWakeAttemptAt: expect.any(Number),
    });
  });
});
