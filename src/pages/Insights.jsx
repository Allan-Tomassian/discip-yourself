import React, { useMemo } from "react";
import { useAuth } from "../auth/useAuth";
import { buildPilotageManualAiContextKey, getManualAiAnalysisEntry } from "../features/manualAi/manualAiAnalysis";
import { buildPilotageDisciplineTrend } from "../features/pilotage/disciplineTrendModel";
import { computeWindowStats } from "../logic/progressionModel";
import { AppScreen } from "../shared/ui/app";

function toDateKey(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "";
  return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, "0")}-${String(safeDate.getDate()).padStart(2, "0")}`;
}

function addDays(date, delta) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function weekdayLabel(dateKey) {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function trendLabel(label) {
  if (label === "hausse") return "Rising";
  if (label === "baisse") return "Slowing";
  if (label === "irrégularité") return "Mixed";
  return "Stable";
}

function MetricIcon({ path, color }) {
  return (
    <svg className="lovableMetricIcon" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsightsLineChart({ series = [] }) {
  const points = useMemo(() => {
    const safeSeries = Array.isArray(series) ? series : [];
    const width = 320;
    const height = 160;
    const left = 10;
    const right = 10;
    const top = 14;
    const bottom = 22;
    const step = safeSeries.length > 1 ? (width - left - right) / (safeSeries.length - 1) : 0;
    const values = safeSeries.map((item) => (Number.isFinite(item?.score) ? item.score : 50));
    return safeSeries.map((item, index) => {
      const score = Number.isFinite(item?.score) ? item.score : 50;
      const normalized = Math.max(0, Math.min(1, score / 100));
      return {
        x: left + step * index,
        y: top + (1 - normalized) * (height - top - bottom),
        label: weekdayLabel(item?.dateKey || ""),
      };
    });
  }, [series]);

  const pathData = useMemo(() => {
    if (!points.length) return "";
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }, [points]);

  return (
    <>
      <svg className="lovableChartFrame" viewBox="0 0 320 160" aria-label="Focus score trend">
        <line className="lovableChartGuide" x1="10" y1="138" x2="310" y2="138" />
        <line className="lovableChartGuide" x1="10" y1="80" x2="310" y2="80" />
        {pathData ? <path className="lovableChartPath" d={pathData} /> : null}
        {points.map((point) => (
          <circle key={`${point.x}-${point.y}`} className="lovableChartPoint" cx={point.x} cy={point.y} r="4" />
        ))}
      </svg>
      <div className="lovableChartAxisLabelRow" style={{ "--day-count": String(points.length || 7) }}>
        {points.map((point) => (
          <div key={point.label} className="lovableChartAxisLabel">
            {point.label}
          </div>
        ))}
      </div>
    </>
  );
}

function buildPatternCopy(series) {
  const scored = (Array.isArray(series) ? series : []).filter((entry) => Number.isFinite(entry?.score));
  if (!scored.length) return "There is not enough execution signal yet to detect a reliable pattern.";
  const lowest = [...scored].sort((left, right) => left.score - right.score)[0];
  const highest = [...scored].sort((left, right) => right.score - left.score)[0];
  return `Your focus drops most on ${weekdayLabel(lowest.dateKey)}. Protect lighter work there. Best performance is currently ${weekdayLabel(highest.dateKey)}.`;
}

function buildNarrative({ activeDays7, completionPct, doneCount, expectedCount, momentum }) {
  return `You maintained a ${activeDays7}-day streak, completed ${completionPct}% of planned actions (${doneCount}/${expectedCount || 0}), and the week is reading ${momentum.toLowerCase()}. Keep momentum on the next high-leverage block.`;
}

export default function Insights({ data }) {
  const { session } = useAuth();
  const safeData = data && typeof data === "object" ? data : {};
  const now = useMemo(() => new Date(), []);
  const toKey = useMemo(() => toDateKey(now), [now]);
  const fromKey = useMemo(() => toDateKey(addDays(now, -6)), [now]);
  const windowStats = useMemo(
    () =>
      computeWindowStats(safeData, fromKey, toKey, {
        includeMicroContribution: false,
      }),
    [fromKey, safeData, toKey]
  );
  const trend = useMemo(
    () =>
      buildPilotageDisciplineTrend(safeData, {
        windowDays: 7,
        now,
      }),
    [now, safeData]
  );
  const doneOccurrences = useMemo(
    () =>
      (Array.isArray(safeData.occurrences) ? safeData.occurrences : []).filter((occurrence) => {
        if (!occurrence || occurrence.status !== "done") return false;
        const dateKey = String(occurrence.date || "");
        return dateKey >= fromKey && dateKey <= toKey;
      }),
    [fromKey, safeData.occurrences, toKey]
  );
  const activeDays7 = useMemo(() => new Set(doneOccurrences.map((occurrence) => occurrence.date)).size, [doneOccurrences]);
  const doneCount = Number(windowStats?.occurrences?.done) || 0;
  const expectedCount = Number(windowStats?.occurrences?.expected) || 0;
  const completionPct = expectedCount ? Math.round((doneCount / expectedCount) * 100) : 0;
  const momentum = trendLabel(trend?.summary?.trendLabel);
  const analysisContextKey = useMemo(
    () =>
      buildPilotageManualAiContextKey({
        userId: session?.user?.id || "",
        fromKey,
        toKey,
        activeCategoryId: null,
      }),
    [fromKey, session?.user?.id, toKey]
  );
  const persistedAnalysis = useMemo(
    () => getManualAiAnalysisEntry(safeData?.ui?.manualAiAnalysisV1, analysisContextKey),
    [analysisContextKey, safeData?.ui?.manualAiAnalysisV1]
  );
  const patternCopy = persistedAnalysis?.reason || buildPatternCopy(trend?.series);
  const narrativeCopy = buildNarrative({
    activeDays7,
    completionPct,
    doneCount,
    expectedCount,
    momentum,
  });

  return (
    <AppScreen pageId="insights" headerTitle="Insights" headerSubtitle="Your trajectory this week">
      <div className="lovablePage lovableInsightsStack">
        <div className="lovableInsightsMetrics">
          <div className="lovableCard lovableMetricCard">
            <MetricIcon path="M12 4c2 2 4 4.5 4 7.2A4 4 0 1 1 8 13c0-1.8 1-3.5 4-9Z" color="#f4b74a" />
            <div className="lovableMetricValue">{activeDays7}</div>
            <div className="lovableMetricLabel">Streak</div>
          </div>
          <div className="lovableCard lovableMetricCard">
            <MetricIcon path="M12 3a9 9 0 1 0 9 9M12 8v4l2 2" color="#8b78ff" />
            <div className="lovableMetricValue">{completionPct}%</div>
            <div className="lovableMetricLabel">Completion</div>
          </div>
          <div className="lovableCard lovableMetricCard">
            <MetricIcon path="M4 14l5-5 4 4 7-7" color="#62d589" />
            <div className="lovableMetricValue">{momentum}</div>
            <div className="lovableMetricLabel">Momentum</div>
          </div>
        </div>

        <div className="lovableCard lovableChartCard">
          <div className="lovableSectionLabel">Focus Score</div>
          <InsightsLineChart series={trend?.series || []} />
        </div>

        <div className="lovableCard lovableInsightTextCard">
          <div className="lovableInsightCardEyebrow">Pattern Detected</div>
          <p className="lovableInsightCopy">{patternCopy}</p>
        </div>

        <div className="lovableCard lovableInsightTextCard">
          <div className="lovableInsightCardEyebrow">Weekly Narrative</div>
          <p className="lovableInsightCopy">
            {persistedAnalysis?.headline ? `${persistedAnalysis.headline}. ` : ""}
            {narrativeCopy}
          </p>
        </div>
      </div>
    </AppScreen>
  );
}
