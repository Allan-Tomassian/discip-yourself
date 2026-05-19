import { describe, expect, it } from "vitest";
import {
  isFirstRunActivationCompleteForTour,
  shouldStartTour,
} from "./useTour";

describe("useTour start policy", () => {
  it("suppresses automatic legacy tour after first-run commit completion", () => {
    expect(
      shouldStartTour({
        ui: {
          onboardingCompleted: true,
          tourSeenVersion: 0,
          firstRunV1: {
            status: "done",
            commitV1: { status: "applied" },
          },
        },
        onboardingCompleted: true,
        totalSteps: 6,
        isDragging: false,
        tourVersion: 1,
      })
    ).toBe(false);
  });

  it("preserves explicit replay from settings after first-run completion", () => {
    expect(
      shouldStartTour({
        ui: {
          tourForceStart: true,
          tourSeenVersion: 1,
          firstRunV1: {
            status: "done",
            commitV1: { status: "applied" },
          },
        },
        onboardingCompleted: true,
        totalSteps: 6,
        isDragging: false,
        tourVersion: 1,
      })
    ).toBe(true);
  });

  it("keeps legacy automatic tour behavior for pre-first-run onboarding state", () => {
    expect(
      shouldStartTour({
        ui: { tourSeenVersion: 0 },
        onboardingCompleted: true,
        totalSteps: 6,
        isDragging: false,
        tourVersion: 1,
      })
    ).toBe(true);
  });

  it("does not treat uncommitted first-run done state as activation complete", () => {
    expect(
      isFirstRunActivationCompleteForTour({
        firstRunV1: {
          status: "done",
          commitV1: { status: "failed" },
        },
      })
    ).toBe(false);
  });
});
