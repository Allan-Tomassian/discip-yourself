import { describe, it, expect } from "vitest";
import { resolveExecutableOccurrence } from "./sessionResolver";

function baseState(occurrences) {
  return { occurrences };
}

describe("resolveExecutableOccurrence", () => {
  it("prefers fixed over window even if window has earlier resolvedStart", () => {
    const date = "2026-02-02";
    const state = baseState([
      {
        id: "fixed1",
        goalId: "g1",
        date,
        start: "09:00",
        status: "planned",
        timeType: "fixed",
      },
      {
        id: "window1",
        goalId: "g2",
        date,
        start: "00:00",
        status: "planned",
        timeType: "window",
        resolvedStart: "08:30",
        noTime: true,
      },
    ]);
    const resolved = resolveExecutableOccurrence(state, { dateKey: date, goalIds: ["g1", "g2"] });
    expect(resolved.kind).toBe("ok");
    expect(resolved.occurrenceId).toBe("fixed1");
  });

  it("puts window without resolvedStart after fixed", () => {
    const date = "2026-02-02";
    const state = baseState([
      {
        id: "fixed1",
        goalId: "g1",
        date,
        start: "09:00",
        status: "planned",
        timeType: "fixed",
      },
      {
        id: "window1",
        goalId: "g2",
        date,
        start: "00:00",
        status: "planned",
        timeType: "window",
        resolvedStart: "",
        noTime: true,
      },
    ]);
    const resolved = resolveExecutableOccurrence(state, { dateKey: date, goalIds: ["g1", "g2"] });
    expect(resolved.kind).toBe("ok");
    expect(resolved.occurrenceId).toBe("fixed1");
  });

  it("returns not_found when there is no planned candidate", () => {
    const date = "2026-02-02";
    const state = baseState([
      { id: "o1", goalId: "g1", date, start: "09:00", status: "done", timeType: "fixed" },
    ]);
    const resolved = resolveExecutableOccurrence(state, { dateKey: date, goalIds: ["g1"] });
    expect(resolved.kind).toBe("not_found");
    expect(resolved.occurrenceId).toBe(null);
  });

  it("is deterministic for identical inputs", () => {
    const date = "2026-02-02";
    const state = baseState([
      { id: "o1", goalId: "g1", date, start: "09:00", status: "planned", timeType: "fixed" },
      { id: "o2", goalId: "g2", date, start: "10:00", status: "planned", timeType: "fixed" },
    ]);
    const first = resolveExecutableOccurrence(state, { dateKey: date, goalIds: ["g1", "g2"] });
    const second = resolveExecutableOccurrence(state, { dateKey: date, goalIds: ["g1", "g2"] });
    expect(second.occurrenceId).toBe(first.occurrenceId);
    expect(second.kind).toBe(first.kind);
  });

  it("tie-breaks by goalId then id", () => {
    const date = "2026-02-02";
    const state = baseState([
      { id: "b2", goalId: "b", date, start: "09:00", status: "planned", timeType: "fixed" },
      { id: "a2", goalId: "a", date, start: "09:00", status: "planned", timeType: "fixed" },
      { id: "a1", goalId: "a", date, start: "09:00", status: "planned", timeType: "fixed" },
    ]);
    const resolved = resolveExecutableOccurrence(state, { dateKey: date, goalIds: ["a", "b"] });
    expect(resolved.kind).toBe("ok");
    expect(resolved.occurrenceId).toBe("a1");
  });
});
