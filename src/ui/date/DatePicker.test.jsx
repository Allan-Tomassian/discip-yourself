import { describe, it, expect } from "vitest";
import { formatDisplayValue } from "./DatePicker";

describe("DatePicker", () => {
  it("formats display value as dd/mm/yyyy", () => {
    expect(formatDisplayValue("2026-02-03")).toBe("03/02/2026");
  });

  it("returns empty string for invalid date input", () => {
    expect(formatDisplayValue("03/02/2026")).toBe("");
    expect(formatDisplayValue("")).toBe("");
  });
});
