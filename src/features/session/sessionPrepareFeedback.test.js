import { describe, expect, it } from "vitest";
import {
  buildSessionPrepareFailureState,
  resolveSessionPrepareFailureMessage,
} from "./sessionPrepareFeedback";

describe("sessionPrepareFeedback", () => {
  it("distinguishes invalid premium payloads from timeout failures", () => {
    expect(
      resolveSessionPrepareFailureMessage({
        result: {
          errorCode: "INVALID_RESPONSE",
          errorDetails: { rejectionReason: "provider_parse_failed" },
        },
      })
    ).toBe("Le plan premium reçu était inexploitable. Réessaye ou passe en standard.");

    expect(
      resolveSessionPrepareFailureMessage({
        result: {
          errorCode: "TIMEOUT",
          backendErrorCode: "SESSION_GUIDANCE_PROVIDER_TIMEOUT",
        },
      })
    ).toBe("La préparation détaillée a expiré. Réessaye ou passe en standard.");
  });

  it("surfaces richness failures with the dedicated premium-specific copy", () => {
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
    ).toBe("Le plan détaillé n’était pas assez spécifique. Réessaye ou passe en standard.");
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
      message: "Le plan premium reçu était inexploitable. Réessaye ou passe en standard.",
    });
  });
});
