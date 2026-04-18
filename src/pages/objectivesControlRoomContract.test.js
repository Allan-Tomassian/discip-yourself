import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("objectives control room contract", () => {
  it("keeps objectives as a control room with three internal angles", () => {
    const objectives = readSrc("pages/Objectives.jsx");

    expect(objectives).toContain("OBJECTIVES_LENSES");
    expect(objectives).toContain("OBJECTIVES_HORIZONS");
    expect(objectives).toContain("lensObjectives");
    expect(objectives).toContain("lensCategories");
    expect(objectives).toContain("lensKeyActions");
    expect(objectives).toContain("CompactCategoryFilter");
    expect(objectives).toContain("onOpenPlanning");
    expect(objectives).toContain("onOpenPilotage");
    expect(objectives).toContain("onOpenCategory");
    expect(objectives).toContain("requestAiLocalAnalysis");
    expect(objectives).toContain('surface: "objectives"');
    expect(objectives).not.toContain("onEditItem");
    expect(objectives).not.toContain("onOpenCreateAction");
    expect(objectives).not.toContain("onOpenCreateMenu");
  });

  it("preserves planning for mutation and insights for deep analysis", () => {
    const timeline = readSrc("pages/Timeline.jsx");
    const insights = readSrc("pages/Insights.jsx");

    expect(timeline).toContain("onEditItem?.({");
    expect(timeline).toContain("inlineStartSession");
    expect(timeline).toContain("normalizeSelectedCategoryByView");
    expect(timeline).toContain("withSelectedCategoryByView");
    expect(insights).toContain('pageId="insights"');
    expect(insights).toContain("buildPilotageManualAiContextKey");
    expect(insights).toContain('surface: "pilotage"');
  });
});
