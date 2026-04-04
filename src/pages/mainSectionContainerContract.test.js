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
    const gate = readSrc("shared/ui/gate/Gate.jsx");
    const gateCss = readSrc("shared/ui/gate/gate.css");
    const premiumCss = readSrc("shared/ui/gate/gate-premium.css");

    expect(gate).toContain("export function GateSectionIntro");
    expect(gateCss).toContain(".gateSectionIntro");
    expect(gateCss).toContain(".gateSectionIntroActions");
    expect(premiumCss).toContain(".GateMainSection");
    expect(premiumCss).toContain(".GateMainSectionCard");
    expect(premiumCss).toContain(".GateSecondarySectionCard");
    expect(premiumCss).toContain(".GateAnalyticsCard");
    expect(premiumCss).toContain(".GateInlineMetaCard");
    expect(premiumCss).toContain("var(--categoryUiBorder, var(--gate-border))");
    expect(premiumCss).toContain(".GateMainSection .gateSectionBody");
  });

  it("uses the shared main section grammar across Today, Planning, Bibliothèque and Pilotage", () => {
    const home = readSrc("pages/Home.jsx");
    const todayHero = readSrc("components/today/TodayHero.jsx");
    const todayNextActions = readSrc("components/today/TodayNextActions.jsx");
    const todayDailyState = readSrc("components/today/TodayDailyState.jsx");
    const planning = readSrc("pages/Planning.jsx");
    const planningCoach = readSrc("components/planning/PlanningCoachCard.jsx");
    const library = readSrc("pages/Categories.jsx");
    const pilotage = readSrc("pages/Pilotage.jsx");

    expect(home).toContain("mainPageSection");
    expect(home).toContain("<SectionHeader");
    expect(todayHero).toContain("AppCard");
    expect(todayNextActions).toContain("AppCard");
    expect(todayDailyState).not.toContain("AppCard");
    expect(todayDailyState).toContain("todayDailyState");
    expect(planning).toContain("planningCalendarSection");
    expect(planning).toContain("<SectionHeader");
    expect(planning).toContain("AppCard");
    expect(planning).toContain("PlanningItemRow");
    expect(planning).toContain("planningSecondaryBlock");
    expect(planningCoach).toContain("planningCoachSection");
    expect(planningCoach).toContain("AppCard");
    expect(planningCoach).toContain("AppInlineMetaCard");
    expect(planningCoach).not.toContain("Lecture locale du rythme");
    expect(library).toContain("<SectionHeader");
    expect(library).toContain("libraryPrimaryStack");
    expect(library).not.toContain("libraryPrimaryCard");
    expect(library).not.toContain("pageNarrow");
    expect(pilotage).toContain("<SectionHeader");
    expect(pilotage).toContain("pilotageFocusCard");
    expect(pilotage).toContain("pilotageInlinePanel");
    expect(pilotage).toContain("PilotageMetricBlock");
    expect(pilotage).toContain("PilotageSummaryBlock");
  });
});
