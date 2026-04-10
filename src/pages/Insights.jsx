import React, { useCallback, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { resolveManualAiDisplayState } from "../features/manualAi/displayState";
import {
  buildPilotageManualAiContextKey,
  createPersistedLocalAnalysisEntry,
} from "../features/manualAi/manualAiAnalysis";
import { buildPilotageDisciplineTrend } from "../features/pilotage/disciplineTrendModel";
import { useManualAiAnalysis } from "../hooks/useManualAiAnalysis";
import { requestAiLocalAnalysis } from "../infra/aiLocalAnalysisClient";
import { computeWindowStats } from "../logic/progressionModel";
import { AppScreen } from "../shared/ui/app";
import { INSIGHTS_SCREEN_COPY, UI_COPY } from "../ui/labels";

const DIRECTION_LABELS = Object.freeze({
  maintenir: "Maintenir",
  recalibrer: "Recalibrer",
  "accélérer": "Accélérer",
  "alléger": "Alléger",
});

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

function formatDateLabel(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function weekdayLabel(dateKey) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function normalizeTrendKey(label) {
  if (label === "hausse") return "hausse";
  if (label === "baisse") return "baisse";
  if (label === "irrégularité") return "irregularite";
  return "stable";
}

function trendLabel(label) {
  const normalized = normalizeTrendKey(label);
  if (normalized === "hausse") return INSIGHTS_SCREEN_COPY.trendLabels.hausse;
  if (normalized === "baisse") return INSIGHTS_SCREEN_COPY.trendLabels.baisse;
  if (normalized === "irregularite") return INSIGHTS_SCREEN_COPY.trendLabels.irregularite;
  return INSIGHTS_SCREEN_COPY.trendLabels.stable;
}

function resolveDirection({ trendLabel: currentTrendLabel, completionPct, activeDays7, expectedCount }) {
  const normalized = normalizeTrendKey(currentTrendLabel);
  if (!expectedCount || activeDays7 <= 1) {
    return {
      key: "alléger",
      label: DIRECTION_LABELS["alléger"],
      description: "Réduis la charge et protège seulement un prochain pas crédible avant d'ajouter de nouvelles ambitions.",
    };
  }
  if (normalized === "baisse" || normalized === "irregularite" || completionPct < 35) {
    return {
      key: "recalibrer",
      label: DIRECTION_LABELS.recalibrer,
      description: "Reviens à une cadence plus tenable, enlève la friction et protège un bloc simple mais fiable.",
    };
  }
  if (normalized === "hausse" && completionPct >= 75) {
    return {
      key: "accélérer",
      label: DIRECTION_LABELS["accélérer"],
      description: "Le rythme tient. Tu peux augmenter légèrement l'ambition sur le prochain levier à fort impact.",
    };
  }
  return {
    key: "maintenir",
    label: DIRECTION_LABELS.maintenir,
    description: "Garde la structure actuelle et sécurise le prochain bloc utile sans surcharger la semaine.",
  };
}

function applyCoachAction(action, setTab, fallbackDateKey, onOpenSession) {
  if (!action?.intent) return;
  if (action.intent === "open_library") {
    setTab?.("objectives");
    return;
  }
  if (action.intent === "open_pilotage") {
    setTab?.("insights");
    return;
  }
  if (action.intent === "open_today") {
    setTab?.("today");
    return;
  }
  if (action.intent === "open_support") {
    setTab?.("support");
    return;
  }
  if (action.intent === "resume_session") {
    if (typeof onOpenSession === "function") {
      onOpenSession({
        categoryId: action.categoryId || null,
        dateKey: action.dateKey || fallbackDateKey,
        occurrenceId: action.occurrenceId || null,
      });
    } else {
      setTab?.("session", {
        sessionCategoryId: action.categoryId || null,
        sessionDateKey: action.dateKey || fallbackDateKey,
        sessionOccurrenceId: action.occurrenceId || null,
      });
    }
    return;
  }
  if (action.intent === "start_occurrence") {
    if (typeof onOpenSession === "function") {
      onOpenSession({
        categoryId: action.categoryId || null,
        dateKey: action.dateKey || fallbackDateKey,
        occurrenceId: action.occurrenceId || null,
      });
    } else {
      setTab?.("session", {
        sessionCategoryId: action.categoryId || null,
        sessionDateKey: action.dateKey || fallbackDateKey,
        sessionOccurrenceId: action.occurrenceId || null,
      });
    }
  }
}

function MetricIcon({ path, color }) {
  return (
    <svg className="lovableMetricIcon" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" aria-hidden="true">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InsightsLineChart({ series = [], selectedIndex = 0, onSelect }) {
  const points = useMemo(() => {
    const safeSeries = Array.isArray(series) ? series : [];
    const width = 320;
    const height = 160;
    const left = 10;
    const right = 10;
    const top = 14;
    const bottom = 22;
    const step = safeSeries.length > 1 ? (width - left - right) / (safeSeries.length - 1) : 0;
    return safeSeries.map((item, index) => {
      const score = Number.isFinite(item?.score) ? item.score : 50;
      const normalized = Math.max(0, Math.min(1, score / 100));
      return {
        index,
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
      <svg className="lovableChartFrame" viewBox="0 0 320 160" aria-label={INSIGHTS_SCREEN_COPY.focusScore}>
        <line className="lovableChartGuide" x1="10" y1="138" x2="310" y2="138" />
        <line className="lovableChartGuide" x1="10" y1="80" x2="310" y2="80" />
        {pathData ? <path className="lovableChartPath" d={pathData} /> : null}
        {points.map((point) => (
          <g key={`${point.x}-${point.y}`}>
            <circle
              className={`lovableChartPoint${selectedIndex === point.index ? " is-selected" : ""}`}
              cx={point.x}
              cy={point.y}
              r="4"
            />
            <circle
              className="lovableChartPointHit"
              cx={point.x}
              cy={point.y}
              r="14"
              role="button"
              tabIndex="0"
              aria-label={`${INSIGHTS_SCREEN_COPY.graphPointTitle} ${point.label}`}
              onClick={() => onSelect?.(point.index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(point.index);
                }
              }}
            />
          </g>
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
  if (!scored.length) return "Le signal d'exécution est encore trop faible pour détecter un pattern fiable.";
  const lowest = [...scored].sort((left, right) => left.score - right.score)[0];
  const highest = [...scored].sort((left, right) => right.score - left.score)[0];
  return `Ta concentration baisse surtout le ${weekdayLabel(lowest.dateKey)}. Protège du travail plus léger ce jour-là. Ton meilleur jour actuel est le ${weekdayLabel(highest.dateKey)}.`;
}

function buildNarrative({ activeDays7, completionPct, doneCount, expectedCount, momentum }) {
  return `Tu as maintenu une série de ${activeDays7} jour${activeDays7 > 1 ? "s" : ""}, complété ${completionPct}% des actions prévues (${doneCount}/${expectedCount || 0}) et la semaine se lit ${momentum.toLowerCase()}. Protège maintenant le prochain bloc à fort levier.`;
}

function buildCoachReadingCopy(analysis, fallbackCopy) {
  if (!analysis) return fallbackCopy;
  const summary = String(analysis.summary || analysis.headline || "").trim();
  const reason = String(analysis.reason || "").trim();
  return [summary, reason].filter(Boolean).join(". ");
}

function buildDirectionCopy(direction, narrativeCopy, analysis) {
  const reason = String(analysis?.reason || direction.description || "").trim();
  return [`${direction.label}.`, reason, narrativeCopy].filter(Boolean).join(" ");
}

function normalizeDirectionKey(value) {
  const key = String(value || "").trim();
  if (key === "maintenir" || key === "recalibrer" || key === "accélérer" || key === "alléger") return key;
  return "";
}

export default function Insights({
  data,
  setData,
  setTab,
  onOpenSession,
  persistenceScope = "local_fallback",
}) {
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
  const localDirection = useMemo(
    () =>
      resolveDirection({
        trendLabel: trend?.summary?.trendLabel,
        completionPct,
        activeDays7,
        expectedCount,
      }),
    [activeDays7, completionPct, expectedCount, trend?.summary?.trendLabel]
  );

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
  const coachAnalysis = useManualAiAnalysis({
    data: safeData,
    setData,
    contextKey: analysisContextKey,
    surface: "pilotage",
  });
  const [selectedPointIndex, setSelectedPointIndex] = useState(() => {
    const seriesLength = Array.isArray(trend?.series) ? trend.series.length : 0;
    return seriesLength > 0 ? seriesLength - 1 : 0;
  });
  const analysisState = useMemo(
    () =>
      resolveManualAiDisplayState({
        loading: coachAnalysis.loading,
        visibleAnalysis: coachAnalysis.visibleAnalysis,
        wasRefreshed: coachAnalysis.wasRefreshed,
      }),
    [coachAnalysis.loading, coachAnalysis.visibleAnalysis, coachAnalysis.wasRefreshed]
  );

  const narrativeCopy = useMemo(
    () =>
      buildNarrative({
        activeDays7,
        completionPct,
        doneCount,
        expectedCount,
        momentum,
      }),
    [activeDays7, completionPct, doneCount, expectedCount, momentum]
  );
  const patternCopy = useMemo(() => buildPatternCopy(trend?.series), [trend?.series]);
  const persistedDirectionKey = normalizeDirectionKey(coachAnalysis.visibleAnalysis?.direction);
  const visibleDirection =
    persistedDirectionKey && DIRECTION_LABELS[persistedDirectionKey]
      ? {
          key: persistedDirectionKey,
          label: DIRECTION_LABELS[persistedDirectionKey],
          description: coachAnalysis.visibleAnalysis?.reason || localDirection.description,
        }
      : localDirection;
  const coachReadingCopy = buildCoachReadingCopy(coachAnalysis.visibleAnalysis, patternCopy);
  const directionCopy = buildDirectionCopy(visibleDirection, narrativeCopy, coachAnalysis.visibleAnalysis);
  const selectedPoint =
    Array.isArray(trend?.series) && trend.series.length
      ? trend.series[Math.max(0, Math.min(selectedPointIndex, trend.series.length - 1))]
      : null;
  const selectedPointScore = Number.isFinite(selectedPoint?.score) ? `${selectedPoint.score}%` : "0%";

  const handleAnalyze = useCallback(async () => {
    await coachAnalysis.runAnalysis({
      execute: () =>
        requestAiLocalAnalysis({
          accessToken: session?.access_token || "",
          payload: {
            selectedDateKey: toKey,
            activeCategoryId: null,
            surface: "pilotage",
            message:
              "Analyse mes statistiques globales. Résume la tendance en français simple, choisis strictement une direction parmi maintenir, recalibrer, accélérer ou alléger, puis propose une action prioritaire concrète.",
          },
        }),
      serializeSuccess: (result) =>
        createPersistedLocalAnalysisEntry({
          contextKey: analysisContextKey,
          surface: "pilotage",
          storageScope: persistenceScope,
          reply: result?.reply,
          summary: result?.reply?.headline || "",
          trend: momentum,
          direction: normalizeDirectionKey(result?.reply?.direction) || localDirection.key,
        }),
    });
  }, [analysisContextKey, coachAnalysis, localDirection.key, momentum, persistenceScope, session?.access_token, toKey]);

  return (
    <AppScreen pageId="insights" headerTitle={INSIGHTS_SCREEN_COPY.title} headerSubtitle={INSIGHTS_SCREEN_COPY.subtitle}>
      <div className="lovablePage lovableInsightsStack">
        <div className="lovableInsightsMetrics">
          <div className="lovableCard lovableMetricCard">
            <MetricIcon path="M12 4c2 2 4 4.5 4 7.2A4 4 0 1 1 8 13c0-1.8 1-3.5 4-9Z" color="#f4b74a" />
            <div className="lovableMetricValue">{activeDays7}</div>
            <div className="lovableMetricLabel">{INSIGHTS_SCREEN_COPY.streak}</div>
          </div>
          <div className="lovableCard lovableMetricCard">
            <MetricIcon path="M12 3a9 9 0 1 0 9 9M12 8v4l2 2" color="#8b78ff" />
            <div className="lovableMetricValue">{completionPct}%</div>
            <div className="lovableMetricLabel">{INSIGHTS_SCREEN_COPY.completion}</div>
          </div>
          <div className="lovableCard lovableMetricCard">
            <MetricIcon path="M4 14l5-5 4 4 7-7" color="#62d589" />
            <div className="lovableMetricValue">{momentum}</div>
            <div className="lovableMetricLabel">{INSIGHTS_SCREEN_COPY.momentum}</div>
          </div>
        </div>

        <div className="lovableCard lovableChartCard">
          <div className="lovableSectionLabel">{INSIGHTS_SCREEN_COPY.focusScore}</div>
          <InsightsLineChart
            series={trend?.series || []}
            selectedIndex={selectedPointIndex}
            onSelect={setSelectedPointIndex}
          />
          <p className="lovableMuted">{INSIGHTS_SCREEN_COPY.graphLegend}</p>
          {selectedPoint ? (
            <div className="lovableChartPointCard">
              <div className="lovableInsightCardEyebrow">{INSIGHTS_SCREEN_COPY.graphPointTitle}</div>
              <div className="lovableChartPointGrid">
                <div className="lovableChartPointMeta">
                  <span>{INSIGHTS_SCREEN_COPY.graphDateLabel}</span>
                  <strong>{formatDateLabel(selectedPoint.dateKey)}</strong>
                </div>
                <div className="lovableChartPointMeta">
                  <span>{INSIGHTS_SCREEN_COPY.graphScoreLabel}</span>
                  <strong>{selectedPointScore}</strong>
                </div>
                <div className="lovableChartPointMeta">
                  <span>{INSIGHTS_SCREEN_COPY.graphCompletedLabel}</span>
                  <strong>{selectedPoint?.done || 0}</strong>
                </div>
                <div className="lovableChartPointMeta">
                  <span>{INSIGHTS_SCREEN_COPY.graphPlannedLabel}</span>
                  <strong>{selectedPoint?.expected || 0}</strong>
                </div>
              </div>
              <p className="lovableMuted">{selectedPoint?.explanation || INSIGHTS_SCREEN_COPY.graphNoPlanExplanation}</p>
            </div>
          ) : null}
        </div>

        <div className="lovableCard lovableInsightTextCard">
          <div className="lovableInsightCardEyebrow">{INSIGHTS_SCREEN_COPY.coachReading}</div>
          <p className="lovableInsightCopy">{coachReadingCopy || INSIGHTS_SCREEN_COPY.fallbackCoachReading}</p>
          <div className="lovableInsightDirection">
            <span className="lovableInsightDirectionLabel">{INSIGHTS_SCREEN_COPY.directionTitle}</span>
            <p className="lovableInsightCopy">{directionCopy}</p>
          </div>
          <p className="lovableMuted">{analysisState.label}</p>
          <div className="lovableCoachActions">
            <button
              type="button"
              className="lovableCoachBubbleAction"
              onClick={handleAnalyze}
              disabled={coachAnalysis.loading}
            >
              {coachAnalysis.loading
                ? coachAnalysis.loadingStageLabel || INSIGHTS_SCREEN_COPY.loadingFallback
                : coachAnalysis.visibleAnalysis
                  ? INSIGHTS_SCREEN_COPY.coachAnalysisRetry
                  : INSIGHTS_SCREEN_COPY.coachAnalysisCta}
            </button>
            {coachAnalysis.visibleAnalysis ? (
              <button
                type="button"
                className="lovableGhostButton"
                onClick={coachAnalysis.dismissAnalysis}
              >
                {UI_COPY.backToLocalDiagnostic}
              </button>
            ) : null}
          </div>
          {coachAnalysis.error ? <p className="lovableInsightCopy">{coachAnalysis.error}</p> : null}
          {coachAnalysis.visibleAnalysis?.primaryAction || coachAnalysis.visibleAnalysis?.secondaryAction ? (
            <div className="lovableCoachActions">
              {coachAnalysis.visibleAnalysis?.primaryAction ? (
                <button
                  type="button"
                  className="lovableCoachBubbleAction"
                  onClick={() => applyCoachAction(coachAnalysis.visibleAnalysis.primaryAction, setTab, toKey, onOpenSession)}
                >
                  {coachAnalysis.visibleAnalysis.primaryAction.label}
                </button>
              ) : null}
              {coachAnalysis.visibleAnalysis?.secondaryAction ? (
                <button
                  type="button"
                  className="lovableGhostButton"
                  onClick={() => applyCoachAction(coachAnalysis.visibleAnalysis.secondaryAction, setTab, toKey, onOpenSession)}
                >
                  {coachAnalysis.visibleAnalysis.secondaryAction.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </AppScreen>
  );
}
