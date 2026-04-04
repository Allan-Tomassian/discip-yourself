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

  it("applies the shared category surface language across Today, Planning and Pilotage", () => {
    const todayHero = readSrc("components/today/TodayHero.jsx");
    const todayNextActions = readSrc("components/today/TodayNextActions.jsx");
    const todayDailyState = readSrc("components/today/TodayDailyState.jsx");
    const planning = readSrc("pages/Planning.jsx");
    const planningCoach = readSrc("components/planning/PlanningCoachCard.jsx");
    const library = readSrc("pages/Categories.jsx");
    const pilotage = readSrc("pages/Pilotage.jsx");

    expect(todayHero).toContain("level: \"surface\"");
    expect(todayHero).toContain("activeCategory");
    expect(todayHero).toContain("AppCard");
    expect(todayNextActions).toContain("activeCategory");
    expect(todayNextActions).toContain("level: \"surface\"");
    expect(todayNextActions).toContain("AppCard");
    expect(todayDailyState).toContain("activeCategory");
    expect(todayDailyState).toContain("level: \"surface\"");
    expect(todayDailyState).not.toContain("AppCard");
    expect(todayDailyState).toContain("todayDailyState");
    expect(planning).toContain("activeCategorySurfaceVars");
    expect(planning).toContain("AppCard");
    expect(planningCoach).toContain("getCategoryUiVars");
    expect(planningCoach).toContain("AppCard");
    expect(library).toContain("activeLibraryCategory");
    expect(library).toContain("libraryPrimaryStack");
    expect(library).not.toContain("libraryPrimaryCard");
    expect(pilotage).toContain("resolveCategoryStateTone");
    expect(pilotage).toContain("pilotageInlinePanel");
    expect(pilotage).toContain("PilotageMetricCard");
  });
});
