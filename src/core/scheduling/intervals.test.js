import { describe, it, expect } from "vitest";
import { computeInterval, overlaps, findConflicts, suggestNextSlots } from "./intervals";

describe("scheduling intervals", () => {
  it("computes interval with default duration when missing", () => {
    const interval = computeInterval({ dateKey: "2026-02-03", startHHmm: "09:00", durationMin: null });
    expect(interval?.startMin).toBe(9 * 60);
    expect(interval?.endMin).toBe(9 * 60 + 30);
  });

  it("detects overlap with inclusive start/exclusive end", () => {
    const a = computeInterval({ dateKey: "2026-02-03", startHHmm: "09:00", durationMin: 30 });
    const b = computeInterval({ dateKey: "2026-02-03", startHHmm: "09:15", durationMin: 15 });
    const c = computeInterval({ dateKey: "2026-02-03", startHHmm: "09:30", durationMin: 15 });
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(a, c)).toBe(false);
  });

  it("finds conflicts for the same day", () => {
    const conflicts = findConflicts({
      dateKey: "2026-02-03",
      candidate: { startHHmm: "10:00", durationMin: 30 },
      existingFixedOccurrences: [{ id: "o1", startHHmm: "10:15", durationMin: 20 }],
    });
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].source.id).toBe("o1");
  });

  it("suggests next free slots", () => {
    const suggestions = suggestNextSlots({
      dateKey: "2026-02-03",
      candidate: { startHHmm: "09:00", durationMin: 30 },
      existing: [
        { startHHmm: "09:15", durationMin: 30 },
        { startHHmm: "09:30", durationMin: 30 },
      ],
      step: 15,
      limit: 3,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toBe("10:00");
  });
});
