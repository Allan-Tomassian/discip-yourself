import { describe, expect, it, vi } from "vitest";
import { deriveTodayContextModel } from "./todayContextModel";

describe("deriveTodayContextModel", () => {
  it("keeps the active session only when it belongs to the active date", () => {
    vi.setSystemTime(new Date(2026, 2, 6, 9, 0, 0));

    const result = deriveTodayContextModel({
      selectedDateKey: "2026-03-06",
      rawActiveSession: {
        id: "sess-today",
        dateKey: "2026-03-06",
        occurrenceId: "occ-1",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
      plannedOccurrencesForDay: [{ id: "occ-1", goalId: "goal-1", date: "2026-03-06", status: "planned", start: "09:00" }],
      now: new Date(2026, 2, 6, 9, 0, 0),
    });

    expect(result.activeSessionForActiveDate?.id).toBe("sess-today");
    expect(result.openSessionOutsideActiveDate).toBeNull();
    expect(result.futureSessions).toEqual([]);
    expect(result.focusOccurrenceForActiveDate?.id).toBe("occ-1");
    expect(result.isToday).toBe(true);
    expect(result.systemToday).toBe("2026-03-06");
    expect(result.datePhase).toBe("today");
  });

  it("distinguishes a future open session without polluting today's context", () => {
    vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

    const result = deriveTodayContextModel({
      selectedDateKey: "2026-03-06",
      rawActiveSession: {
        id: "sess-future",
        dateKey: "2026-03-07",
        occurrenceId: "occ-future",
        habitIds: ["goal-1"],
        runtimePhase: "in_progress",
      },
      plannedOccurrencesForDay: [{ id: "occ-1", goalId: "goal-1", date: "2026-03-06", status: "planned", start: "17:00" }],
      now: new Date(2026, 2, 6, 12, 0, 0),
    });

    expect(result.activeSessionForActiveDate).toBeNull();
    expect(result.openSessionOutsideActiveDate?.id).toBe("sess-future");
    expect(result.futureSessions).toHaveLength(1);
    expect(result.focusOccurrenceForActiveDate?.id).toBe("occ-1");
    expect(result.isToday).toBe(true);
    expect(result.datePhase).toBe("today");
  });

  it("marks a future selected date as not today", () => {
    vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0));

    const result = deriveTodayContextModel({
      selectedDateKey: "2026-03-08",
      rawActiveSession: null,
      plannedOccurrencesForDay: [{ id: "occ-2", goalId: "goal-1", date: "2026-03-08", status: "planned", start: "09:00" }],
      now: new Date(2026, 2, 6, 12, 0, 0),
    });

    expect(result.activeDate).toBe("2026-03-08");
    expect(result.isToday).toBe(false);
    expect(result.systemToday).toBe("2026-03-06");
    expect(result.datePhase).toBe("future");
    expect(result.focusOccurrenceForActiveDate?.id).toBe("occ-2");
  });
});
