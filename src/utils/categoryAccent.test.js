import { describe, expect, it } from "vitest";
import { getCategoryAccentVars } from "./categoryAccent";

describe("getCategoryAccentVars", () => {
  it("returns the mapped gradient for known categories", () => {
    const finance = getCategoryAccentVars({ name: "Finance", color: "#111111" });
    const mental = getCategoryAccentVars({ name: "Mental", color: "#222222" });

    expect(finance["--category-gradient"]).toContain("#22c55e");
    expect(finance["--category-gradient"]).toContain("#3aa0ff");
    expect(finance["--accent"]).toBe("#22c55e");

    expect(mental["--category-gradient"]).toContain("#8b5cf6");
    expect(mental["--category-gradient"]).toContain("#ec4899");
  });

  it("derives a fallback gradient from the category color when no preset exists", () => {
    const custom = getCategoryAccentVars({ name: "Cuisine", color: "#123456" });

    expect(custom["--accent"]).toBe("#123456");
    expect(custom["--category-gradient"]).toContain("#123456");
    expect(custom["--accentTint"]).toContain("rgba(");
    expect(custom["--catGlow"]).toContain("rgba(");
  });

  it("stays compatible with direct color usage", () => {
    const direct = getCategoryAccentVars("#abcdef");

    expect(direct["--accent"]).toBe("#ABCDEF");
    expect(direct["--category-gradient"]).toContain("#ABCDEF");
  });
});
