import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("category accent UI contract", () => {
  it("keeps CategoryPill and AccentCategoryRow on the shared level-based helper", () => {
    const pill = readSrc("components/CategoryPill.jsx");
    const accentRow = readSrc("components/AccentCategoryRow.jsx");

    expect(pill).toContain("getCategoryUiVars");
    expect(pill).toContain("level: \"pill\"");
    expect(accentRow).toContain("getCategoryUiVars");
    expect(accentRow).toContain("level: \"surface\"");
    expect(accentRow).toContain("categorySurface--surface");
  });

  it("keeps category color as subtle metadata instead of full-screen shell chrome", () => {
    const todayHero = readSrc("components/today/TodayHero.jsx");
    const primaryAction = readSrc("components/today/PrimaryActionCard.jsx");
    const objectives = readSrc("pages/Objectives.jsx");

    expect(todayHero).not.toContain("getCategoryUiVars");
    expect(primaryAction).toContain("categoryLabel");
    expect(primaryAction).not.toContain("resolveCategoryColor");
    expect(objectives).toContain("resolveCategoryColor");
    expect(objectives).toContain("ObjectiveRing");
    expect(objectives).toContain("category?.name");
  });
});
