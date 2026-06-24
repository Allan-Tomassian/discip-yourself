import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { formatDisplayValue } from "./dateDisplayValue";

describe("DatePicker", () => {
  it("formats display value as dd/mm/yyyy", () => {
    expect(formatDisplayValue("2026-02-03")).toBe("03/02/2026");
  });

  it("returns empty string for invalid date input", () => {
    expect(formatDisplayValue("03/02/2026")).toBe("");
    expect(formatDisplayValue("")).toBe("");
  });

  it("uses date-specific safe popup sizing and calendar test hooks", () => {
    const source = fs.readFileSync(fileURLToPath(new URL("./DatePicker.jsx", import.meta.url)), "utf8");

    expect(source).toContain("datePickerMenuOuter");
    expect(source).toContain("preferredWidth: DATE_PICKER_PREFERRED_WIDTH");
    expect(source).toContain("minWidth: DATE_PICKER_MIN_WIDTH");
    expect(source).toContain('data-testid="date-picker-grid"');
    expect(source).toContain('data-testid="date-picker-weekday"');
  });
});
