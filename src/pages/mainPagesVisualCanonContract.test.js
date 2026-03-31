import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("main pages visual canon contract", () => {
  it("keeps the visual canon in Gate premium styles instead of feature-level recipes", () => {
    const premiumCss = readSrc("shared/ui/gate/gate-premium.css");
    const indexCss = readSrc("index.css");
    const gatePageCss = readSrc("shared/ui/gate/gatePage.css");

    expect(premiumCss).toContain(".GateMainSectionCard");
    expect(premiumCss).toContain(".GateSecondarySectionCard");
    expect(premiumCss).toContain(".GateAnalyticsCard");
    expect(premiumCss).toContain(".GateInlineMetaCard");
    expect(premiumCss).toContain(".GateRoleHelperText");
    expect(premiumCss).toContain("--gate-card-padding: 20px;");
    expect(premiumCss).toContain("--gate-card-gap: 18px;");
    expect(premiumCss).toContain("--gate-section-body-gap: 18px;");
    expect(premiumCss).toContain("--gate-section-header-gap: 6px;");
    expect(premiumCss).toContain("padding: 18px;");
    expect(premiumCss).toContain("padding: 16px;");
    expect(premiumCss).toContain("padding-inline: 4px;");
    expect(premiumCss).toContain("font-size: 13px;");
    expect(premiumCss).toContain("line-height: 1.45;");
    expect(premiumCss).toContain("line-height: 1.52;");
    expect(indexCss).toContain(".mainPageStack");
    expect(indexCss).toContain("gap:18px;");
    expect(gatePageCss).toContain(".gatePagePanel");
    expect(gatePageCss).toContain(".gatePageContent");
    expect(gatePageCss).toContain("gap: 18px;");
    expect(gatePageCss).not.toContain("--gate-premium-radius: 14px;");
    expect(premiumCss).not.toContain(".topMenuCardOuter");
  });

  it("removes competing typography overrides from library and pilotage feature css", () => {
    const libraryCss = readSrc("features/library/library.css");
    const pilotageCss = readSrc("features/pilotage/pilotage.css");
    const todayCss = readSrc("features/today/today.css");
    const planningCss = readSrc("features/planning/planning.css");

    expect(libraryCss).not.toContain(".pageNarrow .sectionTitle");
    expect(libraryCss).not.toContain(".pageNarrow .itemTitle");
    expect(libraryCss).not.toContain(".pageNarrow .itemSub");
    expect(libraryCss).not.toContain("> .gateSection.GateCardPremium > .p18");
    expect(libraryCss).not.toContain("padding: 10px 12px;");

    expect(pilotageCss).not.toContain('.sectionTitle');
    expect(pilotageCss).not.toContain('.itemTitle');
    expect(pilotageCss).not.toContain('.itemSub');
    expect(pilotageCss).not.toContain('.small2');
    expect(pilotageCss).not.toContain(".p18");
    expect(todayCss).not.toContain("margin-top: 2px;");
    expect(todayCss).not.toContain(".todayHeroCard .gateSectionBody {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;");
    expect(planningCss).not.toContain(".planningSectionCard .gateSectionBody {\n  display: flex;\n  flex-direction: column;\n  gap: 14px;");
  });

  it("avoids double-padding wrappers on library and pilotage main cards", () => {
    const library = readSrc("pages/Categories.jsx");
    const pilotage = readSrc("pages/Pilotage.jsx");

    expect(library).not.toContain('className="p18');
    expect(pilotage).not.toContain('className="p18');
    expect(library).toContain("GateMainSection GateMainSectionCard libraryPrimaryCard");
    expect(library).toContain("GateSecondarySectionCard");
    expect(pilotage).toContain("GateMainSection GateMainSectionCard");
    expect(pilotage).toContain("GateSecondarySectionCard");
    expect(pilotage).toContain("GateAnalyticsCard");
  });
});
