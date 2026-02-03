import { describe, it, expect } from "vitest";
import { resolveOccurrenceForSession, setOccurrenceStatusById } from "./occurrences";

describe("resolveOccurrenceForSession", () => {
  it("returns not_found when no occurrence exists", () => {
    const result = resolveOccurrenceForSession(
      { occurrences: [], goals: [] },
      { dateKey: "2026-02-02", goalIds: ["g1"], preferredStart: "" }
    );
    expect(result.reason).toBe("not_found");
    expect(result.occurrence).toBe(null);
  });

  it("returns final when occurrence is already final", () => {
    const occurrences = [
      {
        id: "o1",
        goalId: "g1",
        date: "2026-02-02",
        start: "10:00",
        slotKey: "10:00",
        status: "done",
      },
    ];
    const result = resolveOccurrenceForSession(
      { occurrences, goals: [] },
      { dateKey: "2026-02-02", goalIds: ["g1"], preferredStart: "" }
    );
    expect(result.reason).toBe("final");
    expect(result.occurrence?.id).toBe("o1");
  });
});

describe("setOccurrenceStatusById", () => {
  it("does not change occurrences when already final", () => {
    const occurrences = [
      {
        id: "o1",
        goalId: "g1",
        date: "2026-02-02",
        start: "10:00",
        slotKey: "10:00",
        status: "done",
      },
    ];
    const next = setOccurrenceStatusById("o1", "done", { occurrences, goals: [] });
    expect(next).toBe(occurrences);
  });

  it("is idempotent on consecutive calls", () => {
    const occurrences = [
      {
        id: "o2",
        goalId: "g2",
        date: "2026-02-02",
        start: "09:00",
        slotKey: "09:00",
        status: "planned",
      },
    ];
    const first = setOccurrenceStatusById("o2", "done", { occurrences, goals: [] });
    expect(first).not.toBe(occurrences);
    const second = setOccurrenceStatusById("o2", "done", { occurrences: first, goals: [] });
    expect(second).toBe(first);
  });
});
