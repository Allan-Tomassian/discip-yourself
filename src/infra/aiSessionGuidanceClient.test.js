import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeAiSessionGuidancePayload,
  resolveAiSessionGuidanceTimeoutMs,
  requestAiSessionGuidance,
} from "./aiSessionGuidanceClient";
import { resetAiBackendWarmupStateForTests } from "./aiBackendWarmup";

describe("aiSessionGuidanceClient", () => {
  afterEach(() => {
    resetAiBackendWarmupStateForTests();
    vi.unstubAllGlobals();
  });

  it("mappe prepare vers session_prepare", () => {
    expect(
      normalizeAiSessionGuidancePayload({
        mode: "prepare",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
      }).aiIntent,
    ).toBe("session_prepare");
  });

  it("mappe adjust et tool vers session_adapt", () => {
    expect(
      normalizeAiSessionGuidancePayload({
        mode: "adjust",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
      }).aiIntent,
    ).toBe("session_adapt");

    expect(
      normalizeAiSessionGuidancePayload({
        mode: "tool",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
        toolId: "breathing_reset",
      }).aiIntent,
    ).toBe("session_adapt");
  });

  it("applique des budgets publics cohérents selon le mode de session-guidance", () => {
    expect(resolveAiSessionGuidanceTimeoutMs({ mode: "prepare" })).toBe(65000);
    expect(resolveAiSessionGuidanceTimeoutMs({ mode: "adjust" })).toBe(30000);
    expect(resolveAiSessionGuidanceTimeoutMs({ mode: "tool", timeoutMs: 1200 })).toBe(1200);
  });

  it("envoie le canon aiIntent quand la route backend existe", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "UNKNOWN_BACKEND_ERROR",
        requestId: "req-session-guidance",
      }),
    });

    await requestAiSessionGuidance({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        mode: "prepare",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body || "{}").aiIntent).toBe("session_prepare");
    expect(fetchImpl.mock.calls[0]?.[1]?.headers?.["x-discip-surface"]).toBe("session");
  });

  it("expose currentRunbook and fallbackToolPlan in the canonical payload", () => {
    const payload = normalizeAiSessionGuidancePayload({
      mode: "adjust",
      dateKey: "2026-03-25",
      occurrenceId: "occ-1",
      actionId: "goal-1",
      actionTitle: "Structurer la note produit",
      categoryName: "Travail",
      protocolType: "deep_work",
      targetDurationMinutes: 30,
      sessionRunbook: { version: 1, steps: [] },
      fallbackToolPlan: { version: 1, recommendations: [] },
    });

    expect(payload.actionTitle).toBe("Structurer la note produit");
    expect(payload.categoryName).toBe("Travail");
    expect(payload.protocolType).toBe("deep_work");
    expect(payload.targetDurationMinutes).toBe(30);
    expect(payload.currentRunbook).toEqual({ version: 1, steps: [] });
    expect(payload.fallbackToolPlan).toEqual({ version: 1, recommendations: [] });
  });

  it("surface PREMIUM_REQUIRED without collapsing it into a backend error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: "PREMIUM_REQUIRED",
        requestId: "req-session-guidance-premium",
      }),
    });

    const result = await requestAiSessionGuidance({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        mode: "prepare",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("PREMIUM_REQUIRED");
  });

  it("mappe un timeout de transport sur TIMEOUT", async () => {
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    const fetchImpl = vi.fn().mockRejectedValue(abortError);

    const result = await requestAiSessionGuidance({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        mode: "adjust",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("TIMEOUT");
    expect(result.requestId).toBe(null);
    expect(result.backendErrorCode).toBe(null);
  });

  it("keeps backend diagnostics for invalid premium payloads", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        error: "INVALID_SESSION_GUIDANCE_RESPONSE",
        requestId: "req-session-guidance-invalid",
        message: "Session guidance response is invalid.",
        details: {
          rejectionReason: "provider_parse_failed",
          rejectionStage: "provider_parse",
        },
      }),
    });

    const result = await requestAiSessionGuidance({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        mode: "prepare",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("INVALID_RESPONSE");
    expect(result.errorDetails).toEqual({
      rejectionReason: "provider_parse_failed",
      rejectionStage: "provider_parse",
    });
    expect(result.errorMessage).toBe("Session guidance response is invalid.");
  });

  it("maps an explicit backend provider timeout to TIMEOUT while preserving the backend error code", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      json: async () => ({
        error: "SESSION_GUIDANCE_PROVIDER_TIMEOUT",
        requestId: "req-session-guidance-timeout",
        message: "Session guidance provider timed out.",
        details: {
          providerStatus: "timeout",
          timeoutMs: 12000,
        },
      }),
    });

    const result = await requestAiSessionGuidance({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        mode: "prepare",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("TIMEOUT");
    expect(result.backendErrorCode).toBe("SESSION_GUIDANCE_PROVIDER_TIMEOUT");
    expect(result.errorDetails).toEqual({
      providerStatus: "timeout",
      timeoutMs: 12000,
    });
  });

  it("classifie une route absente comme backend optional unavailable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: "NOT_FOUND",
        requestId: "req-session-guidance-404",
      }),
    });

    const result = await requestAiSessionGuidance({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        mode: "tool",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
        toolId: "checklist_targeted",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("BACKEND_UNAVAILABLE");
    expect(result.surface).toBe("session");
    expect(result.baseUrlUsed).toBe("https://ai.example.com");
  });

  it("réveille le backend avant un prepare session-guidance dans le navigateur", async () => {
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
          error: "UNKNOWN_BACKEND_ERROR",
          requestId: "req-session-guidance-after-warmup",
        }),
      };
    });

    const result = await requestAiSessionGuidance({
      accessToken: "token",
      baseUrl: "https://ai.example.com",
      fetchImpl,
      payload: {
        mode: "prepare",
        dateKey: "2026-03-25",
        occurrenceId: "occ-1",
        actionId: "goal-1",
      },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://ai.example.com/health");
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("https://ai.example.com/ai/session-guidance");
    expect(result.ok).toBe(false);
    expect(result.transportMeta).toMatchObject({
      wakeState: "healthy",
      lastWakeAttemptAt: expect.any(Number),
    });
  });
});
