import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("create flow visual contract", () => {
  it("keeps the canonical create host on Gate sections instead of the modal host", () => {
    const pageSource = readSrc("pages/CreateItem.jsx");
    const screenSource = readSrc("features/create-item/CreateItemScreens.jsx");

    expect(pageSource).toContain('pageId="create-item"');
    expect(pageSource).toContain("normalizeCreateItemDraft");
    expect(screenSource).toContain("ActionCreateScreen");
    expect(screenSource).toContain("OutcomeCreateScreen");
    expect(screenSource).toContain("GuidedCreateScreen");
    expect(screenSource).toContain("SectionSurface");
    expect(screenSource).toContain("FooterBar");
    expect(pageSource).not.toContain("CreateFlowModal");
  });

  it("does not fall back to legacy UI.jsx in the canonical create host or the remaining legacy steps", () => {
    const sources = [
      "pages/CreateItem.jsx",
      "pages/CreateV2Outcome.jsx",
      "pages/CreateV2OutcomeNextAction.jsx",
      "pages/CreateV2HabitType.jsx",
      "pages/CreateV2LinkOutcome.jsx",
      "pages/CreateV2PickCategory.jsx",
      "pages/CreateV2Habits.jsx",
      "pages/Onboarding.jsx",
    ].map(readSrc);

    for (const source of sources) {
      expect(source).not.toContain("../components/UI");
    }

    expect(readSrc("pages/CreateItem.jsx")).toContain("ActionCreateScreen");
    expect(readSrc("pages/CreateV2Habits.jsx")).toContain("CreateSection");
  });
});
