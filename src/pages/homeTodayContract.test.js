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
    expect(home).toContain("const todayAnalysisContextKey = useMemo(");
    expect(home).toContain("buildTodayManualAiContextKey({");
    expect(home).toContain("const manualTodayAnalysis = useManualAiAnalysis({");
    expect(home).toContain("contextKey: todayAnalysisContextKey");
    expect(home).toContain("const localGapSummary = useMemo(");
    expect(home).toContain("buildLocalGapSummary({");
    expect(home).toContain("gapSummary: localGapSummary");
  });

  it("renders the simplified Today v2 stack instead of legacy reorderable cards", () => {
    const home = readSrc("pages/Home.jsx");
    const hero = readSrc("components/today/TodayHero.jsx");
    const nextActions = readSrc("components/today/TodayNextActions.jsx");
    const stateModel = readSrc("features/today/todayV2State.js");

    expect(home).toContain('pageId="today"');
    expect(home).toContain("greetingPeriod");
    expect(home).toContain("headerDateLabel");
    expect(home).toContain("<AppScreen");
    expect(home).toContain("const todayV2State = useMemo(");
    expect(home).toContain("deriveTodayV2State({");
    expect(stateModel).toContain('state: "ready"');
    expect(stateModel).toContain('state: "clarify"');
    expect(stateModel).toContain('state: "overload"');
    expect(stateModel).toContain('state: "validated"');
    expect(home).toContain('className="lovableSectionLabel">{TODAY_SCREEN_COPY.priorityTitle}<');
    expect(home).toContain("<TodayHero");
    expect(home).toContain("<TodayNextActions");
    expect(home).toContain("<TodayDailyState");
    expect(hero).toContain('className="lovableCard lovablePriorityCard"');
    expect(hero).toContain('className="lovablePrimaryButton"');
    expect(hero).toContain("secondaryLabel");
    expect(hero).toContain("durationLabel");
    expect(nextActions).toContain('className="lovableTodayActionRow"');
    expect(nextActions).toContain("actions.slice(0, 2)");
    expect(nextActions).not.toContain("lovableEmptyTitle");
    expect(home).not.toContain("<SortableBlocks");
    expect(home).not.toContain("onReorder={handleVisibleReorder}");
    expect(home).not.toContain("<CalendarCard");
    expect(home).not.toContain("<MicroActionsCard");
    expect(home).not.toContain('data-tour-id="today-notes-card"');
    expect(home).not.toContain('className="lovableCard lovableTodayInsight"');
    expect(home).not.toContain('className="lovableTodayQuote"');
  });

  it("passes decision-oriented hero props and ai-priority next actions", () => {
    const home = readSrc("pages/Home.jsx");
    const hero = readSrc("components/today/TodayHero.jsx");

    expect(home).toContain("const heroImpactText = useMemo(");
    expect(home).toContain("const heroContributionLabel =");
    expect(home).toContain("const heroDisplayCategory =");
    expect(home).toContain("reason={todayV2State.hero.reason}");
    expect(home).toContain("contributionLabel={heroContributionLabel}");
    expect(home).toContain("recommendedCategoryLabel={todayV2State.hero.categoryLabel || heroDisplayCategoryName}");
    expect(home).toContain("primaryLabel={todayV2State.hero.primaryLabel || TODAY_SCREEN_COPY.primaryAction}");
    expect(home).toContain("secondaryLabel={todayV2State.hero.secondaryLabel || \"\"}");
    expect(hero).not.toContain("AppCard");
    expect(home).toContain("todayV2State.alternatives");
    expect(home).not.toContain("helpText=");
    expect(home).not.toContain("reasonLinkType=");
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
    expect(home).toContain('manualTodayAnalysis.requestDiagnostics.deliverySource === "network"');
    expect(home).toContain("manualTodayAnalysis.requestDiagnostics.hadVisibleLoading");
    expect(home).toContain("todayDecisionDiagnostics");
    expect(home).not.toContain("const typedHeroHint = useTypingReveal(");
  });

  it("keeps the planning bridge available in logic while removing it from the new Today render", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("const openPlanningForToday = useCallback(() => {");
    expect(home).toContain("selectedDateKey: localTodayKey");
    expect(home).toContain("selectedDate: localTodayKey");
    expect(home).toContain("ui: withExecutionActiveCategoryId(");
    expect(home).toContain("executionCategoryId || focusCategory?.id || getSelectedCategoryForView(prev, CATEGORY_VIEW.TODAY) || null");
    expect(home).not.toContain("planning: executionCategoryId || focusCategory?.id || getSelectedCategoryForView(prev, CATEGORY_VIEW.TODAY) || null");
    expect(home).toContain('kind === "open_planning_for_today"');
  });

  it("computes daily state from planned minutes, runtime seconds and remaining load", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain('if (status === "canceled" || status === "skipped") return sum;');
    expect(home).toContain('if (occurrence?.status !== "done") return sum;');
    expect(home).toContain("Math.round(runtimeEntry.timerSeconds / 60)");
    expect(home).toContain("remainingMinutes: Math.max(plannedMinutes - doneMinutes, 0)");
  });

  it("keeps the local-gap fallback while removing the old analyze CTA from render", () => {
    const adapter = readSrc("features/today/aiNowHeroAdapter.js");
    const home = readSrc("pages/Home.jsx");

    expect(adapter).toContain('primaryLabel: activeDate === systemTodayKey ? "Planifier aujourd’hui" : "Aucune action active"');
    expect(adapter).toContain('kind: gapSummary.selectionScope === "structure_missing" ? "open_library" : "open_pilotage"');
    expect(adapter).toContain("gapSummary?.hasGapToday");
    expect(adapter).toContain('gapSummary.selectionScope === "cross_category"');
    expect(home).toContain("computeCategoryScopedRecommendation");
    expect(home).toContain("const scopedFocusOccurrence = localGapSummary?.recommendedOccurrence || null;");
    expect(home).not.toContain("const heroAnalyzeLabel = manualTodayAnalysis.isPersistedForContext ? UI_COPY.refreshAnalysis : UI_COPY.analyzePriority;");
    expect(home).not.toContain("reasonLinkLabel={heroViewModel.reasonLinkLabel || \"\"}");
  });

  it("opens contextual coach and creation CTA from today v2", () => {
    const app = readSrc("App.jsx");
    const home = readSrc("pages/Home.jsx");
    const coach = readSrc("pages/Coach.jsx");
    const controller = readSrc("features/coach/coachPanelController.js");

    expect(app).toContain("prefill: \"\"");
    expect(app).toContain("onOpenCoachGuided={({ mode = \"free\", prefill = \"\" } = {}) => {");
    expect(app).toContain("requestedPrefill={coachState.prefill}");
    expect(home).toContain("onOpenCreateHabit");
    expect(home).toContain('action.kind === "open_coach"');
    expect(home).toContain('action.kind === "open_create_habit"');
    expect(coach).toContain("requestedPrefill = \"\"");
    expect(controller).toContain("shouldApplyCoachRequestedPrefill");
    expect(controller).toContain("requestedPrefill = \"\"");
  });
});
