import { describe, expect, it } from "vitest";
import {
  getCategoryPalettePresets,
  pickCategoryPaletteColor,
  resolveCategoryColor,
  resolveCategoryPalette,
  resolveCategoryPalettePreset,
} from "./categoryPalette";

describe("categoryPalette", () => {
  it("maps known category aliases to the same canonical preset", () => {
    const business = resolveCategoryPalettePreset({ id: "cat_business", name: "Business" });
    const work = resolveCategoryPalettePreset({ id: "cat_work", name: "Travail" });
    const health = resolveCategoryPalettePreset({ id: "cat_health", name: "Santé" });

    expect(business?.key).toBe("business");
    expect(work?.key).toBe("travail");
    expect(health?.key).toBe("health");
  });

  it("keeps the main category families visually distinct", () => {
    const business = resolveCategoryColor({ name: "Business" });
    const work = resolveCategoryColor({ name: "Travail" });
    const health = resolveCategoryColor({ name: "Santé" });
    const finance = resolveCategoryColor({ name: "Finance" });
    const mental = resolveCategoryColor({ name: "Mental" });
    const social = resolveCategoryColor({ name: "Social" });

    expect(new Set([business, work, health, finance, mental, social]).size).toBe(6);
  });

  it("provides a full primary/secondary palette for known categories", () => {
    const sport = resolveCategoryPalette({ name: "Sport" });
    const relations = resolveCategoryPalette({ name: "Relations" });

    expect(sport.primary).toBe("#D85E74");
    expect(sport.secondary).toBe("#B44962");
    expect(relations.primary).toBe("#C97C3D");
    expect(relations.secondary).toBe("#A35E39");
  });

  it("cycles fallback colors across a distinct curated set", () => {
    const colors = Array.from({ length: 8 }, (_, index) => pickCategoryPaletteColor(index));
    expect(new Set(colors).size).toBe(8);
  });

  it("exposes a stable canonical preset list", () => {
    expect(getCategoryPalettePresets().length).toBeGreaterThanOrEqual(10);
  });
});
