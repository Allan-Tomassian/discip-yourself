import { describe, expect, it } from "vitest";
import { buildDisciplineTrendChartGeometry } from "./disciplineTrendChartModel";

describe("buildDisciplineTrendChartGeometry", () => {
  it("returns an empty chart model when every day is neutral", () => {
    const result = buildDisciplineTrendChartGeometry([
      { dateKey: "2026-03-01", score: null, isNeutral: true },
      { dateKey: "2026-03-02", score: null, isNeutral: true },
    ]);

    expect(result.isEmpty).toBe(true);
    expect(result.hasDrawableLine).toBe(false);
    expect(result.linePathD).toBe("");
    expect(result.areaPathD).toBe("");
  });

  it("flags the mono-point state when only one scored day exists", () => {
    const result = buildDisciplineTrendChartGeometry([
      { dateKey: "2026-03-01", score: null, isNeutral: true },
      { dateKey: "2026-03-02", score: 80, isNeutral: false },
      { dateKey: "2026-03-03", score: null, isNeutral: true },
    ]);

    expect(result.hasSingleScoredPoint).toBe(true);
    expect(result.hasDrawableLine).toBe(false);
    expect(result.linePathD).toBe("");
    expect(result.lastScoredPoint).toMatchObject({ dateKey: "2026-03-02", score: 80 });
  });

  it("builds a drawable line and area when at least two scored days exist", () => {
    const result = buildDisciplineTrendChartGeometry([
      { dateKey: "2026-03-01", score: 20, isNeutral: false },
      { dateKey: "2026-03-02", score: null, isNeutral: true },
      { dateKey: "2026-03-03", score: 65, isNeutral: false },
      { dateKey: "2026-03-04", score: 100, isNeutral: false },
    ]);

    expect(result.hasDrawableLine).toBe(true);
    expect(result.linePathD.startsWith("M")).toBe(true);
    expect(result.areaPathD.endsWith("Z")).toBe(true);
    expect(result.neutralPoints).toHaveLength(1);
  });

  it("never emits NaN coordinates or invalid paths", () => {
    const result = buildDisciplineTrendChartGeometry([
      { dateKey: "2026-03-01", score: 0, isNeutral: false },
      { dateKey: "2026-03-02", score: 100, isNeutral: false },
      { dateKey: "2026-03-03", score: null, isNeutral: true },
    ]);

    for (const point of result.points) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
    expect(result.linePathD.includes("NaN")).toBe(false);
    expect(result.areaPathD.includes("NaN")).toBe(false);
  });
});
