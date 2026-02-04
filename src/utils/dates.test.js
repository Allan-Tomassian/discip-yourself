import { describe, it, expect } from "vitest";
import { addDays, buildDateWindow, getWeekdayShortLabel } from "./dates";
import { toLocalDateKey } from "./dateKey";

describe("buildDateWindow", () => {
  it("returns a contiguous window around the anchor date", () => {
    const anchor = new Date(2025, 0, 15);
    const window = buildDateWindow(anchor, 2, 3);
    expect(window).toHaveLength(6);
    expect(toLocalDateKey(window[0])).toBe(toLocalDateKey(addDays(anchor, -2)));
    expect(toLocalDateKey(window[window.length - 1])).toBe(toLocalDateKey(addDays(anchor, 3)));
  });

  it("formats a short weekday label", () => {
    const label = getWeekdayShortLabel(new Date(2025, 1, 4), "fr-FR");
    expect(label).toBe("MAR");
  });
});
