import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("main section container contract", () => {
  it("defines a shared main section recipe in Gate premium styles", () => {
    const premiumCss = readSrc("shared/ui/gate/gate-premium.css");

    expect(premiumCss).toContain(".GateMainSection");
    expect(premiumCss).toContain("var(--categoryUiBorder, var(--gate-border))");
    expect(premiumCss).toContain(".GateMainSection .gateSectionBody");
  });

  it("uses the shared main section container across Today, Planning, Bibliothèque and Pilotage", () => {
    const todayHero = readSrc("components/today/TodayHero.jsx");
    const todayNextActions = readSrc("components/today/TodayNextActions.jsx");
    const todayDailyState = readSrc("components/today/TodayDailyState.jsx");
    const planning = readSrc("pages/Planning.jsx");
    const planningCoach = readSrc("components/planning/PlanningCoachCard.jsx");
    const library = readSrc("pages/Categories.jsx");
    const pilotage = readSrc("pages/Pilotage.jsx");

    expect(todayHero).toContain("GateMainSection");
    expect(todayNextActions).toContain("GateMainSection");
    expect(todayDailyState).toContain("GateMainSection");
    expect(planning).toContain("GateMainSection planningSectionCard planningCalendarSection");
    expect(planning).toContain("\"GateMainSection\"");
    expect(planningCoach).toContain("\"GateMainSection\"");
    expect(library).toContain("GateMainSection libraryPrimaryCard");
    expect(pilotage).toContain("className=\"GateMainSection\"");
  });
});
