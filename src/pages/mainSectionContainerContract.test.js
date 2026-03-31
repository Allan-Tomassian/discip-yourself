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

  it("uses the shared main section container across Today, Planning, Bibliothèque and Pilotage", () => {
    const home = readSrc("pages/Home.jsx");
    const todayHero = readSrc("components/today/TodayHero.jsx");
    const todayNextActions = readSrc("components/today/TodayNextActions.jsx");
    const todayDailyState = readSrc("components/today/TodayDailyState.jsx");
    const planning = readSrc("pages/Planning.jsx");
    const planningCoach = readSrc("components/planning/PlanningCoachCard.jsx");
    const library = readSrc("pages/Categories.jsx");
    const pilotage = readSrc("pages/Pilotage.jsx");

    expect(home).toContain("mainPageSection");
    expect(home).toContain("<GateSectionIntro");
    expect(todayHero).toContain("GateMainSectionCard");
    expect(todayNextActions).toContain("GateSecondarySectionCard");
    expect(todayDailyState).toContain("GateSecondarySectionCard");
    expect(todayNextActions).not.toContain("GateRoleSectionTitle");
    expect(todayDailyState).not.toContain("GateRoleSectionTitle");
    expect(planning).toContain("GateMainSectionCard planningSectionCard planningCalendarSection");
    expect(planning).toContain("<GateSectionIntro");
    expect(planning).toContain("\"GateMainSection\"");
    expect(planning).toContain("GateSecondarySectionCard");
    expect(planning).toContain("GateAnalyticsCard");
    expect(planning).toContain("GateInlineMetaCard");
    expect(planningCoach).toContain("\"GateMainSection\"");
    expect(planningCoach).toContain("GateSecondarySectionCard");
    expect(planningCoach).toContain("GateAnalyticsCard");
    expect(planningCoach).not.toContain("Lecture locale du rythme");
    expect(library).toContain("<GateSectionIntro");
    expect(library).toContain("GateMainSection GateMainSectionCard libraryPrimaryCard");
    expect(library).not.toContain("pageNarrow");
    expect(pilotage).toContain("<GateSectionIntro");
    expect(pilotage).toContain("GateMainSection GateMainSectionCard");
    expect(pilotage).toContain("GateSecondarySectionCard");
    expect(pilotage).toContain("GateAnalyticsCard");
  });
});
