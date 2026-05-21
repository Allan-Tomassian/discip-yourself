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

function recentUsableData() {
  const data = eligibleData();
  return {
    ...data,
    ui: {
      ...data.ui,
      firstRunV1: {
        ...data.ui.firstRunV1,
        commitV1: { status: "applied", appliedAt: "2026-05-18T10:00:00.000Z" },
      },
    },
  };
}

function emptyData() {
  return {
    categories: [],
    goals: [],
    occurrences: [],
    sessionHistory: [],
    ui: { selectedDateKey: ACTIVE_DATE },
  };
}

function latestAnalysisResult() {
  return {
    version: 1,
    period: { startDateKey: "2026-05-14", endDateKey: ACTIVE_DATE, days: 7 },
    executiveSummary: "Le dernier audit reste disponible après rechargement.",
    invisibleFriction: [{ title: "Charge concentrée" }],
    systemWeaknesses: [],
    strongestPatterns: [],
    recommendedCorrections: [{ title: "Réduire un bloc" }],
    correctionDraft: {
      correctedLoad: {
        targetBlocksPerDay: 2,
        maxDailyMinutes: 90,
        reason: "Charge plus tenable.",
      },
      occurrenceAdjustments: [{
        occurrenceId: "occ_0",
        action: "reduce_duration",
        proposedDurationMinutes: 30,
        reason: "Version plus faisable.",
        confidence: 0.8,
      }],
      objectiveAdjustments: [],
      actionAdjustments: [],
      next7DaysPlan: [],
      validationRequirements: ["user_confirmation"],
      userConfirmationRequired: true,
    },
    next7DaysFocus: [{ title: "Protéger deux blocs courts" }],
    coachQuestions: [],
    confidence: 0.72,
    dataLimitations: ["Snapshot compact."],
    safetyNotes: [],
    generatedAt: "2026-05-20T12:30:00.000Z",
    modelMeta: { model: "test", promptVersion: "system_analysis_v1_0", requestId: "req-1" },
  };
}

function dataWithLatestAnalysis() {
  const data = eligibleData();
  const result = latestAnalysisResult();
  data.system_analysis_v1 = {
    version: 1,
    latestAnalysisId: "analysis_latest",
    analyses: [{
      id: "analysis_latest",
      version: 1,
      source: "premium_system_analysis",
      status: "applied",
      snapshotHash: "old_snapshot_hash",
      period: result.period,
      referenceDateKey: ACTIVE_DATE,
      generatedAt: result.generatedAt,
      savedAt: result.generatedAt,
      result,
      summary: {
        executiveSummary: result.executiveSummary,
        invisibleFriction: ["Charge concentrée"],
        recommendedCorrections: ["Réduire un bloc"],
        next7DaysFocus: ["Protéger deux blocs courts"],
        dataLimitations: ["Snapshot compact."],
      },
      eligibilityAtRun: { eligible: true },
      appliedCorrectionIds: ["occurrence:0:occ_0:reduce_duration"],
      changedOccurrenceIds: ["occ_0"],
      appliedAt: "2026-05-20T14:00:00.000Z",
      modelMeta: result.modelMeta,
      snapshotMeta: { sourceCounts: { occurrences: 10 }, dataLimitations: ["Snapshot compact."] },
    }],
  };
  return data;
}

