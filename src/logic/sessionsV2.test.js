import { describe, it, expect } from "vitest";
import { upsertSessionV2 } from "./sessionsV2";

describe("upsertSessionV2", () => {
  it("keeps a single record per occurrenceId", () => {
    const first = upsertSessionV2([], {
      occurrenceId: "occ_1",
      actionId: "goal_1",
      dateKey: "2026-02-02",
      startAt: "2026-02-02T10:00:00.000Z",
      state: "in_progress",
    });

    const second = upsertSessionV2(first, {
      occurrenceId: "occ_1",
      actionId: "goal_1",
      dateKey: "2026-02-02",
      startAt: "2026-02-02T10:00:00.000Z",
      endAt: "2026-02-02T10:30:00.000Z",
      state: "ended",
      endedReason: "done",
      timerSeconds: 1800,
    });

    const third = upsertSessionV2(second, {
      occurrenceId: "occ_1",
      actionId: "goal_1",
      dateKey: "2026-02-02",
      startAt: "2026-02-02T10:00:00.000Z",
      endAt: "2026-02-02T10:30:00.000Z",
      state: "ended",
      endedReason: "done",
      timerSeconds: 1800,
    });

    expect(second.length).toBe(1);
    expect(third).toBe(second);
    expect(second[0].state).toBe("ended");
  });
});
