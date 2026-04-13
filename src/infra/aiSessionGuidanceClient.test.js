import { describe, expect, it, vi } from "vitest";
import {
  normalizeAiSessionGuidancePayload,
  requestAiSessionGuidance,
} from "./aiSessionGuidanceClient";

describe("aiSessionGuidanceClient", () => {
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
    expect(result.errorCode).toBe("SESSION_GUIDANCE_BACKEND_UNAVAILABLE");
    expect(result.surface).toBe("session");
    expect(result.baseUrlUsed).toBe("https://ai.example.com");
  });
});
