import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureAiBackendWarm,
  getAiBackendWarmupState,
  resetAiBackendWarmupStateForTests,
} from "./aiBackendWarmup";

describe("aiBackendWarmup", () => {
  afterEach(() => {
    resetAiBackendWarmupStateForTests();
    vi.unstubAllGlobals();
  });

  it("deduplicates concurrent health warmups and persists the healthy state", async () => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://test-discip-yourself.netlify.app",
      },
    });

    let resolveHealth = null;
    const fetchImpl = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveHealth = resolve;
    }));

    const firstWarmup = ensureAiBackendWarm({
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
    });
    const secondWarmup = ensureAiBackendWarm({
      baseUrl: "https://discip-yourself-backend.onrender.com",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(getAiBackendWarmupState()).toMatchObject({
      wakeState: "warming",
      lastWakeAttemptAt: expect.any(Number),
    });

    resolveHealth({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const [firstResult, secondResult] = await Promise.all([firstWarmup, secondWarmup]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(getAiBackendWarmupState()).toMatchObject({
      wakeState: "healthy",
      lastHealthyAt: expect.any(Number),
      lastWakeAttemptAt: expect.any(Number),
      lastWakeDurationMs: expect.any(Number),
    });
  });
});
