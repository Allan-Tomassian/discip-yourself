import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("home today cockpit contract", () => {
  it("keeps Today bound through the TodayData adapter", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("buildTodayData({");
    expect(home).toContain("manualTodayAnalysis");
    expect(home).toContain("visualSmokeModel");
    expect(home).toContain("dataLoading");
    expect(home).toContain("dataLoadError");
    expect(home).toContain("hasCachedData");
    expect(home).toContain("isOnline");
    expect(home).toContain("todayData.state");
    expect(home).toContain("todayData.primaryAction");
    expect(home).not.toContain("deriveTodayV2State");
    expect(home).not.toContain("todayShellModel");
  });

  it("renders only the validated premium cockpit stack", () => {
    const home = readSrc("pages/Home.jsx");
    const hero = readSrc("components/today/TodayHero.jsx");
    const primary = readSrc("components/today/PrimaryActionCard.jsx");
    const timeline = readSrc("components/today/TodayTimeline.jsx");
    const ai = readSrc("components/today/AIInsightCard.jsx");

    expect(home).toContain('pageId="today"');
    expect(home).toContain('className={todayCockpitClassName}');
    expect(home).toContain('className="todayCockpitShell"');
    expect(home).toContain("<TodayHeader");
    expect(home).toContain("<FloatingWelcomeLine");
    expect(home).toContain("<TodayHero");
    expect(home).toContain("<PrimaryActionCard");
    expect(home).toContain("<TodayTimeline");
    expect(home).toContain("<AIInsightCard");
    expect(hero).toContain('data-testid="today-hero-card"');
    expect(primary).toContain('data-testid="today-primary-action-card"');
    expect(timeline).toContain('data-testid="today-timeline-card"');
    expect(ai).toContain('data-testid="today-ai-insight-card"');
    expect(home).not.toContain("<TodayNextActions");
    expect(home).not.toContain("<TodayDailyState");
    expect(home).not.toContain("<TodayValuePulse");
    expect(home).not.toContain("<CalendarCard");
    expect(home).not.toContain("<MicroActionsCard");
    expect(home).not.toContain('data-tour-id="today-notes-card"');
  });

  it("bridges cockpit actions without the legacy shell model", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("const runPrimaryCockpitAction = useCallback(() => {");
    expect(home).toContain("const action = todayData.primaryAction || {};");
    expect(home).toContain('action.status === "in_progress"');
    expect(home).toContain("handleStartSession(occurrence)");
    expect(home).toContain('todayData.state === "empty_day"');
    expect(home).toContain("openCoachPlan(");
    expect(home).toContain("const handlePrimarySecondary = useCallback(() => {");
    expect(home).toContain("const handlePrimaryDetail = useCallback(() => {");
    expect(home).toContain("openPlanningForToday");
    expect(home).toContain("openCoachInsight");
    expect(home).not.toContain("handleTodayHeroAction(todayShellModel.hero.primaryAction)");
    expect(home).not.toContain("canHandleTodayHeroAction(todayShellModel.hero.primaryAction)");
  });

  it("preserves session and planning safeguards used by the cockpit", () => {
    const home = readSrc("pages/Home.jsx");

    expect(home).toContain("deriveTodayNowModel({");
    expect(home).toContain("activeSessionForActiveDate");
    expect(home).toContain("ensureProcessIds");
    expect(home).toContain("resolveTodayOccurrenceStartPolicy");
    expect(home).toContain("if (!startPolicy.canStartDirectly) return;");
    expect(home).toContain("resolveRuntimeSessionGate");
    expect(home).toContain("ensureWindowFromScheduleRules");
    expect(home).toContain("backfillMissedOccurrences");
    expect(home).toContain("ui: withExecutionActiveCategoryId(");
    expect(home).toContain("selectedDateKey: localTodayKey");
  });

  it("removes obsolete Today-only quick actions, notes, reorder, reward, and global-create remnants", () => {
    const home = readSrc("pages/Home.jsx");
    const app = readSrc("App.jsx");

    expect(home).not.toContain("todayBlocksOrder");
    expect(home).not.toContain("handleReorder");
    expect(home).not.toContain("TodayNextActions");
    expect(home).not.toContain("TodayDailyState");
    expect(home).not.toContain("TodayValuePulse");
    expect(home).not.toContain("completeMicroAction");
    expect(home).not.toContain("setRewardedAdPresenter");
    expect(home).not.toContain("showRewardedAd");
    expect(home).not.toContain("ensureTotemV1");
    expect(home).not.toContain("dailyNote");
    expect(home).not.toContain("noteHistory");
    expect(app).not.toContain("LovableCreateMenu");
    expect(app).not.toContain("globalCreationSurfaceEnabled");
    expect(app).not.toContain("universalCapturePreview");
  });
});
