import { describe, expect, it, vi } from "vitest";
import {
  isAiBackendConfigured,
  isAiCoachResponse,
  normalizeAiNowPayload,
  readAiBackendBaseUrl,
  requestAiNow,
} from "./aiNowClient";

function buildCoachResponse(overrides = {}) {
  return {
    kind: "now",
    decisionSource: "rules",
    interventionType: "session_resume",
    headline: "Relance ta session",
    reason: "Ta session est deja en cours.",
    primaryAction: {
      label: "Reprendre",
      intent: "resume_session",
      categoryId: "c1",
      actionId: "a1",
      occurrenceId: "o1",
      dateKey: "2026-03-13",
    },
    secondaryAction: null,
    suggestedDurationMin: 15,
    confidence: 0.84,
    urgency: "medium",
    uiTone: "direct",
    toolIntent: "suggest_resume_session",
    rewardSuggestion: {
      kind: "none",
      label: null,
    },
    meta: {
      coachVersion: "v1",
      requestId: "req_123",
      selectedDateKey: "2026-03-13",
      activeCategoryId: "c1",
      occurrenceId: "o1",
      sessionId: "s1",
      quotaRemaining: 3,
      fallbackReason: "none",
      trigger: "resume",
      diagnostics: {
        resolutionStatus: "rules_fallback",
        rejectionReason: "none",
        canonicalContextSummary: {
          activeDate: "2026-03-13",
          isToday: true,
          hasActiveSessionForActiveDate: true,
          hasOpenSessionOutsideActiveDate: false,
          futureSessionsCount: 0,
          hasPlannedActionsForActiveDate: true,
          hasFocusOccurrenceForActiveDate: true,
        },
      },
    },
    ...overrides,
  };
}

describe("aiNowClient", () => {
  it("normalise un payload minimal valide", () => {
    expect(
      normalizeAiNowPayload({
        selectedDateKey: "2026-03-13",
        activeCategoryId: null,
        surface: "today",
        trigger: "screen_open",
      })
    ).toEqual({
      selectedDateKey: "2026-03-13",
      activeCategoryId: null,
      surface: "today",
      trigger: "screen_open",
      aiIntent: "execute_now",
    });
  });

  it("reconnait une URL backend valide", () => {
    expect(readAiBackendBaseUrl("https://ai.example.com/")).toBe("https://ai.example.com");
    expect(isAiBackendConfigured("https://ai.example.com")).toBe(true);
    expect(isAiBackendConfigured("")).toBe(false);
  });

  it("valide le coach contract backend", () => {
    expect(isAiCoachResponse(buildCoachResponse())).toBe(true);
    expect(isAiCoachResponse({})).toBe(false);
  });

  it("retourne DISABLED si le backend n'est pas configure", async () => {
    const fetchImpl = vi.fn();
    const result = await requestAiNow({
      accessToken: "token",
      baseUrl: "",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-13",
        activeCategoryId: null,
        surface: "today",
        trigger: "screen_open",
      },
    });

    expect(result).toMatchObject({ ok: false, errorCode: "DISABLED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("envoie la requete et parse une reponse valide", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => buildCoachResponse(),
    });

    const result = await requestAiNow({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-13",
        activeCategoryId: "c1",
        surface: "today",
        trigger: "screen_open",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.coach?.headline).toBe("Relance ta session");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://ai.example.com/ai/now");
    expect(options.headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(options.body).aiIntent).toBe("execute_now");
  });

  it("mappe QUOTA_EXCEEDED", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "QUOTA_EXCEEDED", requestId: "req_1" }),
    });

    const result = await requestAiNow({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-13",
        activeCategoryId: null,
        surface: "today",
        trigger: "screen_open",
      },
    });

    expect(result).toMatchObject({ ok: false, errorCode: "QUOTA_EXCEEDED", status: 429 });
  });

  it("mappe BACKEND_SCHEMA_MISSING", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "BACKEND_SCHEMA_MISSING", requestId: "req_2" }),
    });

    const result = await requestAiNow({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-13",
        activeCategoryId: null,
        surface: "today",
        trigger: "screen_open",
      },
    });

    expect(result).toMatchObject({ ok: false, errorCode: "BACKEND_SCHEMA_MISSING", status: 503 });
  });

  it("mappe une erreur reseau", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

    const result = await requestAiNow({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-13",
        activeCategoryId: null,
        surface: "today",
        trigger: "screen_open",
      },
    });

    expect(result).toMatchObject({ ok: false, errorCode: "NETWORK_ERROR" });
  });

  it("deduit une origine LAN privee probable quand le fetch casse depuis un iPhone de dev", async () => {
    vi.stubGlobal("window", {
      location: {
        origin: "http://192.168.1.183:5173",
        hostname: "192.168.1.183",
      },
    });
    vi.stubGlobal("navigator", { onLine: true });

    try {
      const fetchImpl = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      const result = await requestAiNow({
        accessToken: "token",
        baseUrl: "https://discip-yourself-backend.onrender.com",
        fetchImpl,
        payload: {
          selectedDateKey: "2026-03-13",
          activeCategoryId: null,
          surface: "today",
          trigger: "screen_open",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        errorCode: "NETWORK_ERROR",
        transportMeta: {
          frontendOrigin: "http://192.168.1.183:5173",
          backendBaseUrl: "https://discip-yourself-backend.onrender.com",
          online: true,
          probableCause: "cors_private_origin",
        },
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejette une reponse backend invalide", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ kind: "now" }),
    });

    const result = await requestAiNow({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-13",
        activeCategoryId: null,
        surface: "today",
        trigger: "screen_open",
      },
    });

    expect(result).toMatchObject({ ok: false, errorCode: "INVALID_RESPONSE" });
  });
});
