import { describe, expect, it } from "vitest";
import {
  SESSION_GUIDANCE_BACKEND_STATES,
  SESSION_GUIDANCE_EXECUTION_SOURCES,
  resolveSessionGuidanceBackendState,
  resolveSessionGuidanceExecutionSource,
  shouldAttemptSessionGuidanceBackend,
} from "./sessionGuidanceBoundary";

describe("sessionGuidanceBoundary", () => {
  it("marks the backend as unavailable only for explicit optional-backend failures", () => {
    expect(
      resolveSessionGuidanceBackendState(SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN, {
        ok: false,
        errorCode: "BACKEND_UNAVAILABLE",
      })
    ).toBe(SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE);

    expect(
      resolveSessionGuidanceBackendState(SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN, {
        ok: false,
        errorCode: "NETWORK_ERROR",
      })
    ).toBe(SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN);

    expect(
      resolveSessionGuidanceBackendState(SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN, {
        ok: true,
      })
    ).toBe(SESSION_GUIDANCE_BACKEND_STATES.AVAILABLE);
  });

  it("skips backend attempts once the session-guidance backend is known unavailable", () => {
    expect(
      shouldAttemptSessionGuidanceBackend({
        backendState: SESSION_GUIDANCE_BACKEND_STATES.UNKNOWN,
        accessToken: "token",
      })
    ).toBe(true);

    expect(
      shouldAttemptSessionGuidanceBackend({
        backendState: SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE,
        accessToken: "token",
      })
    ).toBe(false);

    expect(
      shouldAttemptSessionGuidanceBackend({
        backendState: SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE,
        accessToken: "token",
        forceAttempt: true,
      })
    ).toBe(true);
  });

  it("distinguishes ai-applied from local fallback resolutions", () => {
    expect(
      resolveSessionGuidanceExecutionSource({
        attempted: true,
        applied: true,
        result: { ok: true },
      })
    ).toBe(SESSION_GUIDANCE_EXECUTION_SOURCES.AI_APPLIED);

    expect(
      resolveSessionGuidanceExecutionSource({
        attempted: true,
        applied: false,
        result: { ok: false, errorCode: "TIMEOUT" },
      })
    ).toBe(SESSION_GUIDANCE_EXECUTION_SOURCES.AI_FAILED_FALLBACK);

    expect(
      resolveSessionGuidanceExecutionSource({
        attempted: false,
        applied: false,
        cacheHit: true,
        backendState: SESSION_GUIDANCE_BACKEND_STATES.AVAILABLE,
      })
    ).toBe(SESSION_GUIDANCE_EXECUTION_SOURCES.LOCAL_ONLY);

    expect(
      resolveSessionGuidanceExecutionSource({
        attempted: false,
        applied: false,
        backendState: SESSION_GUIDANCE_BACKEND_STATES.UNAVAILABLE,
      })
    ).toBe(SESSION_GUIDANCE_EXECUTION_SOURCES.BACKEND_UNAVAILABLE_FALLBACK);
  });
});
