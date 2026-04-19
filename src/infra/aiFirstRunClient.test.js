import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAiFirstRunPlanRequest,
  DEFAULT_AI_FIRST_RUN_TIMEOUT_MS,
  normalizeAiFirstRunPayloadForTest,
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

describe("aiFirstRunClient", () => {
  afterEach(() => {
    resetAiBackendWarmupStateForTests();
    vi.unstubAllGlobals();
  });

  it("normalise le payload first-run et exclut les fenetres incomplètes", () => {
    expect(
      normalizeAiFirstRunPayloadForTest({
        whyText: "Reprendre un cadre",
        primaryGoal: "Relancer le projet",
        unavailableWindows: [{ id: "u1", daysOfWeek: [1], startTime: "09:00", endTime: "", label: "Travail" }],
        preferredWindows: [{ id: "p1", daysOfWeek: [2], startTime: "07:00", endTime: "08:00", label: "Matin" }],
        currentCapacity: "stable",
        priorityCategoryIds: ["business", "health"],
        locale: "fr-FR",
        timezone: "Europe/Paris",
        referenceDateKey: "2026-04-19",
      }),
    ).toEqual({
      whyText: "Reprendre un cadre",
      primaryGoal: "Relancer le projet",
      unavailableWindows: [],
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
