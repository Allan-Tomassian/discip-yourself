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
    const chartSource = readSrc("features/pilotage/DisciplineTrendChart.jsx");
    const chartModelSource = readSrc("features/pilotage/disciplineTrendChartModel.js");
    const cssSource = readSrc("features/pilotage/pilotage.css");

    expect(source).toContain("buildPilotageDisciplineTrend");
    expect(source).toContain("PILOTAGE_DISCIPLINE_WINDOWS");
    expect(source).toContain("DisciplineTrendChart");
    expect(source).toContain("Évolution discipline");
    expect(source).toContain("disciplineTrendChartKey");
    expect(source).not.toContain("function buildChartPoint");
    expect(source).not.toContain("function buildChartPath");
    expect(source).not.toContain("function buildAreaPath");
    expect(source).not.toContain("Radar secondaire");
    expect(source).not.toContain("pilotageRadarSelection");
    expect(source).not.toContain("computeCategoryRadarRows");
    expect(source).not.toContain("computePilotageInsights");
    expect(chartSource).toContain("buildDisciplineTrendChartGeometry");
    expect(chartSource).toContain("pilotageTrendChart--single");
    expect(chartSource).toContain("pathLength=\"1\"");
    expect(chartSource).toContain("pilotageTrendTooltip");
    expect(chartModelSource).toContain("hasSingleScoredPoint");
    expect(chartModelSource).toContain("baselineY");
    expect(chartModelSource).toContain("linePathD");
    expect(cssSource).toContain("prefers-reduced-motion: reduce");
    expect(cssSource).toContain("pilotageTrendReveal");
  });

  it("keeps manual IA analysis with the shared status component", () => {
    const source = readSrc("pages/Pilotage.jsx");

    expect(source).toContain("surface: \"pilotage\"");
    expect(source).toContain("resolveManualAiDisplayState");
    expect(source).toContain("<ManualAiStatus");
    expect(source).toContain("manualPilotageAnalysis.loadingStageLabel");
    expect(source).toContain("Niveau actuel");
    expect(source).toContain("Jours avec progression");
    expect(source).toContain("Analyser cette catégorie");
  });

  it("keeps the global view and opens category detail inline from focus categories", () => {
    const source = readSrc("pages/Pilotage.jsx");
    const registrySource = readSrc("logic/blocks/registry.js");

    expect(source).toContain("const [openCategoryId, setOpenCategoryId] = useState(null);");
    expect(source).toContain("buildPilotageGlobalSummary");
    expect(source).toContain("buildPilotageGlobalStats");
    expect(source).toContain("Statistiques globales");
    expect(source).toContain("Synthèse globale");
    expect(source).toContain("togglePilotageCategory");
    expect(source).toContain("pilotageInlineDetail");
    expect(source).not.toContain("const [pilotageView, setPilotageView] = useState(\"global\");");
    expect(source).not.toContain("Retour à la vue globale");
    expect(source).not.toContain("data-tour-id=\"pilotage-reporting\"");
    expect(registrySource).not.toContain("pilotage.reporting");
  });
});
