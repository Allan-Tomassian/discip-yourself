import { describe, expect, it } from "vitest";
import {
  buildSessionPrepareFailureState,
  resolveSessionPrepareFailureMessage,
} from "./sessionPrepareFeedback";

describe("sessionPrepareFeedback", () => {
  it("keeps unavailable guidance copy intentional and non-technical", () => {
    expect(
      resolveSessionPrepareFailureMessage({
        result: {
          errorCode: "INVALID_RESPONSE",
          errorDetails: { rejectionReason: "provider_parse_failed" },
        },
      })
    ).toBe("Impossible de préparer le guidage maintenant. Tu peux démarrer en session standard.");

    expect(
      resolveSessionPrepareFailureMessage({
        result: {
          errorCode: "TIMEOUT",
          backendErrorCode: "SESSION_GUIDANCE_PROVIDER_TIMEOUT",
        },
      })
    ).toBe("Impossible de préparer le guidage maintenant. Tu peux démarrer en session standard.");
  });

  it("keeps backend wakeup copy non-blocking", () => {
    expect(
      resolveSessionPrepareFailureMessage({
        result: {
          errorCode: "TIMEOUT",
          probableCause: "backend_waking",
        },
      })
    ).toBe("Impossible de préparer le guidage maintenant. Tu peux démarrer en session standard.");
  });

  it("keeps richness failures action-oriented", () => {
    expect(
      resolveSessionPrepareFailureMessage({
        result: { ok: true },
        quality: {
          isPremiumReady: false,
          validationPassed: true,
          richnessPassed: false,
          reason: "richness_failed",
          rejectionReason: "richness_failed",
        },
      })
    ).toBe("Impossible de préparer le guidage maintenant. Tu peux démarrer en session standard.");
  });

  it("keeps machine-readable diagnostics for degraded premium prepares", () => {
    expect(
      buildSessionPrepareFailureState({
        result: {
          errorCode: "INVALID_RESPONSE",
          backendErrorCode: "INVALID_RESPONSE",
          requestId: "req-guidance-1",
          status: 502,
          errorDetails: {
            rejectionReason: "provider_parse_failed",
            rejectionStage: "provider_parse",
          },
        },
        quality: null,
      })
    ).toMatchObject({
      errorCode: "INVALID_RESPONSE",
      backendErrorCode: "INVALID_RESPONSE",
      requestId: "req-guidance-1",
      status: 502,
      rejectionReason: "provider_parse_failed",
      rejectionStage: "provider_parse",
      message: "Impossible de préparer le guidage maintenant. Tu peux démarrer en session standard.",
    });
  });
});
