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

    expect(premiumCss).toContain(".GateMainSectionCard");
    expect(premiumCss).toContain(".GateSecondarySectionCard");
    expect(premiumCss).toContain(".GateAnalyticsCard");
    expect(premiumCss).toContain(".GateInlineMetaCard");
    expect(premiumCss).toContain(".GateRoleHelperText");
  });

  it("removes competing typography overrides from library and pilotage feature css", () => {
    const libraryCss = readSrc("features/library/library.css");
    const pilotageCss = readSrc("features/pilotage/pilotage.css");

    expect(libraryCss).not.toContain(".pageNarrow .sectionTitle");
    expect(libraryCss).not.toContain(".pageNarrow .itemTitle");
    expect(libraryCss).not.toContain(".pageNarrow .itemSub");
    expect(libraryCss).not.toContain("> .gateSection.GateCardPremium > .p18");

    expect(pilotageCss).not.toContain('.sectionTitle');
    expect(pilotageCss).not.toContain('.itemTitle');
    expect(pilotageCss).not.toContain('.itemSub');
    expect(pilotageCss).not.toContain('.small2');
    expect(pilotageCss).not.toContain(".p18");
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
