import React, { useCallback, useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { GateBadge, GateButton, GateSection } from "../shared/ui/gate/Gate";
import SelectControl from "../ui/select/Select";
import { useAuth } from "../auth/useAuth";
import { getCategoryProfileSummary } from "../domain/categoryProfile";
import { requestAiCoachChat } from "../infra/aiCoachChatClient";
import {
  buildPilotageManualAiContextKey,
  createPersistedChatAnalysisEntry,
} from "../features/manualAi/manualAiAnalysis";
import { resolveManualAiDisplayState } from "../features/manualAi/displayState";
import { useManualAiAnalysis } from "../hooks/useManualAiAnalysis";
import { getCategoryPilotageCounts, getCategoryStatus } from "../logic/pilotage";
import { getWindowBounds } from "../logic/metrics";
import { computeWindowStats } from "../logic/progressionModel";
import { buildReport, exportReportToCSV } from "../logic/reporting";
import AccentCategoryRow from "../components/AccentCategoryRow";
import { LABELS } from "../ui/labels";
import {
  CATEGORY_VIEW,
  getSelectedCategoryForView,
  getVisibleCategories,
  resolvePreferredVisibleCategoryId,
  withSelectedCategoryByView,
} from "../domain/categoryVisibility";
import { collectSystemInboxBuckets } from "../domain/systemInboxMigration";
import { buildPilotageDisciplineTrend, PILOTAGE_DISCIPLINE_WINDOWS } from "../features/pilotage/disciplineTrendModel";
import ManualAiStatus from "../components/ai/ManualAiStatus";
import "../features/pilotage/pilotage.css";

const STATUS_LABELS = {
  EMPTY: "Vide",
  DONE: "Terminée",
  ACTIVE: "Active",
};

const STATUS_STYLES = {
  ACTIVE: {
    backgroundColor: "rgba(76, 175, 80, 0.14)",
    borderColor: "rgba(76, 175, 80, 0.8)",
    color: "#EAF7ED",
  },
  DONE: {
    backgroundColor: "rgba(158, 158, 158, 0.14)",
    borderColor: "rgba(158, 158, 158, 0.7)",
    color: "#F0F0F0",
  },
  EMPTY: {
    backgroundColor: "rgba(255, 152, 0, 0.14)",
    borderColor: "rgba(255, 152, 0, 0.8)",
    color: "#FFF4E5",
  },
};

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

function formatMinutes(value) {
  if (!Number.isFinite(value)) return "0 min";
  return `${Math.max(0, Math.round(value))} min`;
}

function Button({ variant = "primary", className = "", ...props }) {
  const gateVariant = variant === "ghost" ? "ghost" : "primary";
  const mergedClassName = [className, "GatePressable"].filter(Boolean).join(" ");
  return <GateButton variant={gateVariant} className={mergedClassName} {...props} />;
}

function Card({ className = "", children, ...props }) {
  const mergedClassName = ["GateSurfacePremium", "GateCardPremium", className].filter(Boolean).join(" ");
  return (
    <GateSection className={mergedClassName} collapsible={false} {...props}>
      {children}
    </GateSection>
  );
}

function Input({ className = "", ...props }) {
  const mergedClassName = ["GateInputPremium", className].filter(Boolean).join(" ");
  return <input className={mergedClassName} {...props} />;
}

function Select({ className = "", children, ...props }) {
  const mergedClassName = ["GateSelectPremium", className].filter(Boolean).join(" ");
  return (
    <SelectControl className={mergedClassName} {...props}>
      {children}
    </SelectControl>
  );
}

function StatRow({ label, value, right = null }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div className="itemTitle" style={{ minWidth: 0 }}>
        {label}
      </div>
      <div className="row" style={{ alignItems: "center", gap: 10, minWidth: 0 }}>
        {right}
        <div className="itemSub" style={{ textAlign: "right" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function Meter({ value01 = 0, label = "", tone = "accent" }) {
  const v = clamp01(value01);
  const track = "rgba(255,255,255,0.10)";
  const fill =
    tone === "good"
      ? "rgba(76, 175, 80, 0.75)"
      : tone === "warn"
        ? "rgba(255, 152, 0, 0.80)"
        : tone === "bad"
          ? "rgba(244, 67, 54, 0.78)"
          : "rgba(124, 58, 237, 0.78)";
  return (
    <div className="col" style={{ gap: 8 }}>
      {label ? <div className="small2 textMuted">{label}</div> : null}
      <div
        aria-hidden="true"
        style={{
          width: "100%",
          height: 10,
          borderRadius: 999,
          background: track,
          overflow: "hidden",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            width: `${Math.round(v * 100)}%`,
            height: "100%",
            borderRadius: 999,
            background: fill,
          }}
        />
      </div>
    </div>
  );
}

function PilotageCategoryRow({
  color,
  selected,
  onClick,
  summary,
  statusLabel,
  statusStyle,
  children,
  ...props
}) {
  return (
    <AccentCategoryRow
      className="pilotageCategoryRow"
      color={color}
      selected={selected}
      onClick={onClick}
      rightSlot={
        <GateBadge className="pilotageStatusBadge" style={{ ...statusStyle, borderWidth: 1, borderStyle: "solid" }}>
          {statusLabel}
        </GateBadge>
      }
      {...props}
    >
      <div className="itemTitle">{children}</div>
      <div className="itemSub">{summary}</div>
    </AccentCategoryRow>
  );
}

function formatShortDateLabel(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function buildChartPoint({ score, seriesIndex, totalCount }, { width, height, padding }) {
  const x = padding + ((width - (padding * 2)) * seriesIndex) / Math.max(totalCount - 1, 1);
  const y = height - padding - (((score || 0) / 100) * (height - (padding * 2)));
  return { x, y };
}

function buildChartPath(points, { width, height, padding, totalCount }) {
  if (!points.length) return "";
  return points
    .map((point, index) => {
      const { x, y } = buildChartPoint(point, { width, height, padding, totalCount });
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(points, { width, height, padding, totalCount }) {
  if (!points.length) return "";
  const linePath = buildChartPath(points, { width, height, padding, totalCount });
  const firstX = buildChartPoint(points[0], { width, height, padding, totalCount }).x;
  const lastX = buildChartPoint(points[points.length - 1], { width, height, padding, totalCount }).x;
  const baseY = height - padding;
  return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
}

function DisciplineTrendChart({ trend, color = "#6EE7FF" }) {
  const width = 320;
  const height = 180;
  const padding = 18;
  const series = Array.isArray(trend?.series) ? trend.series : [];
  const scoredPoints = series
    .map((entry, seriesIndex) => ({ ...entry, seriesIndex }))
    .filter((entry) => Number.isFinite(entry?.score));
  const neutralPoints = series
    .map((entry, seriesIndex) => ({ ...entry, seriesIndex }))
    .filter((entry) => entry?.isNeutral);
  const linePath = buildChartPath(scoredPoints, { width, height, padding, totalCount: series.length });
  const areaPath = buildAreaPath(scoredPoints, { width, height, padding, totalCount: series.length });
  const firstLabel = trend?.series?.[0]?.dateKey ? formatShortDateLabel(trend.series[0].dateKey) : "";
  const lastLabel = trend?.series?.length ? formatShortDateLabel(trend.series[trend.series.length - 1].dateKey) : "";

  if (!scoredPoints.length) {
    return <div className="small2 textMuted">Aucune action prévue sur cette période.</div>;
  }

  return (
    <div className="pilotageTrendChart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Évolution discipline">
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="pilotageTrendAxis" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="pilotageTrendAxis" />
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} className="pilotageTrendGuide" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} className="pilotageTrendGuide" />
        {areaPath ? <path d={areaPath} fill={color} fillOpacity="0.14" /> : null}
        {linePath ? <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {scoredPoints.map((point) => {
          const { x, y } = buildChartPoint(point, { width, height, padding, totalCount: series.length });
          return <circle key={point.dateKey} cx={x} cy={y} r="3.5" fill={color} />;
        })}
        {neutralPoints.map((point) => {
          const { x } = buildChartPoint({ ...point, score: 0 }, { width, height, padding, totalCount: series.length });
          return <circle key={`neutral-${point.dateKey}`} cx={x} cy={height - padding} r="2.5" className="pilotageTrendNeutral" />;
        })}
        <text x={padding} y={padding - 4} className="pilotageTrendAxisLabel">100</text>
        <text x={padding} y={height - padding + 14} className="pilotageTrendAxisLabel">0</text>
      </svg>
      <div className="pilotageTrendAxisFooter">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

function buildConstanceSummary({ occurrences, sessionHistoryByOccurrenceId }) {
  const activeDays = new Set();
  let realMinutes = 0;
  let doneCount = 0;
  let expectedCount = 0;
  let missedCount = 0;

  for (const occurrence of Array.isArray(occurrences) ? occurrences : []) {
    const status = typeof occurrence?.status === "string" ? occurrence.status : "";
    if (status !== "canceled" && status !== "skipped") expectedCount += 1;
    if (status === "missed") missedCount += 1;
    if (status !== "done") continue;
    doneCount += 1;
    if (typeof occurrence?.date === "string" && occurrence.date) activeDays.add(occurrence.date);
    const sessionEntry = sessionHistoryByOccurrenceId.get(occurrence.id) || null;
    if (Number.isFinite(sessionEntry?.timerSeconds)) {
      realMinutes += Math.round(sessionEntry.timerSeconds / 60);
    } else if (Number.isFinite(occurrence?.durationMinutes)) {
      realMinutes += occurrence.durationMinutes;
    }
  }

  const regularity = activeDays.size / 7;
  const constanceLabel =
    activeDays.size >= 4 && realMinutes >= 60
      ? "stable"
      : activeDays.size >= 2 || doneCount > missedCount
        ? "en progression"
        : "irrégulier";

  return {
    activeDays7: activeDays.size,
    realMinutes7: realMinutes,
    regularity,
    constanceLabel,
    expectedCount,
    doneCount,
    missedCount,
  };
}

function buildPilotageCoachFallback({
  selectedCategory,
  selectedCategoryProfileSummary,
  selectedCounts,
  selectedWeek,
  constanceSummary,
  disciplineTrend,
}) {
  const priorityTarget =
    selectedCategoryProfileSummary?.currentPriority ||
    selectedCategoryProfileSummary?.mainGoal ||
    null;

  if (!selectedCategory) {
    return {
      summary: "Choisis une catégorie pour lire le système plus clairement.",
      problem: "Aucun focus actif, donc aucun diagnostic utile.",
      recommendation: "Sélectionne une catégorie puis analyse-la.",
    };
  }

  if (!selectedCounts?.processCount) {
    return {
      summary: `${selectedCategory.name || "Cette catégorie"} reste vide.`,
      problem: "Aucune action exécutable n’alimente encore cette catégorie.",
      recommendation: priorityTarget
        ? `Ajoute 1 action simple et planifiable liée à ${priorityTarget}.`
        : "Ajoute 1 action simple et planifiable cette semaine.",
    };
  }

  if ((selectedWeek?.expected || 0) === 0) {
    return {
      summary: `Aucun rythme visible en ${selectedCategory.name || "catégorie"}.`,
      problem: "La semaine n’a aucun créneau crédible pour cette catégorie.",
      recommendation: priorityTarget
        ? `Planifie 1 bloc court récurrent pour ${priorityTarget}.`
        : "Planifie 1 bloc court récurrent pour relancer la continuité.",
    };
  }

  if (disciplineTrend?.summary?.currentScore == null) {
    return {
      summary: `Aucune discipline mesurable en ${selectedCategory.name || "catégorie"}.`,
      problem: "La période récente ne contient aucun bloc attendu pour produire une tendance.",
      recommendation: "Planifie 1 action courte et répétable pour créer un premier signal.",
    };
  }

  if (disciplineTrend?.summary?.trendLabel === "baisse") {
    return {
      summary: `La discipline baisse en ${selectedCategory.name || "catégorie"}.`,
      problem: `Le score recent est de ${disciplineTrend.summary.currentScore}% et recule sur les derniers jours scorés.`,
      recommendation: "Réduis le prochain bloc ou replannifie une action plus facile aujourd’hui.",
    };
  }

  if (disciplineTrend?.summary?.trendLabel === "irrégularité") {
    return {
      summary: `La discipline reste irrégulière en ${selectedCategory.name || "catégorie"}.`,
      problem: "Le score varie fortement d’un jour à l’autre malgré un volume attendu.",
      recommendation: "Protège un seul bloc simple et répète-le sur plusieurs jours.",
    };
  }

  if (disciplineTrend?.summary?.trendLabel === "hausse") {
    return {
      summary: `${selectedCategory.name || "Cette catégorie"} reprend de l’élan.`,
      problem: `Le score récent monte à ${disciplineTrend.summary.currentScore}% sur la fenêtre active.`,
      recommendation: "Consolide le prochain bloc utile avant d’ajouter de la charge.",
    };
  }

  if ((constanceSummary?.missedCount || 0) > (constanceSummary?.doneCount || 0)) {
    return {
      summary: `La continuité reste fragile en ${selectedCategory.name || "catégorie"}.`,
      problem: "Il y a plus de sessions manquées que de sessions terminées sur la fenêtre récente.",
      recommendation: "Réduis la charge ou raccourcis le prochain bloc prévu.",
    };
  }

  return {
    summary: `${selectedCategory.name || "Cette catégorie"} progresse mais peut être consolidée.`,
    problem: `La constance est ${constanceSummary?.constanceLabel || "irrégulière"} sur 7 jours.`,
    recommendation: "Protège le prochain bloc important et garde une cadence simple.",
  };
}

export default function Pilotage({
  data,
  setData,
  persistenceScope = "local_fallback",
  generationWindowDays = null,
  isPlanningUnlimited = false,
}) {
  void generationWindowDays;
  void isPlanningUnlimited;
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const userId = session?.user?.id || "";
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const occurrences = useMemo(() => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []), [safeData.occurrences]);
  const legacyBuckets = useMemo(
    () => collectSystemInboxBuckets({ goals: safeData.goals, categories: safeData.categories }),
    [safeData.categories, safeData.goals]
  );

  const now = useMemo(() => new Date(), []);
  const weekBounds = useMemo(() => getWindowBounds("7d", now), [now]);
  const selectedDateKey =
    (typeof safeData?.ui?.selectedDateKey === "string" && safeData.ui.selectedDateKey) ||
    (typeof safeData?.ui?.selectedDate === "string" && safeData.ui.selectedDate) ||
    weekBounds.toKey;

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const category of categories) {
      map.set(category.id, getCategoryPilotageCounts(safeData, category.id));
    }
    return map;
  }, [categories, safeData]);

  const statusByCategory = useMemo(() => {
    const map = new Map();
    for (const category of categories) {
      map.set(category.id, getCategoryStatus(safeData, category.id, now));
    }
    return map;
  }, [categories, now, safeData]);

  const selectedCategoryId = resolvePreferredVisibleCategoryId({
    categories,
    candidates: [
      getSelectedCategoryForView(safeData, CATEGORY_VIEW.PILOTAGE),
      getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY),
    ],
  });

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const selectedCounts = useMemo(
    () => (selectedCategoryId ? countsByCategory.get(selectedCategoryId) || null : null),
    [countsByCategory, selectedCategoryId]
  );
  const selectedStatus = useMemo(
    () => (selectedCategoryId ? statusByCategory.get(selectedCategoryId) || null : null),
    [selectedCategoryId, statusByCategory]
  );
  const selectedWeek = useMemo(() => {
    if (!selectedCategoryId) return null;
    return computeWindowStats(safeData, weekBounds.fromKey, weekBounds.toKey, {
      filters: { categoryId: selectedCategoryId },
      includeMicroContribution: false,
    }).occurrences;
  }, [safeData, selectedCategoryId, weekBounds.fromKey, weekBounds.toKey]);

  const sessionHistoryByOccurrenceId = useMemo(() => {
    const map = new Map();
    for (const entry of Array.isArray(safeData.sessionHistory) ? safeData.sessionHistory : []) {
      if (!entry?.occurrenceId) continue;
      const previous = map.get(entry.occurrenceId) || null;
      const nextTs = Date.parse(entry?.endAt || entry?.startAt || "") || 0;
      const previousTs = Date.parse(previous?.endAt || previous?.startAt || "") || 0;
      if (!previous || nextTs >= previousTs) {
        map.set(entry.occurrenceId, entry);
      }
    }
    return map;
  }, [safeData.sessionHistory]);

  const selectedWeekOccurrences = useMemo(() => {
    if (!selectedCategoryId) return [];
    const goalsById = new Map(goals.filter((goal) => goal?.id).map((goal) => [goal.id, goal]));
    return occurrences.filter((occurrence) => {
      const dateKey = typeof occurrence?.date === "string" ? occurrence.date : "";
      if (!dateKey || dateKey < weekBounds.fromKey || dateKey > weekBounds.toKey) return false;
      const goal = goalsById.get(occurrence?.goalId || "") || null;
      return goal?.categoryId === selectedCategoryId;
    });
  }, [goals, occurrences, selectedCategoryId, weekBounds.fromKey, weekBounds.toKey]);

  const constanceSummary = useMemo(
    () => buildConstanceSummary({ occurrences: selectedWeekOccurrences, sessionHistoryByOccurrenceId }),
    [selectedWeekOccurrences, sessionHistoryByOccurrenceId]
  );
  const selectedCategoryProfileSummary = useMemo(
    () => getCategoryProfileSummary(safeData, selectedCategory?.id || null),
    [safeData, selectedCategory?.id]
  );

  const reportGoals = useMemo(() => {
    const list = goals.filter((goal) => goal && typeof goal.id === "string");
    return list;
  }, [goals]);

  const [reportWindow, setReportWindow] = useState("7d");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportCategoryId, setReportCategoryId] = useState("");
  const [reportGoalId, setReportGoalId] = useState("");

  useEffect(() => {
    if (reportWindow === "custom") return;
    const bounds = getWindowBounds(reportWindow, now);
    setReportFrom(bounds.fromKey);
    setReportTo(bounds.toKey);
  }, [now, reportWindow]);

  useEffect(() => {
    if (!reportGoalId) return;
    const exists = reportGoals.some((goal) => goal.id === reportGoalId);
    if (!exists) setReportGoalId("");
  }, [reportGoalId, reportGoals]);

  const reportPreview = useMemo(() => {
    if (!reportFrom || !reportTo) return null;
    return buildReport(safeData, {
      fromKey: reportFrom,
      toKey: reportTo,
      categoryId: reportCategoryId || null,
      goalIds: reportGoalId ? [reportGoalId] : null,
    });
  }, [reportCategoryId, reportFrom, reportGoalId, reportTo, safeData]);

  const [disciplineWindowDays, setDisciplineWindowDays] = useState(14);

  const setPilotageSelectedCategory = useCallback(
    (categoryId) => {
      if (!categoryId || typeof setData !== "function") return;
      setData((previous) => {
        const prevUi = previous?.ui && typeof previous.ui === "object" ? previous.ui : {};
        if (getSelectedCategoryForView(prevUi, CATEGORY_VIEW.PILOTAGE) === categoryId) return previous;
        return {
          ...previous,
          ui: withSelectedCategoryByView(prevUi, {
            pilotage: categoryId,
            selectedCategoryId: categoryId,
          }),
        };
      });
    },
    [setData]
  );

  useEffect(() => {
    if (typeof setData !== "function") return;
    if (!categories.length) {
      setData((previous) => {
        const prevUi = previous?.ui && typeof previous.ui === "object" ? previous.ui : {};
        if (getSelectedCategoryForView(prevUi, CATEGORY_VIEW.PILOTAGE) == null) return previous;
        return {
          ...previous,
          ui: withSelectedCategoryByView(prevUi, {
            pilotage: null,
          }),
        };
      });
      return;
    }
    const current = getSelectedCategoryForView(safeData, CATEGORY_VIEW.PILOTAGE) || null;
    const exists = current ? categories.some((category) => category.id === current) : false;
    if (!exists) {
      setPilotageSelectedCategory(categories[0].id);
    }
  }, [categories, safeData, setData, setPilotageSelectedCategory]);

  const disciplineTrend = useMemo(
    () =>
      buildPilotageDisciplineTrend(safeData, {
        categoryId: selectedCategory?.id || null,
        windowDays: disciplineWindowDays,
        now,
      }),
    [disciplineWindowDays, now, safeData, selectedCategory?.id]
  );

  const coachFallback = useMemo(
    () =>
      buildPilotageCoachFallback({
        selectedCategory,
        selectedCategoryProfileSummary,
        selectedCounts,
        selectedWeek,
        constanceSummary,
        disciplineTrend,
      }),
    [constanceSummary, disciplineTrend, selectedCategory, selectedCategoryProfileSummary, selectedCounts, selectedWeek]
  );
  const pilotageAnalysisContextKey = useMemo(
    () =>
      buildPilotageManualAiContextKey({
        userId,
        fromKey: weekBounds.fromKey,
        toKey: weekBounds.toKey,
        activeCategoryId: selectedCategory?.id || null,
      }),
    [selectedCategory?.id, userId, weekBounds.fromKey, weekBounds.toKey]
  );
  const manualPilotageAnalysis = useManualAiAnalysis({
    data: safeData,
    setData,
    contextKey: pilotageAnalysisContextKey,
    surface: "pilotage",
  });
  const pilotageAnalysisState = useMemo(
    () =>
      resolveManualAiDisplayState({
        loading: manualPilotageAnalysis.loading,
        visibleAnalysis: manualPilotageAnalysis.visibleAnalysis,
        wasRefreshed: manualPilotageAnalysis.wasRefreshed,
      }),
    [manualPilotageAnalysis.loading, manualPilotageAnalysis.visibleAnalysis, manualPilotageAnalysis.wasRefreshed]
  );
  const persistedPilotageAnalysis = manualPilotageAnalysis.visibleAnalysis
    ? {
        summary: manualPilotageAnalysis.visibleAnalysis.headline,
        problem: manualPilotageAnalysis.visibleAnalysis.reason,
        recommendation: [
          manualPilotageAnalysis.visibleAnalysis.primaryAction?.label || "",
          Number.isFinite(manualPilotageAnalysis.visibleAnalysis.suggestedDurationMin)
            ? `${manualPilotageAnalysis.visibleAnalysis.suggestedDurationMin} min`
            : "",
        ]
          .filter(Boolean)
          .join(" • "),
      }
    : null;

  const handleAnalyzeCategory = useCallback(async () => {
    if (!selectedCategory) return;
    await manualPilotageAnalysis.runAnalysis({
      execute: () =>
        requestAiCoachChat({
          accessToken,
          payload: {
            selectedDateKey,
            activeCategoryId: selectedCategory.id,
            message: "Analyse cette catégorie et donne un résumé court, un problème majeur et une recommandation concrète.",
            recentMessages: [],
          },
        }),
      serializeSuccess: (result) =>
        createPersistedChatAnalysisEntry({
          contextKey: pilotageAnalysisContextKey,
          surface: "pilotage",
          storageScope: persistenceScope,
          reply: result?.reply,
        }),
    });
  }, [accessToken, manualPilotageAnalysis, persistenceScope, pilotageAnalysisContextKey, selectedCategory, selectedDateKey]);

  const downloadFile = useCallback((filename, content, type) => {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  }, []);

  const handleExportReport = useCallback(() => {
    if (!reportPreview) return;
    const meta = reportPreview.meta || {};
    const from = meta.fromKey || reportFrom || "report";
    const to = meta.toKey || reportTo || "report";
    const base = `report-${from}-${to}`;
    const payload = JSON.stringify(reportPreview, null, 2);
    const { dailyCsv, goalsCsv } = exportReportToCSV(reportPreview);
    downloadFile(`${base}.json`, payload, "application/json");
    downloadFile(`${base}-daily.csv`, dailyCsv, "text/csv");
    downloadFile(`${base}-goals.csv`, goalsCsv, "text/csv");
  }, [downloadFile, reportFrom, reportPreview, reportTo]);

  const getCategoryColor = useCallback(
    (category) => category?.color || category?.accentColor || category?.hex || category?.themeColor || "#6EE7FF",
    []
  );

  return (
    <ScreenShell
      headerTitle={<span data-tour-id="pilotage-title">Pilotage</span>}
      headerSubtitle="Vue d'ensemble"
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="stack stackGap12">
        {legacyBuckets.pilotageRituals.length ? (
          <Card>
            <div className="p18 col" style={{ gap: 8 }}>
              <div className="sectionTitle">Rituels hérités</div>
              <div className="small">
                {legacyBuckets.pilotageRituals.length} élément{legacyBuckets.pilotageRituals.length > 1 ? "s" : ""} d’organisation ou de revue a été retiré{legacyBuckets.pilotageRituals.length > 1 ? "s" : ""} du flux d’exécution.
              </div>
              <div className="col" style={{ gap: 6 }}>
                {legacyBuckets.pilotageRituals.slice(0, 4).map((goal) => (
                  <div key={goal.id} className="small2 textMuted">
                    {goal.title || "Rituel"}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="p18">
            <div className="sectionTitle">Focus catégorie</div>
            <div className="mt12 col" role="list" style={{ gap: 10 }}>
              {categories.map((category) => {
                const counts = countsByCategory.get(category.id) || { activeOutcomesCount: 0, processCount: 0 };
                const label = statusByCategory.get(category.id) || "ACTIVE";
                const summary =
                  counts.activeOutcomesCount || counts.processCount
                    ? `${counts.activeOutcomesCount} ${LABELS.goalsLower} · ${counts.processCount} ${LABELS.actionsLower}`
                    : "Aucun élément";
                return (
                  <PilotageCategoryRow
                    key={category.id}
                    color={getCategoryColor(category)}
                    selected={selectedCategoryId === category.id}
                    onClick={() => setPilotageSelectedCategory(category.id)}
                    summary={summary}
                    statusLabel={STATUS_LABELS[label] || "Active"}
                    statusStyle={STATUS_STYLES[label] || STATUS_STYLES.ACTIVE}
                  >
                    {category.name || "Catégorie"}
                  </PilotageCategoryRow>
                );
              })}
            </div>

            {selectedCategory ? (
              <div className="mt14" style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="row pilotageCardHeader" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div className="sectionTitle">{selectedCategory.name || "Catégorie"}</div>
                    <div className="small2 textMuted">Lecture stratégique simplifiée</div>
                  </div>
                  {selectedStatus ? (
                    <GateBadge
                      className="pilotageStatusBadge"
                      style={{
                        ...(STATUS_STYLES[selectedStatus] || STATUS_STYLES.ACTIVE),
                        borderWidth: 1,
                        borderStyle: "solid",
                      }}
                    >
                      {STATUS_LABELS[selectedStatus] || "Active"}
                    </GateBadge>
                  ) : null}
                </div>

                <div className="mt10 col" style={{ gap: 10 }}>
                  {selectedCategoryProfileSummary?.subject ? (
                    <StatRow label="Sujet principal" value={selectedCategoryProfileSummary.subject} />
                  ) : null}
                  {selectedCategoryProfileSummary?.mainGoal ? (
                    <StatRow label="Objectif principal" value={selectedCategoryProfileSummary.mainGoal} />
                  ) : null}
                  {selectedCategoryProfileSummary?.currentPriority ? (
                    <StatRow label="Priorité actuelle" value={selectedCategoryProfileSummary.currentPriority} />
                  ) : null}
                  <StatRow
                    label="Structure"
                    value={
                      selectedCounts
                        ? `${selectedCounts.activeOutcomesCount || 0} ${LABELS.goalsLower} · ${selectedCounts.processCount || 0} ${LABELS.actionsLower}`
                        : "—"
                    }
                  />
                  <StatRow
                    label="Semaine (fait / attendu)"
                    value={selectedWeek ? `${selectedWeek.done || 0} / ${selectedWeek.expected || 0}` : "—"}
                    right={
                      selectedWeek && (selectedWeek.missed || 0) > 0 ? (
                        <GateBadge
                          className="pilotageStatusBadge"
                          style={{ ...STATUS_STYLES.EMPTY, borderWidth: 1, borderStyle: "solid" }}
                        >
                          {selectedWeek.missed} manquée{selectedWeek.missed > 1 ? "s" : ""}
                        </GateBadge>
                      ) : null
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card data-tour-id="pilotage-discipline">
          <div className="p18 col" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div className="sectionTitle">Évolution discipline</div>
                <div className="small2 textMuted">Courbe simple du ratio fait / prévu sur la catégorie active.</div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {PILOTAGE_DISCIPLINE_WINDOWS.map((windowDays) => (
                  <Button
                    key={windowDays}
                    variant={disciplineWindowDays === windowDays ? "primary" : "ghost"}
                    onClick={() => setDisciplineWindowDays(windowDays)}
                  >
                    {windowDays} jours
                  </Button>
                ))}
              </div>
            </div>
            <div className="pilotageTopGrid">
              <div className="listItem GateRowPremium">
                <div className="small2">Score actuel</div>
                <div className="titleSm">
                  {Number.isFinite(disciplineTrend.summary.currentScore) ? `${disciplineTrend.summary.currentScore}%` : "—"}
                </div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Lecture</div>
                <div className="titleSm">{disciplineTrend.summary.trendLabel}</div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Jours scorés</div>
                <div className="titleSm">{disciplineTrend.summary.scoredDays}</div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Jours neutres</div>
                <div className="titleSm">{disciplineTrend.summary.neutralDays}</div>
              </div>
            </div>
            <DisciplineTrendChart trend={disciplineTrend} color={getCategoryColor(selectedCategory)} />
            <div className="pilotageInsights">
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Tendance</div>
                <div>{disciplineTrend.summary.trendDetail}</div>
              </div>
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Delta récent</div>
                <div>{disciplineTrend.summary.delta > 0 ? "+" : ""}{disciplineTrend.summary.delta} points</div>
              </div>
            </div>
          </div>
        </Card>

        <Card data-tour-id="pilotage-load">
          <div className="p18 col" style={{ gap: 12 }}>
            <div>
              <div className="sectionTitle">Constance</div>
              <div className="small2 textMuted">Lecture utile sur 7 jours</div>
            </div>
            <div className="pilotageTopGrid">
              <div className="listItem GateRowPremium">
                <div className="small2">Jours actifs</div>
                <div className="titleSm">{constanceSummary.activeDays7}/7</div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Temps investi réel</div>
                <div className="titleSm">{formatMinutes(constanceSummary.realMinutes7)}</div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Régularité</div>
                <div className="titleSm">{Math.round(constanceSummary.regularity * 100)}%</div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Qualification</div>
                <div className="titleSm">{constanceSummary.constanceLabel}</div>
              </div>
            </div>
            <Meter
              value01={constanceSummary.regularity}
              tone={
                constanceSummary.constanceLabel === "stable"
                  ? "good"
                  : constanceSummary.constanceLabel === "en progression"
                    ? "warn"
                    : "bad"
              }
              label="Régularité hebdo"
            />
            <div className="col" style={{ gap: 8 }}>
              <StatRow label="Sessions faites" value={String(constanceSummary.doneCount || 0)} />
              <StatRow label="Sessions attendues" value={String(constanceSummary.expectedCount || 0)} />
              <StatRow label="Sessions manquées" value={String(constanceSummary.missedCount || 0)} />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p18 col" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div className="sectionTitle">Lecture locale</div>
                <ManualAiStatus
                  statusKind={pilotageAnalysisState.kind}
                  statusLabel={pilotageAnalysisState.label}
                  detailLabel={
                    manualPilotageAnalysis.visibleAnalysis
                      ? persistenceScope === "cloud"
                        ? "Synchronisée sur tes appareils."
                        : "Enregistrée sur cet appareil."
                      : "Métriques déterministes d’abord, analyse IA sur demande."
                  }
                  stageLabel={manualPilotageAnalysis.loadingStageLabel}
                />
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button onClick={handleAnalyzeCategory} disabled={!selectedCategory || manualPilotageAnalysis.loading}>
                  {manualPilotageAnalysis.loading ? manualPilotageAnalysis.loadingStageLabel || "Analyse..." : "Analyser cette catégorie"}
                </Button>
                {manualPilotageAnalysis.isPersistedForContext ? (
                  <Button variant="ghost" onClick={manualPilotageAnalysis.dismissAnalysis}>
                    Revenir au diagnostic local
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="pilotageInsights">
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Résumé</div>
                <div>{coachFallback.summary}</div>
              </div>
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Problème majeur</div>
                <div>{coachFallback.problem}</div>
              </div>
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Recommandation</div>
                <div>{coachFallback.recommendation}</div>
              </div>
            </div>

            {persistedPilotageAnalysis ? (
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  paddingTop: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div>
                  <div className="sectionTitle">Analyse IA</div>
                  <div className="small2 textMuted">
                    {persistenceScope === "cloud" ? "Synchronisée sur tes appareils." : "Enregistrée sur cet appareil."}
                  </div>
                </div>
                <div className="pilotageInsights">
                  <div className="pilotageInsightItem">
                    <div className="small2 textMuted">Résumé</div>
                    <div>{persistedPilotageAnalysis.summary}</div>
                  </div>
                  <div className="pilotageInsightItem">
                    <div className="small2 textMuted">Problème majeur</div>
                    <div>{persistedPilotageAnalysis.problem}</div>
                  </div>
                  <div className="pilotageInsightItem">
                    <div className="small2 textMuted">Recommandation</div>
                    <div>{persistedPilotageAnalysis.recommendation}</div>
                  </div>
                </div>
              </div>
            ) : null}

            {manualPilotageAnalysis.error ? (
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  paddingTop: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div className="sectionTitle">Analyse indisponible</div>
                <div className="small2 textMuted">{manualPilotageAnalysis.error}</div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card data-tour-id="pilotage-reporting">
          <div className="p18">
            <div className="sectionTitle">Reporting</div>
            <div className="mt12 col" style={{ gap: 12 }}>
              <div className="col" style={{ gap: 6 }}>
                <div className="small2 textMuted">Période</div>
                <Select value={reportWindow} onChange={(event) => setReportWindow(event.target.value)}>
                  <option value="7d">7 jours</option>
                  <option value="14d">14 jours</option>
                  <option value="90d">90 jours</option>
                  <option value="custom">Personnalisée</option>
                </Select>
              </div>

              {reportWindow === "custom" ? (
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <div className="col" style={{ gap: 6 }}>
                    <div className="small2 textMuted">Du</div>
                    <Input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} />
                  </div>
                  <div className="col" style={{ gap: 6 }}>
                    <div className="small2 textMuted">Au</div>
                    <Input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} />
                  </div>
                </div>
              ) : null}

              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <div className="col" style={{ gap: 6, minWidth: 180 }}>
                  <div className="small2 textMuted">Catégorie</div>
                  <Select value={reportCategoryId} onChange={(event) => setReportCategoryId(event.target.value)}>
                    <option value="">Toutes</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name || "Catégorie"}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col" style={{ gap: 6, minWidth: 200 }}>
                  <div className="small2 textMuted">Action</div>
                  <Select value={reportGoalId} onChange={(event) => setReportGoalId(event.target.value)}>
                    <option value="">Toutes</option>
                    {reportGoals
                      .filter((goal) => !reportCategoryId || goal.categoryId === reportCategoryId)
                      .map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.title || "Action"}
                        </option>
                      ))}
                  </Select>
                </div>
              </div>

              <div className="col" style={{ gap: 8 }}>
                <StatRow label="Occurrences attendues" value={String(reportPreview?.totals?.expected || 0)} />
                <StatRow label="Occurrences faites" value={String(reportPreview?.totals?.done || 0)} />
                <StatRow label="Occurrences manquées" value={String(reportPreview?.totals?.missed || 0)} />
                <StatRow label="Occurrences annulées" value={String(reportPreview?.totals?.canceled || 0)} />
                <StatRow label="Occurrences planifiées" value={String(reportPreview?.totals?.planned || 0)} />
              </div>

              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div className="small2 textMuted">Exporte JSON + CSV (par jour et par action).</div>
                <Button onClick={handleExportReport} disabled={!reportPreview}>
                  Exporter
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
