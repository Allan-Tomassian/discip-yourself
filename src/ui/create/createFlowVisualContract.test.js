import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("create flow visual contract", () => {
  it("keeps the unified create host on Gate main-section primitives", () => {
    const modalSource = readSrc("ui/create/CreateFlowModal.jsx");
    const shellSource = readSrc("ui/create/FlowShell.jsx");
    const sectionSource = readSrc("ui/create/CreateSection.jsx");

    expect(modalSource).toContain("GateMainSection GateSurfacePremium GateCardPremium");
    expect(shellSource).toContain("GatePanel");
    expect(sectionSource).toContain("createStepSection GateSurfacePremium GateCardPremium");
  });

  it("does not fall back to legacy UI.jsx in the Create V2 steps mounted in the host", () => {
    const sources = [
      "pages/CreateV2Outcome.jsx",
      "pages/CreateV2OutcomeNextAction.jsx",
      "pages/CreateV2HabitType.jsx",
      "pages/CreateV2LinkOutcome.jsx",
      "pages/CreateV2PickCategory.jsx",
      "pages/CreateV2Habits.jsx",
    ].map(readSrc);

    for (const source of sources) {
      expect(source).not.toContain("../components/UI");
      expect(source).toContain("CreateSection");
    }
  });
});
