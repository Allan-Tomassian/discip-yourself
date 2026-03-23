import { describe, expect, it } from "vitest";
import {
  compareOccurrencesByUserAiPreference,
  derivePreferredBlockAlignment,
  updateUserAiProfileAdaptation,
} from "./userAiProfile";

describe("userAiProfile", () => {
  it("lowers implicit intensity when missed occurrences dominate", () => {
    const nextProfile = updateUserAiProfileAdaptation({
      profile: {
        goals: ["business"],
        time_budget_daily_min: 60,
        intensity_preference: "balanced",
        preferred_time_blocks: ["morning"],
        structure_preference: "structured",
      },
      occurrences: [
        { id: "occ-1", date: "2026-03-20", status: "missed" },
        { id: "occ-2", date: "2026-03-21", status: "missed" },
        { id: "occ-3", date: "2026-03-22", status: "rescheduled" },
        { id: "occ-4", date: "2026-03-23", status: "done" },
      ],
      now: new Date("2026-03-23T12:00:00"),
    });

    expect(nextProfile.adaptation.implicit_intensity).toBe("light");
    expect(nextProfile.adaptation.suggestion_stability).toBe("low");
  });

  it("matches preferred blocks for window occurrences using windowStartAt", () => {
    const leftWindow = {
      id: "occ-left",
      date: "2026-03-23",
      start: "00:00",
      slotKey: "00:00",
      noTime: true,
      timeType: "window",
      windowStartAt: "2026-03-23T18:00",
      windowEndAt: "2026-03-23T22:00",
    };
    const rightWindow = {
      id: "occ-right",
      date: "2026-03-23",
      start: "00:00",
      slotKey: "00:00",
      noTime: true,
      timeType: "window",
      windowStartAt: "2026-03-23T07:00",
      windowEndAt: "2026-03-23T12:00",
    };

    expect(compareOccurrencesByUserAiPreference(leftWindow, rightWindow, ["evening"])).toBeLessThan(0);
    expect(
      derivePreferredBlockAlignment({
        preferredTimeBlocks: ["evening"],
        occurrences: [leftWindow],
      })
    ).toBe("full_match");
  });
});
