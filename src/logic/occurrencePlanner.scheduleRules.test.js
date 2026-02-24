import { describe, it, expect } from "vitest";
import {
  backfillMissedOccurrences,
  ensureWindowFromScheduleRules,
  removeScheduleRulesForAction,
} from "./occurrencePlanner";

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

  it("returns the same object when there are no changes to apply", () => {
    const state = baseState();
    const next = ensureWindowFromScheduleRules(state, "2026-02-02", "2026-02-02");
    expect(next).toBe(state);
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

describe("removeScheduleRulesForAction", () => {
  it("removes only rules linked to the deleted action", () => {
    const state = baseState({
      scheduleRules: [
        { id: "rule_a1", actionId: "a1", kind: "recurring", isActive: true },
        { id: "rule_a2", actionId: "a2", kind: "recurring", isActive: true },
      ],
    });
    const next = removeScheduleRulesForAction(state, "a1");
    expect(next).not.toBe(state);
    expect(next.scheduleRules).toEqual([{ id: "rule_a2", actionId: "a2", kind: "recurring", isActive: true }]);
  });

  it("returns the same object when nothing matches", () => {
    const state = baseState({
      scheduleRules: [{ id: "rule_a2", actionId: "a2", kind: "recurring", isActive: true }],
    });
    const next = removeScheduleRulesForAction(state, "a1");
    expect(next).toBe(state);
  });
});

describe("backfillMissedOccurrences", () => {
  it("marks overdue planned occurrences as missed globally", () => {
    const state = baseState({
      occurrences: [
        {
          id: "occ_old",
          goalId: "g1",
          date: "2026-02-02",
          status: "planned",
          timeType: "fixed",
          start: "08:00",
          startAt: "2026-02-02T08:00",
          endAt: "2026-02-02T08:30",
        },
      ],
    });
    const next = backfillMissedOccurrences(state, new Date("2026-02-06T10:00"));
    expect(next.occurrences[0].status).toBe("missed");
  });

  it("does not overwrite done occurrences and keeps future planned untouched", () => {
    const state = baseState({
      occurrences: [
        {
          id: "occ_done",
          goalId: "g1",
          date: "2026-02-02",
          status: "done",
          timeType: "fixed",
          startAt: "2026-02-02T08:00",
          endAt: "2026-02-02T08:30",
        },
        {
          id: "occ_future",
          goalId: "g1",
          date: "2026-02-10",
          status: "planned",
          timeType: "fixed",
          startAt: "2026-02-10T08:00",
          endAt: "2026-02-10T08:30",
        },
      ],
    });
    const next = backfillMissedOccurrences(state, new Date("2026-02-06T10:00"));
    expect(next.occurrences[0].status).toBe("done");
    expect(next.occurrences[1].status).toBe("planned");
  });

  it("returns same object when there are no overdue planned occurrences", () => {
    const state = baseState({
      occurrences: [
        {
          id: "occ_none",
          goalId: "g1",
          date: "2026-02-10",
          status: "planned",
          timeType: "fixed",
          startAt: "2026-02-10T08:00",
          endAt: "2026-02-10T08:30",
        },
      ],
    });
    const next = backfillMissedOccurrences(state, new Date("2026-02-06T10:00"));
    expect(next).toBe(state);
  });

  it("is independent from a local selected-date window when called globally", () => {
    const state = baseState({
      occurrences: [
        {
          id: "occ_window",
          goalId: "g1",
          date: "2026-02-01",
          status: "planned",
          timeType: "fixed",
          startAt: "2026-02-01T08:00",
          endAt: "2026-02-01T08:30",
        },
      ],
    });
    const now = new Date("2026-02-06T10:00");
    const localWindowOnly = backfillMissedOccurrences(state, now, {
      fromKey: "2026-02-05",
      toKey: "2026-02-07",
    });
    expect(localWindowOnly).toBe(state);

    const global = backfillMissedOccurrences(state, now);
    expect(global.occurrences[0].status).toBe("missed");
  });
});
