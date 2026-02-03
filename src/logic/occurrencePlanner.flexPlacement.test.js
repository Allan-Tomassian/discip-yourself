import { describe, it, expect } from "vitest";
import { resolveWindowConflictsForDay } from "./occurrencePlanner";

describe("resolveWindowConflictsForDay", () => {
  it("places a window occurrence in the first available gap after fixed ones", () => {
    const date = "2026-02-02";
    const list = [
      { id: "f1", goalId: "g1", date, start: "09:00", durationMinutes: 60, status: "planned", timeType: "fixed" },
      { id: "f2", goalId: "g2", date, start: "11:00", durationMinutes: 60, status: "planned", timeType: "fixed" },
      {
        id: "w1",
        goalId: "g3",
        date,
        start: "00:00",
        durationMinutes: 30,
        status: "planned",
        timeType: "window",
        noTime: true,
        windowStartAt: `${date}T10:00`,
        windowEndAt: `${date}T12:00`,
      },
    ];

    const next = resolveWindowConflictsForDay(list, date);
    const placed = next.find((o) => o.id === "w1");
    expect(placed.resolvedStart).toBe("10:00");
    expect(placed.conflict).toBe(false);
    expect(placed.start).toBe("00:00");
  });

  it("marks conflict when a window occurrence cannot fit", () => {
    const date = "2026-02-02";
    const list = [
      { id: "f1", goalId: "g1", date, start: "09:00", durationMinutes: 180, status: "planned", timeType: "fixed" },
      {
        id: "w1",
        goalId: "g2",
        date,
        start: "00:00",
        durationMinutes: 60,
        status: "planned",
        timeType: "window",
        noTime: true,
        windowStartAt: `${date}T10:00`,
        windowEndAt: `${date}T11:00`,
      },
    ];

    const next = resolveWindowConflictsForDay(list, date);
    const placed = next.find((o) => o.id === "w1");
    expect(placed.resolvedStart).toBe("");
    expect(placed.conflict).toBe(true);
  });

  it("is idempotent on consecutive calls", () => {
    const date = "2026-02-02";
    const list = [
      { id: "f1", goalId: "g1", date, start: "09:00", durationMinutes: 60, status: "planned", timeType: "fixed" },
      {
        id: "w1",
        goalId: "g2",
        date,
        start: "00:00",
        durationMinutes: 30,
        status: "planned",
        timeType: "window",
        noTime: true,
        windowStartAt: `${date}T10:00`,
        windowEndAt: `${date}T12:00`,
      },
    ];

    const first = resolveWindowConflictsForDay(list, date);
    const second = resolveWindowConflictsForDay(first, date);
    expect(second).toBe(first);
  });
});
