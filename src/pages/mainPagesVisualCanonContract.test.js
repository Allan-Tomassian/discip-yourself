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
    const gateCss = readSrc("shared/ui/gate/gate.css");
    const premiumCss = readSrc("shared/ui/gate/gate-premium.css");
    const appUi = readSrc("shared/ui/app/AppUI.jsx");
    const appCss = readSrc("shared/ui/app/app.css");
    const indexCss = readSrc("index.css");

    expect(gateCss).toContain(".gateSectionIntro");
    expect(gateCss).toContain(".gateSectionIntroTitle");
    expect(gateCss).toContain(".gateSectionIntroSubtitle");
    expect(premiumCss).toContain(".GateMainSectionCard");
    expect(premiumCss).toContain(".GateSecondarySectionCard");
    expect(premiumCss).toContain(".GateAnalyticsCard");
    expect(premiumCss).toContain(".GateInlineMetaCard");
    expect(premiumCss).toContain(".GateRoleHelperText");
    expect(premiumCss).toContain("--gate-card-padding: 16px;");
    expect(premiumCss).toContain("--gate-card-gap: 16px;");
    expect(premiumCss).toContain("--gate-section-body-gap: 16px;");
    expect(premiumCss).toContain("--gate-section-header-gap: 6px;");
    expect(premiumCss).toContain("padding: 16px;");
    expect(premiumCss).toContain("padding: 12px;");
    expect(premiumCss).toContain("padding-inline: 4px;");
    expect(premiumCss).toContain("font-size: 13px;");
    expect(premiumCss).toContain("line-height: 1.45;");
    expect(premiumCss).toContain("line-height: 1.52;");
    expect(appUi).toContain("export function AppScreen");
    expect(appUi).toContain("export function ScreenHeader");
    expect(appUi).toContain("export function SectionHeader");
    expect(appUi).toContain("export function AppCard");
    expect(appUi).toContain("GateSectionIntro");
    expect(appUi).toContain("GateSecondarySectionCard");
    expect(appUi).toContain("GateMainSection GateMainSectionCard");
    expect(appCss).toContain(".appFieldGroup");
    expect(appCss).toContain(".appStatusBadge");
    expect(appCss).toContain(".appDrawerPanel");
    expect(indexCss).toContain(".mainPageStack");
    expect(indexCss).toContain("gap:24px;");
    expect(indexCss).toContain(".mainPageSection");
    expect(indexCss).toContain(".mainPageSectionBody");
    expect(indexCss).toContain("padding-top: calc(var(--navGap, 10px) + var(--page-top-gap));");
    expect(indexCss).toContain("position: sticky;");
    expect(fs.existsSync(path.join(SRC_ROOT, "shared/ui/gate/gatePage.css"))).toBe(false);
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
    expect(libraryCss).not.toContain(".libraryCardHeader");
    expect(libraryCss).not.toContain("> .gateSection.GateCardPremium > .p18");
    expect(libraryCss).not.toContain("padding: 10px 12px;");
    expect(libraryCss).toContain(".libraryPage .categorySurface.categorySurface--surface::before");

    expect(pilotageCss).not.toContain(".pilotageCardHeader");
    expect(pilotageCss).not.toContain(".pilotageCardHeaderLeft");
    expect(pilotageCss).toContain(".pilotagePage .pilotageSummaryCard .GateAnalyticsCard");
    expect(todayCss).not.toContain(".todaySectionHeader");
    expect(planningCss).not.toContain("gap: 18px;");
  });

  it("avoids double-padding wrappers on library and pilotage main cards", () => {
    const library = readSrc("pages/Categories.jsx");
    const pilotage = readSrc("pages/Pilotage.jsx");

    expect(library).not.toContain('className="p18');
    expect(pilotage).not.toContain('className="p18');
    expect(library).not.toContain("pageNarrow");
    expect(library).toContain('className="mainPageStack libraryPage"');
    expect(library).toContain("<GateSectionIntro");
    expect(pilotage).toContain("<GateSectionIntro");
    expect(pilotage).toContain('className="mainPageStack pilotagePage"');
    expect(library).toContain("GateMainSection GateMainSectionCard libraryPrimaryCard");
    expect(library).toContain("GateSecondarySectionCard");
    expect(pilotage).toContain("GateMainSection GateMainSectionCard");
    expect(pilotage).toContain("GateSecondarySectionCard");
    expect(pilotage).toContain("GateAnalyticsCard");
  });
});
