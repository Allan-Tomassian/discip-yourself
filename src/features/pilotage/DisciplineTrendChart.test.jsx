import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DisciplineTrendChart from "./DisciplineTrendChart";

describe("DisciplineTrendChart", () => {
  it("renders an explicit empty state when the window is fully neutral", () => {
    const html = renderToStaticMarkup(
      <DisciplineTrendChart
        trend={{
          series: [
            { dateKey: "2026-03-01", score: null, isNeutral: true },
            { dateKey: "2026-03-02", score: null, isNeutral: true },
          ],
          summary: { trendLabel: "stable", scoredDays: 0, neutralDays: 2, currentScore: null },
        }}
      />
    );

    expect(html).toContain("Aucune action prévue sur cette période.");
    expect(html).toContain("pilotageTrendBaseline");
    expect(html).not.toContain("pilotageTrendLine");
  });

  it("renders a mono-point explanation when there is only one scored day", () => {
    const html = renderToStaticMarkup(
      <DisciplineTrendChart
        trend={{
          series: [
            { dateKey: "2026-03-01", score: null, isNeutral: true },
            { dateKey: "2026-03-02", score: 80, isNeutral: false },
          ],
          summary: { trendLabel: "stable", scoredDays: 1, neutralDays: 1, currentScore: 80 },
        }}
      />
    );

    expect(html).toContain("Une seule journée scorée sur cette fenêtre.");
    expect(html).toContain("1 seul jour scoré");
    expect(html).not.toContain("pilotageTrendLineGlow");
    expect(html).toContain("pilotageTrendTooltip");
  });

  it("renders a visible path when multiple scored points exist", () => {
    const html = renderToStaticMarkup(
      <DisciplineTrendChart
        trend={{
          series: [
            { dateKey: "2026-03-01", score: 30, isNeutral: false },
            { dateKey: "2026-03-02", score: null, isNeutral: true },
            { dateKey: "2026-03-03", score: 60, isNeutral: false },
            { dateKey: "2026-03-04", score: 90, isNeutral: false },
          ],
          summary: { trendLabel: "hausse", scoredDays: 3, neutralDays: 1, currentScore: 90 },
        }}
      />
    );

    expect(html).toContain("Évolution discipline");
    expect(html).toContain("pilotageTrendLine");
    expect(html).toContain("Niveau actuel 90%");
    expect(html).toContain("3 jours utiles");
    expect(html).toContain("pilotageTrendTooltip");
  });
});
