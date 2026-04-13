import { describe, expect, it, vi } from "vitest";
import {
  isAiLocalAnalysisResponse,
  normalizeAiLocalAnalysisPayload,
  requestAiLocalAnalysis,
} from "./aiLocalAnalysisClient";

function buildLocalAnalysisResponse(overrides = {}) {
  return {
    kind: "chat",
    decisionSource: "rules",
    headline: "Charge crédible",
    reason: "Protège surtout le prochain bloc utile.",
    primaryAction: {
      label: "Voir Today",
      intent: "open_today",
      categoryId: "cat-1",
      actionId: null,
      occurrenceId: null,
      dateKey: "2026-03-25",
    },
    secondaryAction: null,
    suggestedDurationMin: 20,
    meta: {
      coachVersion: "v1",
      requestId: "req_local_123",
      selectedDateKey: "2026-03-25",
      activeCategoryId: "cat-1",
      quotaRemaining: 3,
      fallbackReason: "none",
      messagePreview: "Analyse ce planning",
    },
    ...overrides,
  };
}

describe("aiLocalAnalysisClient", () => {
  it("valide une reponse locale card", () => {
    expect(isAiLocalAnalysisResponse(buildLocalAnalysisResponse())).toBe(true);
  });

  it("rejette une reponse conversationnelle", () => {
    expect(
      isAiLocalAnalysisResponse({
        kind: "conversation",
        mode: "free",
        decisionSource: "rules",
        message: "Bonjour",
        primaryAction: null,
        secondaryAction: null,
        proposal: null,
        meta: buildLocalAnalysisResponse().meta,
      }),
    ).toBe(false);
  });

  it("émet review comme intent canonique pour l'analyse locale", () => {
    expect(
      normalizeAiLocalAnalysisPayload({
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        surface: "planning",
        message: "Analyse ce planning",
      }).aiIntent,
    ).toBe("review");
  });

  it("retourne un diagnostic offline quand le navigateur est hors ligne", async () => {
    vi.stubGlobal("window", {
      location: {
        origin: "http://192.168.1.183:5173",
        hostname: "192.168.1.183",
      },
    });
    vi.stubGlobal("navigator", { onLine: false });

    try {
      const fetchImpl = vi.fn().mockRejectedValue(new Error("Failed to fetch"));

      const result = await requestAiLocalAnalysis({
        accessToken: "token",
        baseUrl: "https://discip-yourself-backend.onrender.com",
        fetchImpl,
        payload: {
          selectedDateKey: "2026-03-25",
          activeCategoryId: "cat-1",
          surface: "planning",
          message: "Analyse ce planning",
        },
      });

      expect(result).toMatchObject({
        ok: false,
        errorCode: "NETWORK_ERROR",
        requestId: null,
        backendErrorCode: null,
        surface: "analysis",
        analysisSurface: "planning",
        baseUrlUsed: "https://discip-yourself-backend.onrender.com",
        originUsed: "http://192.168.1.183:5173",
        responseKind: null,
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

    const result = await requestAiLocalAnalysis({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        surface: "pilotage",
        message: "Analyse cette catégorie",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "UNAUTHORIZED",
      status: 401,
      requestId: "req_401",
      backendErrorCode: "UNAUTHORIZED",
      surface: "analysis",
      analysisSurface: "pilotage",
      baseUrlUsed: "https://discip-yourself-backend.onrender.com",
      responseKind: null,
    });
  });

  it("envoie un header de surface pour faciliter la corrélation backend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => buildLocalAnalysisResponse(),
    });

    await requestAiLocalAnalysis({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        surface: "planning",
        message: "Analyse ce planning",
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]?.headers?.["x-discip-surface"]).toBe("analysis");
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body || "{}").aiIntent).toBe("review");
  });

  it("rejette une surface locale invalide", async () => {
    const result = await requestAiLocalAnalysis({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl: vi.fn(),
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        surface: "today",
        message: "Analyse ce planning",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "INVALID_RESPONSE",
      status: null,
    });
  });

  it("conserve le backendErrorCode stage-level sur un 503 backend", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "PROVIDER_FAILED",
        requestId: "req_stage_503",
      }),
    });

    const result = await requestAiLocalAnalysis({
      accessToken: "token",
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
      payload: {
        selectedDateKey: "2026-03-25",
        activeCategoryId: "cat-1",
        surface: "planning",
        message: "Analyse ce planning",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "BACKEND_ERROR",
      status: 503,
      requestId: "req_stage_503",
      backendErrorCode: "PROVIDER_FAILED",
      surface: "analysis",
      analysisSurface: "planning",
    });
  });
});
