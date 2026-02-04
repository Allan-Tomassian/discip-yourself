import { describe, it, expect } from "vitest";
import { getNextPlannedOccurrence, getAlternativeCandidates } from "./focusSelector";

const baseDate = "2026-02-03";

function occ(id, start, extra = {}) {
  return {
    id,
    goalId: "g1",
    date: baseDate,
    start,
    status: "planned",
    ...extra,
  };
}

describe("focusSelector", () => {
  it("prioritizes future fixed occurrences", () => {
    const now = new Date(2026, 1, 3, 10, 0);
    const occurrences = [occ("a", "09:00"), occ("b", "10:30"), occ("c", "12:00")];
    const next = getNextPlannedOccurrence({ dateKey: baseDate, now, occurrences });
    expect(next?.id).toBe("b");
  });

  it("falls back to earliest fixed when none are future", () => {
    const now = new Date(2026, 1, 3, 18, 0);
    const occurrences = [occ("a", "09:00"), occ("b", "10:30")];
    const next = getNextPlannedOccurrence({ dateKey: baseDate, now, occurrences });
    expect(next?.id).toBe("a");
  });

  it("falls back to non-fixed when no fixed exists", () => {
    const now = new Date(2026, 1, 3, 10, 0);
    const occurrences = [occ("a", "", { noTime: true }), occ("b", "", { timeType: "window" })];
    const next = getNextPlannedOccurrence({ dateKey: baseDate, now, occurrences });
    expect(next?.id).toBe("a");
  });

  it("returns non-fixed and fixed future alternatives", () => {
    const now = new Date(2026, 1, 3, 10, 0);
    const occurrences = [occ("a", "", { noTime: true }), occ("b", "11:00"), occ("c", "09:00")];
    const alternatives = getAlternativeCandidates({ dateKey: baseDate, now, occurrences, excludeId: "b" });
    expect(alternatives.some((x) => x.occ.id === "a")).toBe(true);
    expect(alternatives.some((x) => x.occ.id === "c")).toBe(false);
  });
});
