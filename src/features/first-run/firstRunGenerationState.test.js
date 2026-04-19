import { describe, expect, it } from "vitest";
import {
  applyFirstRunGenerationFailure,
  applyFirstRunGenerationSuccess,
  buildFirstRunGenerationError,
  markFirstRunGenerationPending,
  retryFirstRunGenerationState,
  reuseFirstRunGeneratedPlans,
  shouldReuseFirstRunGeneratedPlans,
  shouldStartFirstRunGeneration,
} from "./firstRunGenerationState";

function createGenerateState(overrides = {}) {
  return {
    status: "generate",
    generatedPlans: null,
    inputHash: null,
    generationError: null,
    selectedPlanId: "tenable",
    lastUpdatedAt: "2026-04-19T08:00:00.000Z",
    ...overrides,
  };
}

describe("firstRunGenerationState", () => {
  it("keeps the generate screen in a clean loading state when a new request starts", () => {
    const next = markFirstRunGenerationPending(
      createGenerateState({
        generationError: { code: "TIMEOUT" },
        selectedPlanId: "ambitious",
      }),
      "hash_1",
      "2026-04-19T08:05:00.000Z"
    );

    expect(next.inputHash).toBe("hash_1");
    expect(next.generationError).toBeNull();
    expect(next.selectedPlanId).toBeNull();
    expect(next.lastUpdatedAt).toBe("2026-04-19T08:05:00.000Z");
  });

  it("advances automatically to compare when generation succeeds", () => {
    const payload = { inputHash: "hash_1", plans: [{ id: "tenable" }, { id: "ambitious" }] };
    const pending = createGenerateState({ inputHash: "hash_1" });

    const next = applyFirstRunGenerationSuccess(pending, {
      inputHash: "hash_1",
      payload,
      timestamp: "2026-04-19T08:06:00.000Z",
    });

    expect(next.status).toBe("compare");
    expect(next.generatedPlans).toEqual(payload);
    expect(next.generationError).toBeNull();
    expect(next.selectedPlanId).toBeNull();
  });

  it("stores an honest error, then lets retry clear it before a new success", () => {
    const pending = createGenerateState({ inputHash: "hash_retry" });
    const result = {
      errorCode: "INVALID_RESPONSE",
      errorMessage: "Unable to generate first run plans.",
      requestId: "req_retry",
      backendErrorCode: "INVALID_FIRST_RUN_PLAN_RESPONSE",
      transportMeta: {
        probableCause: null,
        backendBaseUrl: "https://ai.example.com",
        frontendOrigin: "https://app.example.com",
      },
    };

    const failed = applyFirstRunGenerationFailure(pending, {
      inputHash: "hash_retry",
      error: buildFirstRunGenerationError(result),
      timestamp: "2026-04-19T08:07:00.000Z",
    });
    const retried = retryFirstRunGenerationState(failed, "2026-04-19T08:08:00.000Z");
    const succeeded = applyFirstRunGenerationSuccess(
      markFirstRunGenerationPending(retried, "hash_retry", "2026-04-19T08:09:00.000Z"),
      {
        inputHash: "hash_retry",
        payload: { inputHash: "hash_retry", plans: [{ id: "tenable" }, { id: "ambitious" }] },
        timestamp: "2026-04-19T08:10:00.000Z",
      }
    );

    expect(failed.generationError?.code).toBe("INVALID_RESPONSE");
    expect(failed.generationError?.backendErrorCode).toBe("INVALID_FIRST_RUN_PLAN_RESPONSE");
    expect(retried.generationError).toBeNull();
    expect(retried.inputHash).toBeNull();
    expect(succeeded.status).toBe("compare");
  });

  it("deduplicates concurrent generation for the same input hash but reuses saved plans immediately", () => {
    expect(
      shouldStartFirstRunGeneration({
        firstRun: createGenerateState({ inputHash: "hash_1" }),
        inputHash: "hash_1",
        inFlightInputHash: "hash_1",
      })
    ).toBe(false);

    expect(
      shouldReuseFirstRunGeneratedPlans({
        generatedPlans: { inputHash: "hash_saved", plans: [{ id: "tenable" }, { id: "ambitious" }] },
        inputHash: "hash_saved",
      })
    ).toBe(true);

    const reused = reuseFirstRunGeneratedPlans(createGenerateState(), "hash_saved", "2026-04-19T08:11:00.000Z");
    expect(reused.status).toBe("compare");
    expect(reused.generationError).toBeNull();
  });
});
