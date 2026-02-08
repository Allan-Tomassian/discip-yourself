import { describe, expect, it } from "vitest";
import {
  addDaysLocal,
  compareTimeStr,
  fromLocalDateKey,
  isSameDateKey,
  isValidTimeStr,
  minutesToTimeStr,
  normalizeStartTime,
  parseTimeToMinutes,
  toLocalDateKey,
} from "./datetime";

describe("datetime helpers", () => {
  it("normalizes start time inputs", () => {
    expect(normalizeStartTime("9:0")).toBe("09:00");
    expect(normalizeStartTime("09:5")).toBe("09:05");
    expect(normalizeStartTime("23:59")).toBe("23:59");
    expect(normalizeStartTime("24:00")).toBe("");
  });

  it("round-trips local date keys", () => {
    const key = "2026-02-03";
    expect(toLocalDateKey(fromLocalDateKey(key))).toBe(key);
  });

  it("adds local days across month boundaries", () => {
    expect(addDaysLocal("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysLocal("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("converts between minutes and time strings", () => {
    expect(parseTimeToMinutes("08:30")).toBe(510);
    expect(parseTimeToMinutes("8:30")).toBe(510);
    expect(minutesToTimeStr(510)).toBe("08:30");
    expect(minutesToTimeStr(-1)).toBe("");
  });

  it("validates and compares time strings", () => {
    expect(isValidTimeStr("09:00")).toBe(true);
    expect(isValidTimeStr("9:00")).toBe(false);
    expect(compareTimeStr("09:00", "10:00")).toBeLessThan(0);
    expect(compareTimeStr("10:00", "09:00")).toBeGreaterThan(0);
    expect(compareTimeStr("09:00", "09:00")).toBe(0);
  });

  it("compares date keys safely", () => {
    expect(isSameDateKey("2026-02-03", "2026-02-03")).toBe(true);
    expect(isSameDateKey("2026-02-03", "2026-02-04")).toBe(false);
  });
});

