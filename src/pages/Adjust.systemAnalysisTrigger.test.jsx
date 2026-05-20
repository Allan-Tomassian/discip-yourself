import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Adjust from "./Adjust";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACTIVE_DATE = "2026-05-20";

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

function eligibleData() {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [
      { id: "out_focus", type: "OUTCOME", title: "Livrer", categoryId: "cat_work" },
      { id: "goal_focus", type: "PROCESS", title: "Focus profond", categoryId: "cat_work", parentId: "out_focus" },
    ],
    occurrences: Array.from({ length: 10 }, (_, index) => ({
      id: `occ_${index}`,
      goalId: "goal_focus",
      date: `2026-05-${String(11 + index).padStart(2, "0")}`,
      start: "09:00",
      durationMinutes: 45,
      status: index < 5 ? "done" : "planned",
    })),
    sessionHistory: [],
    ui: {
      selectedDateKey: ACTIVE_DATE,
      firstRunV1: {
        commitV1: { status: "applied", appliedAt: "2026-05-01T10:00:00.000Z" },
        draftAnswers: { whyText: "Construire une discipline stable." },
      },
    },
  };
}

function thinData() {
  return {
    categories: [{ id: "cat_work", name: "Travail" }],
    goals: [{ id: "goal_focus", type: "PROCESS", title: "Focus profond", categoryId: "cat_work" }],
    occurrences: [],
    sessionHistory: [],
    ui: { selectedDateKey: ACTIVE_DATE },
  };
}

