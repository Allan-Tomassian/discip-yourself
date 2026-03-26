import { describe, expect, it } from "vitest";
import { getCategoryAccentVars, getCategoryUiVars, resolveCategoryStateTone } from "./categoryAccent";

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

  it("derives stable UI vars for pill, surface and focus levels", () => {
    const pill = getCategoryUiVars({ name: "Sport", color: "#3aa0ff" }, { level: "pill" });
    const surface = getCategoryUiVars({ name: "Sport", color: "#3aa0ff" }, { level: "surface" });
    const focus = getCategoryUiVars({ name: "Sport", color: "#3aa0ff" }, { level: "focus" });

    expect(pill["--categoryUiLevel"]).toBe("pill");
    expect(surface["--categoryUiLevel"]).toBe("surface");
    expect(focus["--categoryUiLevel"]).toBe("focus");
    expect(pill["--categoryUiTint"]).not.toBe(surface["--categoryUiTint"]);
    expect(focus["--categoryUiBorderStrong"]).toContain("rgba(");
    expect(surface["--categoryUiGradient"]).toContain("linear-gradient");
  });

  it("attenuates weak states and nudges critical states without losing category context", () => {
    const weak = getCategoryUiVars({ name: "Finance", color: "#22c55e" }, { level: "surface", stateTone: "weak" });
    const critical = getCategoryUiVars(
      { name: "Finance", color: "#22c55e" },
      { level: "surface", stateTone: "critical" }
    );

    expect(weak["--categoryUiStateTone"]).toBe("weak");
    expect(critical["--categoryUiStateTone"]).toBe("critical");
    expect(weak["--accent"]).not.toBe("#22c55e");
    expect(critical["--accent"]).not.toBe("#22c55e");
    expect(critical["--category-gradient"]).toContain("linear-gradient");
  });
});

describe("resolveCategoryStateTone", () => {
  it("keeps the default tone for healthy values", () => {
    expect(resolveCategoryStateTone({ value: 0.75 })).toBe("default");
  });

  it("returns weak or critical for low values and empty expected work", () => {
    expect(resolveCategoryStateTone({ value: 0.4 })).toBe("weak");
    expect(resolveCategoryStateTone({ value: 0.2 })).toBe("critical");
    expect(resolveCategoryStateTone({ done: 0, expected: 3 })).toBe("critical");
  });
});
