import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("home today canonical contract", () => {
  it("wires canonical session and future session fields from todayNowModel", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("activeSessionForActiveDate");
    expect(home).toContain("openSessionOutsideActiveDate");
    expect(home).toContain("futureSessions");
    expect(home).toContain("plannedActionsForActiveDate");
    expect(home).toContain("focusOccurrenceForActiveDate");
    expect(home).toContain("const aiNowContextSignature = useMemo(");
    expect(home).toContain("createAiNowContextSignature({");
    expect(home).toContain("activeSessionId: activeSessionForActiveDate?.id || activeSessionForActiveDate?.occurrenceId || null");
    expect(home).toContain("contextSignature: aiNowContextSignature");
    expect(home).toContain("const localGapSummary = useMemo(");
    expect(home).toContain("buildLocalGapSummary({");
    expect(home).toContain("gapSummary: localGapSummary");
  });

  it("renders the simplified Today v2 stack instead of legacy reorderable cards", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("<TodayHero");
    expect(home).toContain("<TodayNextActions");
    expect(home).toContain("<TodayDailyState");
    expect(home).not.toContain("<SortableBlocks");
    expect(home).not.toContain("onReorder={handleVisibleReorder}");
    expect(home).not.toContain("<CalendarCard");
    expect(home).not.toContain("<MicroActionsCard");
    expect(home).not.toContain('data-tour-id="today-notes-card"');
  });

  it("passes decision-oriented hero props and ai-priority next actions", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("const heroImpactText = useMemo(");
    expect(home).toContain("const heroContributionLabel =");
    expect(home).toContain("const heroAiStatusLabel = useMemo(");
    expect(home).toContain("const heroTimestampLabel = useMemo(");
    expect(home).toContain("const isHeroPreparing =");
    expect(home).toContain("impactText={heroImpactText}");
    expect(home).toContain("contributionLabel={heroContributionLabel}");
    expect(home).toContain("reasonLinkType={heroViewModel.reasonLinkType || \"\"}");
    expect(home).toContain("aiStatusLabel={heroAiStatusLabel}");
    expect(home).toContain("timestampLabel={heroTimestampLabel}");
    expect(home).toContain("isPreparing={isHeroPreparing}");
    expect(home).toContain("isAiPriority:");
  });

  it("logs today coach diagnostics in local dev with a visible console log", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("const todayDecisionDiagnostics = useMemo(");
    expect(home).toContain("const isLocalHost =");
    expect(home).toContain('window.location?.hostname === "localhost"');
    expect(home).toContain('window.location?.hostname === "127.0.0.1"');
    expect(home).toContain("if (!isDev && !isLocalHost) return;");
    expect(home).toContain('console.log("[today-coach]", todayDecisionDiagnostics);');
  });

  it("guards session start with the shared temporal policy and wires the typing reveal", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("resolveTodayOccurrenceStartPolicy");
    expect(home).toContain("if (!startPolicy.canStartDirectly) return;");
    expect(home).toContain("const typedHeroTitle = useTypingReveal(");
    expect(home).toContain("const shouldAnimateCoachResponse =");
    expect(home).toContain('aiNow.requestDiagnostics.deliverySource === "network"');
    expect(home).toContain("aiNow.requestDiagnostics.hadVisibleLoading");
    expect(home).toContain("deriveTodayHeroChrome({");
    expect(home).toContain("todayDecisionDiagnostics");
    expect(home).not.toContain("const typedHeroHint = useTypingReveal(");
  });

  it("routes the planning CTA to today with the active category preserved", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("const openPlanningForToday = useCallback(() => {");
    expect(home).toContain("selectedDateKey: localTodayKey");
    expect(home).toContain("selectedDate: localTodayKey");
    expect(home).toContain("planning: executionCategoryId || focusCategory?.id || getSelectedCategoryForView(prev, CATEGORY_VIEW.TODAY) || null");
    expect(home).toContain("onOpenPlanning={openPlanningForToday}");
  });

  it("computes daily state from planned minutes, runtime seconds and remaining load", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain('if (status === "canceled" || status === "skipped") return sum;');
    expect(home).toContain('if (occurrence?.status !== "done") return sum;');
    expect(home).toContain("Math.round(runtimeEntry.timerSeconds / 60)");
    expect(home).toContain("remainingMinutes: Math.max(plannedMinutes - doneMinutes, 0)");
  });

  it("keeps a concrete planifier aujourd'hui fallback for passive Today states", () => {
    const adapter = readSrc("features/today/aiNowHeroAdapter.js");
    const home = readSrc("pages/Home.jsx");

    expect(adapter).toContain('primaryLabel: activeDate === systemTodayKey ? "Planifier aujourd’hui" : "Aucune action active"');
    expect(adapter).toContain('primaryLabel: gapSummary.selectionScope === "structure_missing" ? "Structurer" : "Planifier aujourd’hui"');
    expect(adapter).toContain("gapSummary?.hasGapToday");
    expect(adapter).toContain('gapSummary.selectionScope === "cross_category"');
    expect(home).toContain("computeCategoryScopedRecommendation");
    expect(home).toContain("const scopedFocusOccurrence = localGapSummary?.recommendedOccurrence || null;");
    expect(home).toContain("reasonLinkLabel={heroViewModel.reasonLinkLabel || \"\"}");
    expect(adapter).not.toContain('primaryLabel: "Aucune action active"');
  });
});
