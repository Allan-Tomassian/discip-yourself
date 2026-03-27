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
    expect(source).toContain("Pilotage rapide");
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
    expect(chartSource).toContain("variant = \"default\"");
    expect(chartSource).toContain("pilotageTrendChart--compact");
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
    expect(source).toContain("Jours actifs");
    expect(source).toContain("Analyser cette catégorie");
  });

  it("keeps the global view and opens category detail inline from focus categories", () => {
    const source = readSrc("pages/Pilotage.jsx");
    const registrySource = readSrc("logic/blocks/registry.js");

    expect(source).toContain("const [openCategoryId, setOpenCategoryId] = useState(null);");
    expect(source).toContain("const [showDeferredCategories, setShowDeferredCategories] = useState(false);");
    expect(source).toContain("buildPilotageGlobalSummary");
    expect(source).toContain("buildPilotageGlobalStats");
    expect(source).toContain("MAIN_PAGE_COPY.pilotage.summaryTitle");
    expect(source).toContain("MAIN_PAGE_COPY.pilotage.focusTitle");
    expect(source).toContain("MAIN_PAGE_COPY.pilotage.statsTitle");
    expect(source).toContain('headerSubtitle={MAIN_PAGE_COPY.pilotage.orientation}');
    expect(source).toContain('className="mainPageStack"');
    expect(source).toContain("togglePilotageCategory");
    expect(source).toContain("pilotageInlineDetail");
    expect(source).toContain("Catégories déjà structurées");
    expect(source).toContain("à structurer");
    expect(source).toContain("Signal principal");
    expect(source).not.toContain("pilotageInlineSummaryHead");
    expect(source).not.toContain("Lecture rapide de cette catégorie.");
    expect(source).not.toContain("const [pilotageView, setPilotageView] = useState(\"global\");");
    expect(source).not.toContain("Retour à la vue globale");
    expect(source).not.toContain("data-tour-id=\"pilotage-reporting\"");
    expect(source).not.toContain("headerSubtitle=\"Vue d’ensemble\"");
    expect(source).not.toContain("Statistiques globales");
    expect(source).not.toContain("Synthèse globale");
    expect(registrySource).not.toContain("pilotage.reporting");
  });
});
