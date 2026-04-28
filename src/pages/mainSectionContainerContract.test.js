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
    const todayHero = readSrc("components/today/TodayHero.jsx");
    const primaryAction = readSrc("components/today/PrimaryActionCard.jsx");
    const todayTimeline = readSrc("components/today/TodayTimeline.jsx");
    const aiInsight = readSrc("components/today/AIInsightCard.jsx");
    const objectives = readSrc("pages/Objectives.jsx");
    const timeline = readSrc("pages/Timeline.jsx");
    const insights = readSrc("pages/Insights.jsx");
    const coach = readSrc("pages/Coach.jsx");

    expect(home).toContain("todayCockpitScreen");
    expect(home).toContain("<TodayHero");
    expect(home).toContain("<PrimaryActionCard");
    expect(home).toContain("<TodayTimeline");
    expect(home).toContain("<AIInsightCard");
    expect(home).not.toContain("lovableTodayInsight");
    expect(todayHero).toContain("todayDiagnosticHero");
    expect(primaryAction).toContain("todayPrimaryActionCard");
    expect(todayTimeline).toContain("todayTimelineCard");
    expect(aiInsight).toContain("todayAiInsightCard");
    expect(objectives).toContain("lovableObjectiveCard");
    expect(objectives).toContain("ObjectiveRing");
    expect(timeline).toContain("lovableTimelineList");
    expect(timeline).toContain("lovableTimelineCard");
    expect(insights).toContain("lovableChartCard");
    expect(insights).toContain("lovableMetricCard");
    expect(coach).toContain("lovableCoachMessages");
    expect(coach).toContain("lovableCoachComposer");
  });
});