describe("Adjust system analysis trigger contract", () => {
  it("keeps the header entry connected to local system analysis state", () => {
    const source = readSrc("pages/Adjust.jsx");
    const ineligibleBranchIndex = source.indexOf("!systemAnalysisEligibility?.eligible");
    const requestIndex = source.indexOf("requestAiSystemAnalysis({");

    expect(source).toContain("requestAiSystemAnalysis");
    expect(source).toContain("SystemAnalysisResultPreview");
    expect(source).toContain("SystemAnalysisCorrectionReview");
    expect(source).toContain("buildSystemAnalysisCorrectionReview");
    expect(source).toContain("buildSystemAnalysisApplicationPreview");
    expect(source).toContain("applySystemAnalysisSelectedCorrections");
    expect(source).toContain("createSystemAnalysisRecord");
    expect(source).toContain("upsertSystemAnalysisRecord");
    expect(source).toContain("findReusableSystemAnalysisRecord");
    expect(source).toContain("markSystemAnalysisRecordApplied");
    expect(source).toContain("useAuth");
    expect(source).toContain("systemAnalysisEligibility?.eligible");
    expect(source).toContain('status: "loading"');
    expect(source).toContain('status: "success"');
    expect(source).toContain('status: "ineligible"');
    expect(source).toContain("AbortController");
    expect(source).toContain("SYSTEM_ANALYSIS_INELIGIBLE_MESSAGE");
    expect(source).toContain("showSystemAnalysisReview");
    expect(source).toContain("selectedSystemAnalysisCorrectionIds");
    expect(source).toContain("preparedSystemAnalysisApplicationPreview");
    expect(source).toContain("systemAnalysisApplicationState");
    expect(ineligibleBranchIndex).toBeGreaterThan(-1);
    expect(requestIndex).toBeGreaterThan(-1);
    expect(ineligibleBranchIndex).toBeLessThan(requestIndex);
  });

  it("keeps PlanningRepairModel behind the system-analysis apply helper", () => {
    const source = readSrc("pages/Adjust.jsx");

    expect(source).not.toContain("PlanningRepairModel");
    expect(source).not.toContain("applyOccurrenceRepair");
    expect(source).not.toContain("applyReduceLoadPlan");
    expect(source).toContain("applySystemAnalysisSelectedCorrections");
  });

  it("requires final confirmation before the application helper commits data", () => {
    const source = readSrc("pages/Adjust.jsx");
    const previewIndex = source.indexOf("<SystemAnalysisResultPreview");
    const reviewIndex = source.indexOf("<SystemAnalysisCorrectionReview");
    const prepareIndex = source.indexOf("handleConfirmSystemAnalysisCorrections");
    const applyIndex = source.indexOf("handleApplySystemAnalysisCorrections");
    const setDataIndex = source.indexOf("setData((current) =>", applyIndex);
    const applyHandlerSource = source.slice(applyIndex, source.indexOf("const systemAnalysisHeaderAction"));

    expect(source).toContain("handleOpenSystemAnalysisCorrections");
    expect(source).toContain("handleToggleSystemAnalysisCorrection");
    expect(source).toContain("handleConfirmSystemAnalysisCorrections");
    expect(source).toContain("handleApplySystemAnalysisCorrections");
    expect(source).toContain("setPreparedSystemAnalysisApplicationPreview");
    expect(source).toContain("setSystemAnalysisConfirmationOpen(true)");
    expect(source).toContain("setData((current) =>");
    expect(source).toContain("markSystemAnalysisRecordApplied");
    expect(source).toContain("onApplySelectedCorrections={handleApplySystemAnalysisCorrections}");
    expect(previewIndex).toBeGreaterThan(-1);
    expect(reviewIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeLessThan(reviewIndex);
    expect(prepareIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeGreaterThan(prepareIndex);
    expect(setDataIndex).toBeGreaterThan(applyIndex);
    expect(applyHandlerSource).not.toContain("requestAiSystemAnalysis");
  });

  it("persists validated results and reuses an exact local history match before calling the backend", () => {
    const source = readSrc("pages/Adjust.jsx");
    const reuseIndex = source.indexOf("findReusableSystemAnalysisRecord(systemAnalysisHistory");
    const requestIndex = source.indexOf("requestAiSystemAnalysis({");
    const createIndex = source.indexOf("createSystemAnalysisRecord({");
    const upsertIndex = source.indexOf("upsertSystemAnalysisRecord(", createIndex);

    expect(reuseIndex).toBeGreaterThan(-1);
    expect(requestIndex).toBeGreaterThan(-1);
    expect(reuseIndex).toBeLessThan(requestIndex);
    expect(createIndex).toBeGreaterThan(requestIndex);
    expect(upsertIndex).toBeGreaterThan(createIndex);
    expect(source).toContain("validateSystemAnalysisResult(result.result");
  });

  it("shows latest persisted analysis through the compact preview model", () => {
    const source = readSrc("pages/Adjust.jsx");
    const recommendationIndex = source.indexOf("adjustRecommendationCard adjustRecommendationCard--primary");
    const previewIndex = source.indexOf("<SystemAnalysisResultPreview");

    expect(source).toContain("buildSystemAnalysisHistoryDisplayModel");
    expect(source).toContain("displayedSystemAnalysisPreviewState");
    expect(source).toContain("title={displayedSystemAnalysisPreviewState.title}");
    expect(source).toContain("staleNote={displayedSystemAnalysisPreviewState.staleNote}");
    expect(recommendationIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeGreaterThan(-1);
    expect(recommendationIndex).toBeLessThan(previewIndex);
  });

  it("renders the running header state while a request is in progress", () => {
    const html = renderToStaticMarkup(
      <Adjust data={eligibleData()} systemAnalysisAvailabilityState="running" />
    );

    expect(html).toContain("Analyse en cours");
    expect(html).toContain('data-system-analysis-state="running"');
    expect(html).toContain("disabled");
  });

  it("keeps thin-data entry locked but explanatory so the local guard handles taps", () => {
    const html = renderToStaticMarkup(<Adjust data={thinData()} />);

    expect(html).toContain("Analyse système");
    expect(html).toContain('data-system-analysis-state="locked"');
    expect(html).toContain('data-system-analysis-explanatory="true"');
    expect(html).not.toContain("disabled=\"\"");
  });

  it("keeps the deterministic recommendation before any analysis preview surface", () => {
    const source = readSrc("pages/Adjust.jsx");
    const recommendationIndex = source.indexOf("adjustRecommendationCard adjustRecommendationCard--primary");
    const previewIndex = source.indexOf("<SystemAnalysisResultPreview");

    expect(recommendationIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeGreaterThan(-1);
    expect(recommendationIndex).toBeLessThan(previewIndex);
  });
});
