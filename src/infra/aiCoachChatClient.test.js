import { describe, expect, it, vi } from "vitest";
import { isAiCoachChatResponse, requestAiCoachChat } from "./aiCoachChatClient";

function buildChatResponse(overrides = {}) {
  return {
    kind: "chat",
    decisionSource: "rules",
    headline: "Ajoute un bloc simple",
    reason: "Une action courte suffit pour remettre Today en mouvement.",
    primaryAction: {
      label: "Voir pilotage",
      intent: "open_pilotage",
      categoryId: "cat-1",
      actionId: "goal-1",
      occurrenceId: null,
      dateKey: "2026-03-25",
    },
    secondaryAction: null,
    suggestedDurationMin: 20,
    meta: {
      coachVersion: "v1",
      requestId: "req_123",
      selectedDateKey: "2026-03-25",
      activeCategoryId: "cat-1",
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Ajoute une action",
    },
    ...overrides,
  };
}

function buildConversationResponse(overrides = {}) {
  return {
    kind: "conversation",
    mode: "plan",
    decisionSource: "rules",
    message: "Je peux te proposer une direction et deux actions simples à valider.",
    primaryAction: null,
    secondaryAction: null,
    proposal: {
      kind: "guided",
      categoryDraft: { mode: "existing", id: "cat-1", label: "Focus" },
      outcomeDraft: {
        title: "Reprendre un rythme stable",
        categoryId: "cat-1",
      },
      actionDrafts: [
        {
          title: "Bloquer 20 min de focus",
          categoryId: "cat-1",
          repeat: "daily",
          daysOfWeek: [1, 2, 3, 4, 5],
          timeMode: "FIXED",
          startTime: "09:00",
          durationMinutes: 20,
        },
      ],
      unresolvedQuestions: [],
      requiresValidation: true,
    },
    meta: {
      coachVersion: "v1",
      requestId: "req_conv_123",
      selectedDateKey: "2026-03-25",
      activeCategoryId: "cat-1",
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Aide-moi à structurer ce projet",
    },
    ...overrides,
  };
}

describe("aiCoachChatClient", () => {
  it("valide une reponse chat locale sans draftChanges", () => {
    expect(isAiCoachChatResponse(buildChatResponse())).toBe(true);
  });

  it("rejette une reponse conversationnelle avec un mode invalide", () => {
    expect(
      isAiCoachChatResponse(
        buildConversationResponse({
          mode: "card",
        })
      )
    ).toBe(false);
  });

  it("valide une reponse conversationnelle en mode plan", () => {
    expect(isAiCoachChatResponse(buildConversationResponse())).toBe(true);
  });

  it("rejette une reponse free qui embarque une proposal", () => {
    expect(
      isAiCoachChatResponse(
        buildConversationResponse({
          mode: "free",
          proposal: {
            kind: "guided",
            categoryDraft: { mode: "existing", id: "cat-1", label: "Focus" },
            outcomeDraft: null,
            actionDrafts: [],
            unresolvedQuestions: [],
            requiresValidation: true,
          },
        })
      )
    ).toBe(false);
  });

  it("retourne un diagnostic offline quand le navigateur est vraiment hors ligne", async () => {
    vi.stubGlobal("window", {
      location: {
        origin: "http://192.168.1.183:5173",
        hostname: "192.168.1.183",
      },
    });
    vi.stubGlobal("navigator", { onLine: false });

    try {
      const fetchImpl = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      const result = await requestAiCoachChat({
        accessToken: "token",
        baseUrl: "https://discip-yourself-backend.onrender.com",
        fetchImpl,
        payload: {
          selectedDateKey: "2026-03-25",
          activeCategoryId: "cat-1",
          message: "Ajoute une action",
          recentMessages: [],
        },
      });

      expect(result).toMatchObject({
        ok: false,
        errorCode: "NETWORK_ERROR",
        requestId: null,
        backendErrorCode: null,
        surface: "coach",
        baseUrlUsed: "https://discip-yourself-backend.onrender.com",
        originUsed: "http://192.168.1.183:5173",
        responseKind: null,
        responseMode: null,
        transportMeta: {
          frontendOrigin: "http://192.168.1.183:5173",
          backendBaseUrl: "https://discip-yourself-backend.onrender.com",
          online: false,
          probableCause: "offline",
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("retourne un diagnostic complet sur un 401 backend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: "UNAUTHORIZED",
        requestId: "req_401",
      }),
    });

    const result = await requestAiCoachChat({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        mode: "free",
        message: "Bonjour",
        recentMessages: [],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "UNAUTHORIZED",
      status: 401,
      requestId: "req_401",
      backendErrorCode: "UNAUTHORIZED",
      surface: "coach",
      baseUrlUsed: "https://discip-yourself-backend.onrender.com",
      responseKind: null,
      responseMode: null,
    });
  });

  it("envoie un header de surface pour faciliter la corrélation backend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => buildConversationResponse({ mode: "free", proposal: null }),
    });

    await requestAiCoachChat({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        mode: "free",
        message: "Bonjour",
        recentMessages: [],
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers?.["x-discip-surface"]).toBe("coach");
  });

  it("retourne un diagnostic complet sur un 429 backend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: "RATE_LIMITED",
        requestId: "req_429",
      }),
    });

    const result = await requestAiCoachChat({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        mode: "plan",
        message: "Structure ce projet",
        recentMessages: [],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "RATE_LIMITED",
      status: 429,
      requestId: "req_429",
      backendErrorCode: "RATE_LIMITED",
      responseKind: null,
      responseMode: null,
    });
  });

  it("conserve le backendErrorCode stage-level sur un 503 backend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "CONTEXT_BUILD_FAILED",
        requestId: "req_stage_503",
      }),
    });

    const result = await requestAiCoachChat({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        mode: "plan",
        message: "Structure ce projet",
        recentMessages: [],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "BACKEND_ERROR",
      status: 503,
      requestId: "req_stage_503",
      backendErrorCode: "CONTEXT_BUILD_FAILED",
      surface: "coach",
    });
  });

  it("retourne responseKind et responseMode sur une reponse 200 invalide", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        kind: "conversation",
        mode: "plan",
        requestId: "req_invalid",
        message: "",
      }),
    });

    const result = await requestAiCoachChat({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        mode: "plan",
        message: "Aide-moi à structurer",
        recentMessages: [],
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "INVALID_RESPONSE",
      status: 200,
      requestId: "req_invalid",
      responseKind: "conversation",
      responseMode: "plan",
    });
  });
});
