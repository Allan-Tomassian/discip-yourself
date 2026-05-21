import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("main section container contract", () => {
  it("defines a shared main section recipe in Gate premium styles", () => {
    const gate = readSrc("shared/ui/gate/Gate.jsx");
    const gateCss = readSrc("shared/ui/gate/gate.css");
    const premiumCss = readSrc("shared/ui/gate/gate-premium.css");

    expect(gate).toContain("export function GateSectionIntro");
    expect(gateCss).toContain(".gateSectionIntro");
    expect(gateCss).toContain(".gateSectionIntroActions");
    expect(premiumCss).toContain(".GateMainSection");
    expect(premiumCss).toContain(".GateMainSectionCard");
    expect(premiumCss).toContain(".GateSecondarySectionCard");
    expect(premiumCss).toContain(".GateAnalyticsCard");
    expect(premiumCss).toContain(".GateInlineMetaCard");
    expect(premiumCss).toContain("var(--categoryUiBorder, var(--gate-border))");
    expect(premiumCss).toContain(".GateMainSection .gateSectionBody");
  });

  it("uses the Lovable shell grammar across the five main tabs", () => {
    const home = readSrc("pages/Home.jsx");
    const todayTrajectory = readSrc("components/today/TodayTrajectoryCard.jsx");
    const primaryAction = readSrc("components/today/PrimaryActionCard.jsx");
    const todayTimeline = readSrc("components/today/TodayTimeline.jsx");
    const aiInsight = readSrc("components/today/AIInsightCard.jsx");
    const objectives = readSrc("pages/Objectives.jsx");
    const timeline = readSrc("pages/Timeline.jsx");
    const adjust = readSrc("pages/Adjust.jsx");
    const coach = readSrc("pages/Coach.jsx");

    expect(home).toContain("todayCockpitScreen");
    expect(home).toContain("<TodayTrajectoryCard");
    expect(home).not.toContain("<TodayHero");
    expect(home).toContain("<PrimaryActionCard");
    expect(home).toContain("<TodayTimeline");
    expect(home).toContain("<AIInsightCard");
    expect(home).not.toContain("lovableTodayInsight");
    expect(todayTrajectory).toContain("todayTrajectoryCard");
    expect(primaryAction).toContain("todayPrimaryActionCard");
    expect(todayTimeline).toContain("todayTimelineCard");
    expect(aiInsight).toContain("todayAiInsightCard");
    expect(objectives).toContain("objectivesCommandCard");
    expect(objectives).toContain("CommandSectionHeader");
    expect(timeline).toContain("timelineCommandPage");
    expect(timeline).toContain("CommandMotionReveal");
    expect(timeline).toContain("CommandSectionHeader");
    expect(timeline).toContain("CommandEmptyState");
    expect(timeline).toContain("timelineDateStrip");
    expect(timeline).toContain("timelineDateSeparator");
    expect(timeline).toContain("timelineNextFocusCard");
    expect(timeline).toContain("getTimelineDisplayTime");
    expect(timeline).toContain("lovableTimelineCardButton");
    expect(timeline).not.toContain('tone="ai"');
    expect(adjust).toContain("adjustCommandPage");
    expect(adjust).toContain("CommandMotionReveal");
    expect(adjust).toContain("buildAdjustDiagnostic");
    expect(adjust).toContain("CommandAIBlock");
    expect(adjust).toContain("CommandEmptyState");
    expect(adjust).toContain("visibleFrictionSignals");
    expect(coach).toContain("lovableCoachMessages");
    expect(coach).toContain("lovableCoachComposer");
  });

  it("applies the shared bottom-clearance token to the main route styles", () => {
    const indexCss = readSrc("index.css");
    const todayCss = readSrc("features/today/today.css");
    const objectivesCss = readSrc("features/objectives/objectives.css");
    const timelineCss = readSrc("features/planning/timeline.css");
    const coachCss = readSrc("styles/lovable.css");
    const adjustCss = readSrc("features/adjust/adjust.css");
    const commandCss = readSrc("shared/ui/command/command.css");

    expect(indexCss).toContain("--main-tab-bottom-clearance");
    expect(indexCss).toContain("--main-tab-bottom-padding");
    expect(todayCss).toContain("var(--main-tab-bottom-clearance");
    expect(objectivesCss).toContain("var(--main-tab-bottom-clearance");
    expect(timelineCss).toContain("var(--main-tab-bottom-clearance");
    expect(coachCss).toContain("var(--main-tab-bottom-clearance");
    expect(adjustCss).toContain("var(--main-tab-bottom-clearance");
    expect(commandCss).toContain(".CommandMotionReveal");
    expect(commandCss).toContain(".CommandPressFeedback");
    expect(commandCss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
