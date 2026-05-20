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
      { id: "goal_focus", type: "PROCESS", title: "Focus profond", categoryId: "cat_work", parentId: "out_focus", durationMinutes: 45 },
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

describe("Adjust system analysis entry", () => {
  it("renders an enabled premium header entry when eligible", () => {
    const html = renderToStaticMarkup(<Adjust data={eligibleData()} />);

    expect(html).toContain("pageHeaderRight");
    expect(html).toContain("systemAnalysisEntryButton");
    expect(html).toContain("Analyser le système");
    expect(html).toContain('data-system-analysis-state="available"');
    expect(html).toContain('data-system-analysis-tone="ai"');
    expect(html).not.toContain("systemAnalysisCard");
  });

  it("renders a locked compact header entry for thin data", () => {
    const html = renderToStaticMarkup(<Adjust data={thinData()} />);

    expect(html).toContain("Analyse système");
    expect(html).toContain('data-system-analysis-state="locked"');
    expect(html).toContain('data-system-analysis-tone="ai"');
    expect(html).toContain('data-system-analysis-explanatory="true"');
    expect(html).not.toContain("disabled=\"\"");
  });

  it("keeps the diagnostic recommendation before friction details", () => {
    const html = renderToStaticMarkup(<Adjust data={eligibleData()} />);
    const recommendationIndex = html.indexOf("adjustRecommendationCard");
    const frictionIndex = html.indexOf("adjust-friction-title");

    expect(recommendationIndex).toBeGreaterThan(-1);
    expect(frictionIndex).toBeGreaterThan(-1);
    expect(recommendationIndex).toBeLessThan(frictionIndex);
  });

  it("keeps the entry restrained: no large card class, no green/red dominance, no pulse", () => {
    const adjustSource = readSrc("pages/Adjust.jsx");
    const adjustCss = readSrc("features/adjust/adjust.css");
    const entryCss = adjustCss.slice(
      adjustCss.indexOf(".systemAnalysisEntryButton"),
      adjustCss.indexOf(".adjustCommandPage")
    );

    expect(adjustSource).not.toContain("SystemAnalysisCard");
    expect(adjustSource).not.toContain("systemAnalysisCard");
    expect(entryCss).not.toContain("command-execution");
    expect(entryCss).not.toContain("command-critical");
    expect(entryCss).not.toContain("animation:");
    expect(entryCss).not.toContain("pulse");
  });
});
