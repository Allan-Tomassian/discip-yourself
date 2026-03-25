import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("Pilotage contract", () => {
  it("replaces the radar with the discipline trend graph", () => {
    const source = readSrc("pages/Pilotage.jsx");

    expect(source).toContain("buildPilotageDisciplineTrend");
    expect(source).toContain("PILOTAGE_DISCIPLINE_WINDOWS");
    expect(source).toContain("DisciplineTrendChart");
    expect(source).toContain("Évolution discipline");
    expect(source).not.toContain("Radar secondaire");
    expect(source).not.toContain("pilotageRadarSelection");
    expect(source).not.toContain("computeCategoryRadarRows");
    expect(source).not.toContain("computePilotageInsights");
  });

  it("keeps manual IA analysis with the shared status component", () => {
    const source = readSrc("pages/Pilotage.jsx");

    expect(source).toContain("surface: \"pilotage\"");
    expect(source).toContain("resolveManualAiDisplayState");
    expect(source).toContain("<ManualAiStatus");
    expect(source).toContain("manualPilotageAnalysis.loadingStageLabel");
    expect(source).toContain("Analyser cette catégorie");
  });
});
