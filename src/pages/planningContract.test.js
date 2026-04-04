import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("Planning AppUI convergence contract", () => {
  it("uses AppUI primitives instead of raw Gate primitives in the page shell", () => {
    const source = readSrc("pages/Planning.jsx");

    expect(source).toContain("AppScreen");
    expect(source).toContain("SectionHeader");
    expect(source).toContain("AppCard");
    expect(source).toContain("AppInlineMetaCard");
    expect(source).not.toContain("from \"../components/UI\"");
    expect(source).not.toContain("from \"../shared/ui/gate/Gate\"");
    expect(source).toContain('headerSubtitle={MAIN_PAGE_COPY.planning.orientation}');
    expect(source).toContain('className="mainPageStack planningPage"');
    expect(source).toContain('className="mainPageSection"');
    expect(source).toContain("<SectionHeader");
    expect(source).toContain("MAIN_PAGE_COPY.planning.weekDescription");
    expect(source).toContain("MAIN_PAGE_COPY.planning.dayDescription");
    expect(source).toContain("planningCalendarSection");
    expect(source).toContain("planningContentSection");
    expect(source).toContain("planningSectionButton");
    expect(source).toContain("planningItemCard");
    expect(source).not.toContain("planningSupportSection");
    expect(source).not.toContain("Ajustements intelligents");
    expect(source).not.toContain("sans effet tableau de bord");
    expect(source).not.toContain("avec la même densité que Today");
  });

  it("keeps the coach card on AppUI primitives too", () => {
    const source = readSrc("components/planning/PlanningCoachCard.jsx");

    expect(source).toContain("AppCard");
    expect(source).toContain("AppInlineMetaCard");
    expect(source).toContain("PrimaryButton");
    expect(source).toContain("GhostButton");
    expect(source).not.toContain("from \"../UI\"");
    expect(source).not.toContain("from \"../../shared/ui/gate/Gate\"");
    expect(source).toContain("planningCoachSection");
    expect(source).toContain("planningCoachBlock");
    expect(source).toContain("planningCoachValue");
    expect(source).not.toContain("Lecture locale du rythme");
    expect(source).toContain("planningCoachPrimaryAction");
    expect(source).toContain("Parler au Coach");
    expect(source).toContain("Passer en Plan");
    expect(source).toContain("Relire mes progrès");
  });
});
