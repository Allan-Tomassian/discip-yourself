import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) return "";
  return source.slice(startIndex, endIndex);
}

describe("App Day Analysis wiring contract", () => {
  it("mounts DayAnalysisSheet and passes Home an explicit opener", () => {
    const app = readSrc("App.jsx");

    expect(app).toContain('import DayAnalysisSheet from "./components/day-analysis/DayAnalysisSheet";');
    expect(app).toContain('import { requestAiDayAnalysis } from "./infra/aiDayAnalysisClient";');
    expect(app).toContain("onOpenDayAnalysisSheet={openDayAnalysisSheet}");
    expect(app).toContain("<DayAnalysisSheet");
    expect(app).toContain("onLaunch={launchDayAnalysis}");
    expect(app).toContain("onRetry={launchDayAnalysis}");
    expect(app).toContain("onPrepareValidation={routeDayAnalysisAction}");
  });

  it("does not call the backend when the sheet is opened", () => {
    const app = readSrc("App.jsx");
    const openBody = sliceBetween(app, "const openDayAnalysisSheet = useCallback(", "const launchDayAnalysis = useCallback(");

    expect(openBody).toContain("phase: DAY_ANALYSIS_SHEET_STATE.INTRO");
    expect(openBody).toContain("todayData");
    expect(openBody).not.toContain("requestAiDayAnalysis");
  });

  it("builds the snapshot and calls /ai/day-analysis only from launch lifecycle", () => {
    const app = readSrc("App.jsx");
    const launchBody = sliceBetween(app, "const launchDayAnalysis = useCallback(", "const routeDayAnalysisAction = useCallback(");

    expect(launchBody).toContain("buildDayAnalysisSnapshot({");
    expect(launchBody).toContain("buildDayAnalysisSnapshotHash(snapshot)");
    expect(launchBody).toContain("dayAnalysisCacheRef.current.get(snapshotHash)");
    expect(launchBody).toContain("requestAiDayAnalysis({");
    expect(launchBody).toContain("accessToken: auth?.session?.access_token || \"\"");
    expect(launchBody).toContain("if (dayAnalysisRequestSeqRef.current !== requestSeq) return;");
  });

  it("hands result actions to Recovery, Coach, or Planning without direct mutation", () => {
    const app = readSrc("App.jsx");
    const routeBody = sliceBetween(app, "const routeDayAnalysisAction = useCallback(", "const confirmDayAnalysisApply = useCallback(");

    expect(routeBody).toContain("isDayAnalysisActionDirectlyApplicable(action)");
    expect(routeBody).toContain("phase: DAY_ANALYSIS_SHEET_STATE.CONFIRMATION");
    expect(routeBody).toContain("resolveDayAnalysisActionHandoff(action)");
    expect(routeBody).toContain("buildDayAnalysisRecoveryRequest({");
    expect(routeBody).toContain('source: "day_analysis"');
    expect(routeBody).toContain("openRecoverySheet(request)");
    expect(routeBody).toContain('setTab("coach")');
    expect(routeBody).toContain('setTab("timeline")');
    expect(routeBody).not.toContain("setData(");
    expect(routeBody).not.toContain("applyOccurrenceRepair");
    expect(routeBody).not.toContain("commitRecoveryOptionState");
  });

  it("applies direct deterministic actions only from the confirmation callback", () => {
    const app = readSrc("App.jsx");
    const confirmBody = sliceBetween(app, "const confirmDayAnalysisApply = useCallback(", "const handleDayAnalysisSelectAction = useCallback(");

    expect(confirmBody).toContain("isDayAnalysisActionDirectlyApplicable(action)");
    expect(confirmBody).toContain("applyDayAnalysisDeterministicAction({");
    expect(confirmBody).toContain("todayData: dayAnalysisSheetState.todayData");
    expect(confirmBody).toContain("setData(result.nextState)");
    expect(confirmBody).toContain("phase: DAY_ANALYSIS_SHEET_STATE.SUCCESS");
    expect(confirmBody).toContain("phase: DAY_ANALYSIS_SHEET_STATE.ERROR");
    expect(confirmBody).not.toContain("applyOccurrenceRepair");
  });

  it("keeps the Home card visual component unchanged while replacing the old Coach CTA route", () => {
    const home = readSrc("pages/Home.jsx");
    const aiCard = readSrc("components/today/AIInsightCard.jsx");

    expect(home).toContain("onOpenDayAnalysisSheet?.({");
    expect(home).toContain("<AIInsightCard");
    expect(home).toContain("onOptimize={openDayAnalysis}");
    expect(home).not.toContain("Optimise ma journée : propose une réduction");
    expect(aiCard).toContain("todayAiBackdrop");
    expect(aiCard).toContain("Optimiser aujourd’hui");
    expect(aiCard).not.toContain("day-analysis-sheet-hero-bg.webp");
  });
});
