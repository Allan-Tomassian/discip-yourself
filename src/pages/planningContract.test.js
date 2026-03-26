import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("Planning primitive convergence contract", () => {
  it("uses Gate primitives instead of the generic UI wrapper in the page shell", () => {
    const source = readSrc("pages/Planning.jsx");

    expect(source).toContain("import { GateButton as Button, GateSection } from \"../shared/ui/gate/Gate\";");
    expect(source).not.toContain("from \"../components/UI\"");
    expect(source).toContain("planningCalendarSection");
    expect(source).toContain("planningContentSection");
    expect(source).toContain("GateSurfacePremium");
    expect(source).toContain("GateCardPremium");
    expect(source).toContain("GateMainSection");
    expect(source).not.toContain("planningSupportSection");
    expect(source).not.toContain("Ajustements intelligents");
  });

  it("keeps the coach card on Gate primitives too", () => {
    const source = readSrc("components/planning/PlanningCoachCard.jsx");

    expect(source).toContain("import { GateButton as Button, GateSection } from \"../../shared/ui/gate/Gate\";");
    expect(source).not.toContain("from \"../UI\"");
    expect(source).toContain("planningCoachSection");
    expect(source).toContain("GateSurfacePremium");
    expect(source).toContain("GateCardPremium");
    expect(source).toContain("GateMainSection");
    expect(source).toContain("Coach Planning");
    expect(source).toContain("Voir mes progrès");
  });
});
