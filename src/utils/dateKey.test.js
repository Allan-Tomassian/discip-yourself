import { describe, it, expect } from "vitest";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey } from "./dateKey";

describe("dateKey helpers", () => {
  it("round-trips local date key without timezone shift", () => {
    const key = "2026-02-03";
    const date = fromLocalDateKey(key);
    expect(toLocalDateKey(date)).toBe(key);
  });

  it("normalizes ISO-like timestamps to local date key", () => {
    expect(normalizeLocalDateKey("2026-02-03T10:30")).toBe("2026-02-03");
  });

  it("rejects ambiguous or invalid formats", () => {
    expect(normalizeLocalDateKey("03/02/2026")).toBe("");
    expect(normalizeLocalDateKey("invalid")).toBe("");
  });
});