describe("Adjust system analysis trigger contract", () => {
  it("keeps the header entry connected to local system analysis state", () => {
    const source = readSrc("pages/Adjust.jsx");
    const ineligibleBranchIndex = source.indexOf("!systemAnalysisEligibility?.eligible");
    const requestIndex = source.indexOf("requestAiSystemAnalysis({");

    expect(source).toContain("requestAiSystemAnalysis");
    expect(source).toContain("SystemAnalysisCommandSheet");
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
    expect(source).toContain("AbortController");
    expect(source).toContain("systemAnalysisSheetOpen");
    expect(source).toContain('return "data_limited"');
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
    const prepareIndex = source.indexOf("handleConfirmSystemAnalysisCorrections");
    const applyIndex = source.indexOf("handleApplySystemAnalysisCorrections");
    const setDataIndex = source.indexOf("setData((current) =>", applyIndex);
    const applyHandlerSource = source.slice(applyIndex, source.indexOf("const systemAnalysisHeaderAction"));

    expect(source).toContain("handleToggleSystemAnalysisCorrection");
    expect(source).toContain("handleConfirmSystemAnalysisCorrections");
    expect(source).toContain("handleApplySystemAnalysisCorrections");
    expect(source).toContain("setPreparedSystemAnalysisApplicationPreview");
    expect(source).toContain("setSystemAnalysisConfirmationOpen(true)");
    expect(source).toContain("setData((current) =>");
    expect(source).toContain("markSystemAnalysisRecordApplied");
    expect(source).toContain("onApplySelectedCorrections={handleApplySystemAnalysisCorrections}");
    expect(source).toContain('return "final_confirmation"');
    expect(source).toContain('return "applied_success"');
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

  it("routes latest persisted analysis through the command sheet instead of inline preview", () => {
    const source = readSrc("pages/Adjust.jsx");
    const recommendationIndex = source.indexOf("adjustRecommendationCard adjustRecommendationCard--primary");
    const sheetIndex = source.indexOf("<SystemAnalysisCommandSheet");

    expect(source).toContain("buildSystemAnalysisHistoryDisplayModel");
    expect(source).toContain("displayedSystemAnalysisPreviewState");
    expect(source).toContain('"latest_analysis"');
    expect(source).toContain("staleNote={displayedSystemAnalysisPreviewState.staleNote}");
    expect(source).not.toContain("<SystemAnalysisResultPreview");
    expect(source).not.toContain('data-system-analysis-preview-anchor="true"');
    expect(recommendationIndex).toBeGreaterThan(-1);
    expect(sheetIndex).toBeGreaterThan(recommendationIndex);
  });

  it("does not render a reload-shaped latest analysis inline in the Ajuster stack", () => {
    const html = renderToStaticMarkup(<Adjust data={dataWithLatestAnalysis()} />);

    expect(html).toContain("Analyser le système");
    expect(html).toContain("RECOMMANDATION");
    expect(html).not.toContain("Dernière analyse");
    expect(html).not.toContain("Le dernier audit reste disponible après rechargement.");
  });

  it("renders the running header state while a request is in progress", () => {
    const html = renderToStaticMarkup(
      <Adjust data={eligibleData()} systemAnalysisAvailabilityState="running" />
    );

    expect(html).toContain("Analyse en cours");
    expect(html).toContain('data-system-analysis-state="running"');
    expect(html).toContain("disabled");
  });

  it("keeps recent usable systems on the intro-capable entry path", () => {
    const html = renderToStaticMarkup(<Adjust data={recentUsableData()} />);

    expect(html).toContain("Analyser le système");
    expect(html).toContain('data-system-analysis-state="available"');
    expect(html).not.toContain("Activation trop récente");
    expect(html).not.toContain('data-system-analysis-explanatory="true"');
    expect(html).not.toContain("disabled=\"\"");
  });

  it("allows thin planned data to open the initial-analysis entry path", () => {
    const html = renderToStaticMarkup(<Adjust data={thinData()} />);

    expect(html).toContain("Analyser le système");
    expect(html).toContain('data-system-analysis-state="available"');
    expect(html).not.toContain('data-system-analysis-explanatory="true"');
    expect(html).not.toContain("disabled=\"\"");
  });

  it("keeps empty-system entry explanatory so the local guard avoids backend calls", () => {
    const html = renderToStaticMarkup(<Adjust data={emptyData()} />);

    expect(html).toContain("Analyse système");
    expect(html).toContain('data-system-analysis-state="locked"');
    expect(html).toContain('data-system-analysis-explanatory="true"');
    expect(html).not.toContain("disabled=\"\"");
  });

  it("removes entry-triggered scroll and inline preview surfaces from Ajuster", () => {
    const source = readSrc("pages/Adjust.jsx");

    expect(source).not.toContain("systemAnalysisPreviewRef");
    expect(source).not.toContain("systemAnalysisFeedbackOrigin");
    expect(source).not.toContain("SYSTEM_ANALYSIS_ENTRY_FEEDBACK_STATUSES");
    expect(source).not.toContain("scrollIntoView");
    expect(source).not.toContain("(prefers-reduced-motion: reduce)");
    expect(source).toContain('"loading"');
    expect(source).toContain('"premium_required"');
    expect(source).toContain('"quota_exhausted"');
    expect(source).toContain('"timeout"');
    expect(source).toContain('"error"');
    expect(source).toContain('"success"');
  });

  it("keeps the deterministic recommendation before the command sheet mount point", () => {
    const source = readSrc("pages/Adjust.jsx");
    const recommendationIndex = source.indexOf("adjustRecommendationCard adjustRecommendationCard--primary");
    const sheetIndex = source.indexOf("<SystemAnalysisCommandSheet");
    const ajusterStack = source.slice(
      source.indexOf('<div className="adjustCommandPage'),
      sheetIndex
    );

    expect(recommendationIndex).toBeGreaterThan(-1);
    expect(sheetIndex).toBeGreaterThan(recommendationIndex);
    expect(ajusterStack).not.toContain("SystemAnalysisResultPreview");
    expect(ajusterStack).not.toContain("SystemAnalysisCorrectionReview");
  });
});
