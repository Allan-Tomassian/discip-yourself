import { describe, it, expect } from "vitest";
import { ensureWindowFromScheduleRules } from "./occurrencePlanner";

function baseState(overrides = {}) {
  return {
    goals: [],
    scheduleRules: [],
    occurrences: [],
    ui: {},
    ...overrides,
  };
}

describe("ensureWindowFromScheduleRules", () => {
  it("generates recurring occurrences and is idempotent", () => {
    const state = baseState({
      scheduleRules: [
        {
          id: "rule_r1",
          actionId: "g1",
          kind: "recurring",
          daysOfWeek: [1, 2, 3, 4, 5],
          timeType: "fixed",
          startTime: "09:00",
          durationMin: 30,
          isActive: true,
        },
      ],
    });

    const first = ensureWindowFromScheduleRules(state, "2026-02-02", "2026-02-06");
    expect(first.occurrences.length).toBe(5);

    const second = ensureWindowFromScheduleRules(first, "2026-02-02", "2026-02-06");
    expect(second).toBe(first);
  });

  it("generates one_time occurrence once", () => {
    const state = baseState({
      scheduleRules: [
        {
          id: "rule_once",
          actionId: "g2",
          kind: "one_time",
          startDate: "2026-02-03",
          timeType: "window",
          windowStart: "08:00",
          windowEnd: "12:00",
          durationMin: 20,
          isActive: true,
        },
      ],
    });

    const next = ensureWindowFromScheduleRules(state, "2026-02-02", "2026-02-06");
    expect(next.occurrences.length).toBe(1);
    expect(next.occurrences[0].date).toBe("2026-02-03");
    expect(next.occurrences[0].scheduleRuleId).toBe("rule_once");
  });

  it("attaches a legacy occurrence without duplicating", () => {
    const state = baseState({
      scheduleRules: [
        {
          id: "rule_attach",
          actionId: "g3",
          kind: "recurring",
          daysOfWeek: [1],
          timeType: "fixed",
          startTime: "10:00",
          durationMin: 25,
          isActive: true,
        },
      ],
      occurrences: [
        {
          id: "occ_legacy",
          goalId: "g3",
          date: "2026-02-02",
          start: "10:00",
          durationMinutes: 25,
          status: "planned",
        },
      ],
    });

    const next = ensureWindowFromScheduleRules(state, "2026-02-02", "2026-02-02");
    expect(next.occurrences.length).toBe(1);
    expect(next.occurrences[0].scheduleRuleId).toBe("rule_attach");
    expect(next.occurrences[0].timeType).toBe("fixed");
  });

  it("marks planned occurrences as missed only once", () => {
    const state = baseState({
      scheduleRules: [
        {
          id: "rule_missed",
          actionId: "g4",
          kind: "one_time",
          startDate: "2026-02-02",
          timeType: "fixed",
          startTime: "08:00",
          durationMin: 30,
          isActive: true,
        },
      ],
      occurrences: [
        {
          id: "occ_missed",
          goalId: "g4",
          date: "2026-02-02",
          start: "08:00",
          durationMinutes: 30,
          status: "planned",
          scheduleRuleId: "rule_missed",
          timeType: "fixed",
          startAt: "2026-02-02T08:00",
          endAt: "2026-02-02T08:30",
        },
      ],
    });

    const now = new Date("2026-02-02T09:00");
    const first = ensureWindowFromScheduleRules(state, "2026-02-02", "2026-02-02", null, now);
    expect(first.occurrences[0].status).toBe("missed");

    const second = ensureWindowFromScheduleRules(first, "2026-02-02", "2026-02-02", null, now);
    expect(second).toBe(first);
  });

  it("updates an existing planned occurrence when rule changes without duplication", () => {
    const state = baseState({
      scheduleRules: [
        {
          id: "rule_update",
          actionId: "g5",
          kind: "recurring",
          daysOfWeek: [1],
          timeType: "fixed",
          startTime: "09:00",
          durationMin: 20,
          isActive: true,
        },
      ],
      occurrences: [
        {
          id: "occ_existing",
          goalId: "g5",
          date: "2026-02-02",
          start: "07:00",
          slotKey: "07:00",
          durationMinutes: 45,
          status: "planned",
          scheduleRuleId: "rule_update",
        },
      ],
    });

    const next = ensureWindowFromScheduleRules(state, "2026-02-02", "2026-02-02");
    expect(next.occurrences.length).toBe(1);
    expect(next.occurrences[0].start).toBe("09:00");
    expect(next.occurrences[0].durationMinutes).toBe(20);
    expect(next.occurrences[0].scheduleRuleId).toBe("rule_update");
  });
});
