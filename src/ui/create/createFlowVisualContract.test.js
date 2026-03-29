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

  it("removes the legacy modal host and step files from the repo", () => {
    const legacyPaths = [
      "components/CategoryGateModal.jsx",
      "ui/create/CreateFlowModal.jsx",
      "creation/creationDraft.js",
      "creation/createFlowController.js",
      "pages/CreateV2Outcome.jsx",
      "pages/CreateV2OutcomeNextAction.jsx",
      "pages/CreateV2HabitType.jsx",
      "pages/CreateV2LinkOutcome.jsx",
      "pages/CreateV2PickCategory.jsx",
      "pages/CreateV2Habits.jsx",
      "pages/CreateV2HabitOneOff.jsx",
      "pages/CreateV2HabitRecurring.jsx",
      "pages/CreateV2HabitAnytime.jsx",
    ];

    for (const relPath of legacyPaths) {
      expect(fs.existsSync(path.join(SRC_ROOT, relPath))).toBe(false);
    }

    expect(readSrc("pages/CreateItem.jsx")).not.toContain("../components/UI");
    expect(readSrc("pages/Onboarding.jsx")).not.toContain("../components/UI");
  });
});
