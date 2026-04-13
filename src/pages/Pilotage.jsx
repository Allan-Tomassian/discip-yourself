import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import AiDebugLine from "../components/ai/AiDebugLine";
import { getCategoryProfileSummary } from "../domain/categoryProfile";
import { requestAiLocalAnalysis } from "../infra/aiLocalAnalysisClient";
import {
  buildPilotageManualAiContextKey,
  createPersistedLocalAnalysisEntry,
} from "../features/manualAi/manualAiAnalysis";
import { resolveManualAiDisplayState } from "../features/manualAi/displayState";
import { useManualAiAnalysis } from "../hooks/useManualAiAnalysis";
import { getCategoryPilotageCounts, getCategoryStatus } from "../logic/pilotage";
import { getWindowBounds } from "../logic/metrics";
import { computeWindowStats } from "../logic/progressionModel";
import AccentCategoryRow from "../components/AccentCategoryRow";
import { ANALYSIS_COPY, LABELS, MAIN_PAGE_COPY, SURFACE_LABELS, UI_COPY } from "../ui/labels";
import {
  CATEGORY_VIEW,
  getExecutionActiveCategoryId,
  getSelectedCategoryForView,
  getVisibleCategories,
  resolvePreferredVisibleCategoryId,
  withExecutionActiveCategoryId,
} from "../domain/categoryVisibility";
import { collectSystemInboxBuckets } from "../domain/systemInboxMigration";
import { getCategoryUiVars, resolveCategoryStateTone } from "../utils/categoryAccent";
import { resolveCategoryColor } from "../utils/categoryPalette";
import DisciplineTrendChart from "../features/pilotage/DisciplineTrendChart";
import { buildPilotageDisciplineTrend, PILOTAGE_DISCIPLINE_WINDOWS } from "../features/pilotage/disciplineTrendModel";
import ManualAiStatus from "../components/ai/ManualAiStatus";
import { BehaviorCue } from "../feedback/BehaviorFeedbackContext";
import { derivePilotageBehaviorCue } from "../feedback/feedbackDerivers";
import {
  AppCard,
  AppScreen,
  FeedbackMessage,
  GhostButton,
  MetricRow,
  PrimaryButton,
  SectionHeader,
  StatusBadge,
} from "../shared/ui/app";
import "../features/pilotage/pilotage.css";
import "../components/categorySurface.css";

const STATUS_LABELS = {
  EMPTY: "Vide",
  DONE: "Terminée",
  ACTIVE: "Active",
};

const STATUS_TONES = {
  ACTIVE: "success",
  DONE: "info",
  EMPTY: "warning",
};

const DISCIPLINE_TREND_LABELS = {
  stable: "Rythme stable",
  hausse: "En hausse",
  baisse: "En baisse",
  irrégularité: "Rythme irrégulier",
};

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

function formatMinutes(value) {
  if (!Number.isFinite(value)) return "0 min";
  return `${Math.max(0, Math.round(value))} min`;
}

function resolveExpectedRatio(done, expected) {
  if (!Number.isFinite(expected) || expected <= 0) return null;
  return clamp01((Number.isFinite(done) ? done : 0) / expected);
}

function PilotageCategoryRow({
  category,
  color,
  selected,
  onClick,
  summary,
  statusLabel,
  statusTone,
  children,
  ...props
}) {
  return (
    <AccentCategoryRow
      className="pilotageCategoryRow"
      category={category}
      color={color}
      selected={selected}
      onClick={onClick}
      rightSlot={
        <StatusBadge className="pilotageStatusBadge" tone={statusTone}>
          {statusLabel}
        </StatusBadge>
      }
      {...props}
    >
      <div className="itemTitle">{children}</div>
      <div className="itemSub">{summary}</div>
    </AccentCategoryRow>
  );
}

function PilotageMetricCard({ label, value, style, className = "" }) {
  return (
    <div className={`pilotageMetricCard ${className}`.trim()} style={style}>
      <MetricRow label={label} value={value} />
    </div>
  );
}

function PilotageInsightCard({ label, children, className = "" }) {
  return (
    <div className={`pilotageInsightCard ${className}`.trim()}>
      <div className="pilotageInsightLabel">{label}</div>
      <div className="pilotageInsightCopy">{children}</div>
    </div>
  );
}

function PilotageSummaryBlock({ label, children, className = "" }) {
  return (
    <div className={`pilotageSummaryBlock ${className}`.trim()}>
      <div className="pilotageInsightLabel">{label}</div>
      <div className="pilotageInsightCopy">{children}</div>
    </div>
  );
}

function PilotageMetricBlock({ label, value, className = "" }) {
  return (
    <div className={`pilotageMetricBlock ${className}`.trim()}>
      <MetricRow label={label} value={value} />
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

function formatDisciplineTrendLabel(label) {
  return DISCIPLINE_TREND_LABELS[label] || "Rythme stable";
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

function buildPilotageGlobalSummary({ categories, countsByCategory, statusByCategory, selectedCategory }) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const structuredCategories = safeCategories.filter((category) => {
    const counts = countsByCategory.get(category.id) || {};
    return (counts.activeOutcomesCount || 0) > 0 || (counts.processCount || 0) > 0;
  });
  const emptyCategories = safeCategories.filter((category) => {
    const counts = countsByCategory.get(category.id) || {};
    return (counts.activeOutcomesCount || 0) === 0 && (counts.processCount || 0) === 0;
  });
  const activeStatuses = safeCategories.filter((category) => (statusByCategory.get(category.id) || "ACTIVE") === "ACTIVE");
  const focusCategory =
    selectedCategory ||
    [...structuredCategories].sort((left, right) => {
      const leftCounts = countsByCategory.get(left.id) || {};
      const rightCounts = countsByCategory.get(right.id) || {};
      return (rightCounts.processCount || 0) - (leftCounts.processCount || 0);
    })[0] ||
    safeCategories[0] ||
    null;

  if (!safeCategories.length) {
    return {
      summary: "Aucune catégorie visible pour le moment.",
      strongestSignal: "Ajoute une catégorie ou rends-la visible pour commencer le pilotage.",
      frictionSignal: "",
      dormantSignal: "",
      focusCategory: null,
    };
  }

  const strongestSignal = focusCategory?.name
    ? `${focusCategory.name} est la catégorie la plus exploitable en ce moment.`
    : structuredCategories.length
      ? `${structuredCategories.length} catégorie${structuredCategories.length > 1 ? "s" : ""} ont déjà une base utile.`
      : "Aucune catégorie n’a encore une base assez solide.";
  const frictionSignal = emptyCategories.length
    ? `${emptyCategories.length} catégorie${emptyCategories.length > 1 ? "s" : ""} restent sans structure claire.`
    : activeStatuses.length
      ? `${activeStatuses.length} catégorie${activeStatuses.length > 1 ? "s" : ""} tiennent encore une cadence active.`
      : "Aucune catégorie n’entretient encore un vrai rythme.";
  const dormantSignal = emptyCategories.length
    ? `${emptyCategories[0]?.name || "Une catégorie"} reste encore vide ou peu structurée.`
    : structuredCategories.length > activeStatuses.length
      ? "Une partie des catégories structurées reste encore peu activée."
      : "La base actuelle est exploitable sans angle mort majeur.";

  return {
    summary:
      structuredCategories.length > 0
        ? `${structuredCategories.length} catégorie${structuredCategories.length > 1 ? "s" : ""} sur ${safeCategories.length} montrent déjà une dynamique exploitable.`
        : "Aucune catégorie n’a encore assez de structure pour dégager une vraie lecture.",
    strongestSignal,
    frictionSignal,
    dormantSignal,
    focusCategory,
  };
}

function buildPilotageGlobalStats({
  categories,
  countsByCategory,
  statusByCategory,
  globalWindowStats,
  globalConstanceSummary,
}) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const structuredCategories = safeCategories.filter((category) => {
    const counts = countsByCategory.get(category.id) || {};
    return (counts.activeOutcomesCount || 0) > 0 || (counts.processCount || 0) > 0;
  });
  const activeCategories = safeCategories.filter((category) => (statusByCategory.get(category.id) || "ACTIVE") === "ACTIVE");

  return {
    globalScore: Number.isFinite(globalWindowStats?.discipline?.score) ? globalWindowStats.discipline.score : 0,
    doneCount: globalWindowStats?.occurrences?.done || 0,
    expectedCount: globalWindowStats?.occurrences?.expected || 0,
    missedCount: globalWindowStats?.occurrences?.missed || 0,
    activeDays7: globalConstanceSummary?.activeDays7 || 0,
    realMinutes7: globalConstanceSummary?.realMinutes7 || 0,
    structuredCategories: structuredCategories.length,
    activeCategories: activeCategories.length,
  };
}

export default function Pilotage({
  data,
  setData,
  persistenceScope = "local_fallback",
  generationWindowDays = null,
  isPlanningUnlimited = false,
  onOpenCoach,
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
      getExecutionActiveCategoryId(safeData),
      getSelectedCategoryForView(safeData, CATEGORY_VIEW.PILOTAGE),
      getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY),
    ],
  });

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const detailCategory = useMemo(
    () => categories.find((category) => category.id === openCategoryId) || null,
    [categories, openCategoryId]
  );
  const activePilotageSurfaceVars = useMemo(
    () => (selectedCategory ? getCategoryUiVars(selectedCategory, { level: "surface" }) : null),
    [selectedCategory]
  );

  const detailCounts = useMemo(
    () => (detailCategory?.id ? countsByCategory.get(detailCategory.id) || null : null),
    [countsByCategory, detailCategory?.id]
  );
  const detailWeek = useMemo(() => {
    if (!detailCategory?.id) return null;
    return computeWindowStats(safeData, weekBounds.fromKey, weekBounds.toKey, {
      filters: { categoryId: detailCategory.id },
      includeMicroContribution: false,
    }).occurrences;
  }, [detailCategory?.id, safeData, weekBounds.fromKey, weekBounds.toKey]);
  const globalWeek = useMemo(
    () =>
      computeWindowStats(safeData, weekBounds.fromKey, weekBounds.toKey, {
        includeMicroContribution: false,
      }),
    [safeData, weekBounds.fromKey, weekBounds.toKey]
  );

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

  const detailWeekOccurrences = useMemo(() => {
    if (!detailCategory?.id) return [];
    const goalsById = new Map(goals.filter((goal) => goal?.id).map((goal) => [goal.id, goal]));
    return occurrences.filter((occurrence) => {
      const dateKey = typeof occurrence?.date === "string" ? occurrence.date : "";
      if (!dateKey || dateKey < weekBounds.fromKey || dateKey > weekBounds.toKey) return false;
      const goal = goalsById.get(occurrence?.goalId || "") || null;
      return goal?.categoryId === detailCategory.id;
    });
  }, [detailCategory?.id, goals, occurrences, weekBounds.fromKey, weekBounds.toKey]);
  const globalWeekOccurrences = useMemo(() => {
    return occurrences.filter((occurrence) => {
      const dateKey = typeof occurrence?.date === "string" ? occurrence.date : "";
      return Boolean(dateKey) && dateKey >= weekBounds.fromKey && dateKey <= weekBounds.toKey;
    });
  }, [occurrences, weekBounds.fromKey, weekBounds.toKey]);

  const constanceSummary = useMemo(
    () => buildConstanceSummary({ occurrences: detailWeekOccurrences, sessionHistoryByOccurrenceId }),
    [detailWeekOccurrences, sessionHistoryByOccurrenceId]
  );
  const globalConstanceSummary = useMemo(
    () => buildConstanceSummary({ occurrences: globalWeekOccurrences, sessionHistoryByOccurrenceId }),
    [globalWeekOccurrences, sessionHistoryByOccurrenceId]
  );
  const detailCategoryProfileSummary = useMemo(
    () => getCategoryProfileSummary(safeData, detailCategory?.id || null),
    [detailCategory?.id, safeData]
  );

  const [disciplineWindowDays, setDisciplineWindowDays] = useState(14);

  const setPilotageSelectedCategory = useCallback(
    (categoryId) => {
      if (!categoryId || typeof setData !== "function") return;
      setData((previous) => {
        const prevUi = previous?.ui && typeof previous.ui === "object" ? previous.ui : {};
        if (getExecutionActiveCategoryId(prevUi) === categoryId) return previous;
        return {
          ...previous,
          ui: withExecutionActiveCategoryId(prevUi, categoryId),
        };
      });
    },
    [setData]
  );

  const togglePilotageCategory = useCallback(
    (categoryId) => {
      if (!categoryId) return;
      setPilotageSelectedCategory(categoryId);
      setOpenCategoryId((previous) => (previous === categoryId ? null : categoryId));
    },
    [setPilotageSelectedCategory]
  );

  useEffect(() => {
    if (typeof setData !== "function") return;
    if (!categories.length) {
      setData((previous) => {
        const prevUi = previous?.ui && typeof previous.ui === "object" ? previous.ui : {};
        if (getExecutionActiveCategoryId(prevUi) == null) return previous;
        return {
          ...previous,
          ui: withExecutionActiveCategoryId(prevUi, null),
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

  useEffect(() => {
    if (!openCategoryId) return;
    const exists = categories.some((category) => category.id === openCategoryId);
    if (!exists) setOpenCategoryId(null);
  }, [categories, openCategoryId]);

  const disciplineTrend = useMemo(
    () =>
      buildPilotageDisciplineTrend(safeData, {
        categoryId: detailCategory?.id || null,
        windowDays: disciplineWindowDays,
        now,
      }),
    [detailCategory?.id, disciplineWindowDays, now, safeData]
  );
  const disciplineTrendChartKey = useMemo(
    () =>
      [
        detailCategory?.id || "all",
        disciplineTrend?.windowDays || disciplineWindowDays,
        disciplineTrend?.fromKey || "from",
        disciplineTrend?.toKey || "to",
      ].join(":"),
    [detailCategory?.id, disciplineTrend?.fromKey, disciplineTrend?.toKey, disciplineTrend?.windowDays, disciplineWindowDays]
  );
  const globalPilotageSummary = useMemo(
    () =>
      buildPilotageGlobalSummary({
        categories,
        countsByCategory,
        statusByCategory,
        selectedCategory,
      }),
    [categories, countsByCategory, selectedCategory, statusByCategory]
  );
  const [showDeferredCategories, setShowDeferredCategories] = useState(false);
  const focusCategories = useMemo(
    () =>
      categories.map((category) => {
        const counts = countsByCategory.get(category.id) || { activeOutcomesCount: 0, processCount: 0 };
        const status = statusByCategory.get(category.id) || "ACTIVE";
        return {
          category,
          counts,
          status,
          isStructured: Boolean((counts.activeOutcomesCount || 0) > 0 || (counts.processCount || 0) > 0),
          summary:
            counts.activeOutcomesCount || counts.processCount
              ? `${counts.activeOutcomesCount} ${LABELS.goalsLower} · ${counts.processCount} ${LABELS.actionsLower}`
              : "Aucun élément",
        };
      }),
    [categories, countsByCategory, statusByCategory]
  );
  const structuredFocusCategories = useMemo(
    () => focusCategories.filter((entry) => entry.isStructured),
    [focusCategories]
  );
  const deferredFocusCategories = useMemo(
    () => focusCategories.filter((entry) => !entry.isStructured),
    [focusCategories]
  );
  const isDeferredGroupOpen =
    showDeferredCategories ||
    structuredFocusCategories.length === 0 ||
    deferredFocusCategories.some((entry) => entry.category.id === openCategoryId);
  const globalPilotageStats = useMemo(
    () =>
      buildPilotageGlobalStats({
        categories,
        countsByCategory,
        statusByCategory,
        globalWindowStats: globalWeek,
        globalConstanceSummary,
      }),
    [categories, countsByCategory, globalConstanceSummary, globalWeek, statusByCategory]
  );

  const coachFallback = useMemo(
    () =>
      buildPilotageCoachFallback({
        selectedCategory: detailCategory,
        selectedCategoryProfileSummary: detailCategoryProfileSummary,
        selectedCounts: detailCounts,
        selectedWeek: detailWeek,
        constanceSummary,
        disciplineTrend,
      }),
    [constanceSummary, detailCategory, detailCategoryProfileSummary, detailCounts, detailWeek, disciplineTrend]
  );
  const pilotageAnalysisContextKey = useMemo(
    () =>
      buildPilotageManualAiContextKey({
        userId,
        fromKey: weekBounds.fromKey,
        toKey: weekBounds.toKey,
        activeCategoryId: detailCategory?.id || null,
      }),
    [detailCategory?.id, userId, weekBounds.fromKey, weekBounds.toKey]
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
  const pilotageBehaviorCue = useMemo(
    () =>
      derivePilotageBehaviorCue({
        disciplineTrend,
        constanceSummary,
        selectedCategory: detailCategory,
      }),
    [constanceSummary, detailCategory, disciplineTrend]
  );

  const handleAnalyzeCategory = useCallback(async () => {
    if (!detailCategory) return;
    await manualPilotageAnalysis.runAnalysis({
      execute: () =>
        requestAiLocalAnalysis({
          accessToken,
          payload: {
            selectedDateKey,
            activeCategoryId: detailCategory.id,
            surface: "pilotage",
            message: "Analyse cette catégorie et donne un résumé court, un problème majeur et une recommandation concrète.",
          },
        }),
      serializeSuccess: (result) =>
        createPersistedLocalAnalysisEntry({
          contextKey: pilotageAnalysisContextKey,
          surface: "pilotage",
          storageScope: persistenceScope,
          reply: result?.reply,
        }),
    });
  }, [accessToken, detailCategory, manualPilotageAnalysis, persistenceScope, pilotageAnalysisContextKey, selectedDateKey]);

  const getCategoryColor = useCallback(
    (category) => resolveCategoryColor(category, "#4F7CFF"),
    []
  );
  const renderInlineCategoryDetail = (category) => {
    if (!category || openCategoryId !== category.id) return null;
    const sharedSurfaceVars = getCategoryUiVars(category, { level: "surface" });
    const completionTone = resolveCategoryStateTone({
      value: resolveExpectedRatio(detailWeek?.done, detailWeek?.expected),
      done: detailWeek?.done,
      expected: detailWeek?.expected,
    });
    const scoreTone = resolveCategoryStateTone({
      value: Number.isFinite(disciplineTrend.summary.currentScore) ? disciplineTrend.summary.currentScore / 100 : null,
    });
    const activeDaysTone = resolveCategoryStateTone({
      value: constanceSummary.activeDays7 / 7,
    });
    const trendTone =
      disciplineTrend.summary.trendLabel === "baisse"
        ? "critical"
        : disciplineTrend.summary.trendLabel === "irrégularité"
        ? "weak"
        : "default";
    return (
      <div className="pilotageInlineDetail" style={sharedSurfaceVars}>
        <div className="pilotageInlineGrid">
          <div
            className="pilotageInlinePanel pilotageInlinePanel--metrics"
            data-tour-id="pilotage-discipline"
            style={sharedSurfaceVars}
          >
            <div className="pilotagePanelHeader">
              <div className="pilotagePanelHeaderText">
                <div className="pilotagePanelTitle">Pilotage rapide</div>
                <div className="pilotagePanelSubtitle">4 signaux utiles et une mini courbe de lecture.</div>
              </div>
              <div className="pilotageCompactWindowControls">
                {PILOTAGE_DISCIPLINE_WINDOWS.map((windowDays) => (
                  disciplineWindowDays === windowDays ? (
                    <PrimaryButton
                      key={windowDays}
                      size="sm"
                      onClick={() => setDisciplineWindowDays(windowDays)}
                    >
                      {windowDays} j
                    </PrimaryButton>
                  ) : (
                    <GhostButton
                      key={windowDays}
                      size="sm"
                      onClick={() => setDisciplineWindowDays(windowDays)}
                    >
                      {windowDays} j
                    </GhostButton>
                  )
                ))}
              </div>
            </div>
            <div className="pilotageMiniStatsGrid">
              <PilotageMetricCard
                className="pilotageMiniStat"
                style={getCategoryUiVars(detailCategory, { level: "surface", stateTone: completionTone })}
                label="Fait / attendu"
                value={detailWeek ? `${detailWeek.done || 0} / ${detailWeek.expected || 0}` : "—"}
              />
              <PilotageMetricCard
                className="pilotageMiniStat"
                style={getCategoryUiVars(detailCategory, { level: "surface", stateTone: scoreTone })}
                label="Niveau actuel"
                value={Number.isFinite(disciplineTrend.summary.currentScore) ? `${disciplineTrend.summary.currentScore}%` : "—"}
              />
              <PilotageMetricCard
                className="pilotageMiniStat"
                style={getCategoryUiVars(detailCategory, { level: "surface", stateTone: trendTone })}
                label="Rythme"
                value={formatDisciplineTrendLabel(disciplineTrend.summary.trendLabel)}
              />
              <PilotageMetricCard
                className="pilotageMiniStat"
                style={getCategoryUiVars(detailCategory, { level: "surface", stateTone: activeDaysTone })}
                label="Jours actifs"
                value={`${constanceSummary.activeDays7}/7`}
              />
            </div>
            <DisciplineTrendChart
              key={disciplineTrendChartKey}
              trend={disciplineTrend}
              color={getCategoryColor(detailCategory)}
              animated
              variant="compact"
            />
          </div>

          <div
            className="pilotageInlinePanel pilotageInlinePanel--reading"
            style={sharedSurfaceVars}
          >
            <div className="pilotagePanelHeader">
              <div className="pilotagePanelHeaderText">
                <div className="pilotagePanelTitle">Lecture</div>
                <ManualAiStatus
                  statusKind={pilotageAnalysisState.kind}
                  statusLabel={pilotageAnalysisState.label}
                  detailLabel={
                    manualPilotageAnalysis.visibleAnalysis
                      ? persistenceScope === "cloud"
                        ? "Synchronisée sur tes appareils."
                        : "Enregistrée sur cet appareil."
                      : `Lecture locale prête. ${ANALYSIS_COPY.coachAnalysis} sur demande.`
                  }
                  stageLabel={manualPilotageAnalysis.loadingStageLabel}
                />
              </div>
              <div className="pilotagePanelActions">
                <PrimaryButton
                  size="sm"
                  onClick={handleAnalyzeCategory}
                  disabled={!detailCategory || manualPilotageAnalysis.loading}
                >
                  {manualPilotageAnalysis.loading
                    ? manualPilotageAnalysis.loadingStageLabel || "Lecture en cours..."
                    : manualPilotageAnalysis.visibleAnalysis
                      ? UI_COPY.rerunCoachAnalysis
                      : UI_COPY.coachAnalysis}
                </PrimaryButton>
                <GhostButton size="sm" onClick={() => onOpenCoach?.({ mode: "free" })}>
                  Ouvrir le Coach
                </GhostButton>
                {manualPilotageAnalysis.isPersistedForContext ? (
                  <GhostButton size="sm" onClick={manualPilotageAnalysis.dismissAnalysis}>
                    {UI_COPY.backToLocalDiagnostic}
                  </GhostButton>
                ) : null}
              </div>
            </div>
            {!detailCategoryProfileSummary?.hasProfile && !detailCounts?.processCount && !detailCounts?.activeOutcomesCount ? (
              <div className="pilotageEmptyHint">
                Cette catégorie n’a pas encore assez de structure pour produire une lecture plus fine.
              </div>
            ) : null}
            <div className="pilotageReadingGrid">
              <PilotageInsightCard label="Résumé">
                {persistedPilotageAnalysis?.summary || coachFallback.summary}
              </PilotageInsightCard>
              <PilotageInsightCard label="Point d’attention">
                {persistedPilotageAnalysis?.problem || coachFallback.problem}
              </PilotageInsightCard>
              <PilotageInsightCard label="Prochain pas">
                {persistedPilotageAnalysis?.recommendation || coachFallback.recommendation}
              </PilotageInsightCard>
            </div>
            {manualPilotageAnalysis.error ? (
              <div className="pilotageInlineAiPanel">
                <div className="pilotagePanelTitle">Lecture indisponible</div>
                <FeedbackMessage tone="warning">{manualPilotageAnalysis.error}</FeedbackMessage>
                <AiDebugLine diagnostics={manualPilotageAnalysis.errorDiagnostics} className="lovableMuted" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppScreen
      pageId="pilotage"
      headerTitle={<span data-tour-id="pilotage-title">{SURFACE_LABELS.pilotage}</span>}
      headerSubtitle={MAIN_PAGE_COPY.pilotage.orientation}
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="mainPageStack pilotagePage">
        <section className="mainPageSection">
          <SectionHeader
            title={MAIN_PAGE_COPY.pilotage.summaryTitle}
            subtitle="Lis rapidement où ton système progresse vraiment."
          />
          <div className="mainPageSectionBody">
            <AppCard className="pilotageSummaryCard">
              <div className="pilotageSummaryStack">
                  <PilotageSummaryBlock label="Signal principal">
                    {globalPilotageSummary.summary}
                  </PilotageSummaryBlock>
                  {globalPilotageSummary.strongestSignal ? (
                    <PilotageSummaryBlock label="Zone la plus exploitable">
                      {globalPilotageSummary.strongestSignal}
                    </PilotageSummaryBlock>
                  ) : null}
                  {globalPilotageSummary.frictionSignal ? (
                    <PilotageSummaryBlock label="Point de friction">
                      {globalPilotageSummary.frictionSignal}
                    </PilotageSummaryBlock>
                  ) : null}
                  {globalPilotageSummary.dormantSignal ? (
                    <PilotageSummaryBlock label="Zone stagnante">
                      {globalPilotageSummary.dormantSignal}
                    </PilotageSummaryBlock>
                  ) : null}
              </div>
            </AppCard>
          </div>
        </section>

        <section className="mainPageSection">
          <SectionHeader
            title={MAIN_PAGE_COPY.pilotage.focusTitle}
            subtitle="Ouvre une catégorie pour lire ses signaux utiles, son rythme récent et son prochain pas crédible."
          />
          <div className="mainPageSectionBody">
            <AppCard
              variant="elevated"
              className="pilotageFocusCard"
              style={activePilotageSurfaceVars || undefined}
            >
              <div className="col gap12">
                {pilotageBehaviorCue ? (
                  <div>
                    <BehaviorCue cue={pilotageBehaviorCue} category={detailCategory || selectedCategory || null} />
                  </div>
                ) : null}
                <div className="col gap12" role="list">
                  <div className="pilotageFocusGroup">
                    <div className="pilotageFocusGroupHeader">
                      <div className="pilotageGroupMeta">Catégories déjà structurées</div>
                      <div className="pilotageGroupMeta">{structuredFocusCategories.length}</div>
                    </div>
                    <div className="col gap10">
                      {structuredFocusCategories.length ? structuredFocusCategories.map(({ category, status, summary }) => (
                        <div key={category.id} className="pilotageCategoryStack">
                          <PilotageCategoryRow
                            category={category}
                            color={getCategoryColor(category)}
                            selected={openCategoryId === category.id}
                            onClick={() => togglePilotageCategory(category.id)}
                            summary={summary}
                            statusLabel={STATUS_LABELS[status] || "Active"}
                            statusTone={STATUS_TONES[status] || "info"}
                          >
                            {category.name || "Catégorie"}
                          </PilotageCategoryRow>
                          {renderInlineCategoryDetail(category)}
                        </div>
                      )) : (
                        <div className="small2 textMuted">Aucune catégorie n’a encore une base assez solide.</div>
                      )}
                    </div>
                  </div>

                  {deferredFocusCategories.length ? (
                    <div className="pilotageFocusGroup pilotageFocusGroup--deferred">
                      <div className="pilotageDeferredRow">
                        <div className="pilotageGroupMeta">
                          {deferredFocusCategories.length} catégorie{deferredFocusCategories.length > 1 ? "s" : ""} à structurer
                        </div>
                        <GhostButton size="sm" onClick={() => setShowDeferredCategories((value) => !value)}>
                          {isDeferredGroupOpen ? "Masquer" : `Voir ${deferredFocusCategories.length} catégorie${deferredFocusCategories.length > 1 ? "s" : ""}`}
                        </GhostButton>
                      </div>
                      {isDeferredGroupOpen ? (
                        <div className="col gap10">
                          {deferredFocusCategories.map(({ category, status, summary }) => (
                            <div key={category.id} className="pilotageCategoryStack">
                              <PilotageCategoryRow
                                category={category}
                                color={getCategoryColor(category)}
                                selected={openCategoryId === category.id}
                                onClick={() => togglePilotageCategory(category.id)}
                                summary={summary}
                                statusLabel={STATUS_LABELS[status] || "Active"}
                                statusTone={STATUS_TONES[status] || "info"}
                              >
                                {category.name || "Catégorie"}
                              </PilotageCategoryRow>
                              {renderInlineCategoryDetail(category)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </AppCard>
          </div>
        </section>

        <section className="mainPageSection">
          <SectionHeader
            title={MAIN_PAGE_COPY.pilotage.statsTitle}
            subtitle="Lis le rythme récent avant d’ouvrir une catégorie."
          />
          <div className="mainPageSectionBody">
            <AppCard className="pilotageStatsCard">
              <div className="pilotageStatsStack">
                <div className="pilotageTopGrid">
                  <PilotageMetricBlock label="Niveau global" value={`${globalPilotageStats.globalScore}%`} />
                  <PilotageMetricBlock
                    label="Actions faites / attendues"
                    value={`${globalPilotageStats.doneCount} / ${globalPilotageStats.expectedCount}`}
                  />
                  <PilotageMetricBlock
                    label="Temps investi réel"
                    value={formatMinutes(globalPilotageStats.realMinutes7)}
                  />
                  <PilotageMetricBlock
                    label="Catégories actives"
                    value={`${globalPilotageStats.activeCategories} / ${Math.max(categories.length, 1)}`}
                  />
                </div>
                <div className="pilotageStatsNarratives">
                  <PilotageSummaryBlock label="Lecture du rythme">
                    <div>
                      {globalPilotageStats.structuredCategories} catégorie
                      {globalPilotageStats.structuredCategories > 1 ? "s" : ""} ont déjà une base exploitable, avec{" "}
                      {globalPilotageStats.activeDays7} jour{globalPilotageStats.activeDays7 > 1 ? "s" : ""} utile
                      {globalPilotageStats.activeDays7 > 1 ? "s" : ""} sur 7.
                    </div>
                  </PilotageSummaryBlock>
                  <PilotageSummaryBlock label="Points de friction">
                    <div>
                      {globalPilotageStats.missedCount > 0
                        ? `${globalPilotageStats.missedCount} occurrence${globalPilotageStats.missedCount > 1 ? "s" : ""} manquée${globalPilotageStats.missedCount > 1 ? "s" : ""} sur la fenêtre récente.`
                        : "Aucune occurrence manquée sur la fenêtre récente."}
                    </div>
                  </PilotageSummaryBlock>
                </div>
              </div>
            </AppCard>
          </div>
        </section>

        {legacyBuckets.pilotageRituals.length ? (
          <section className="mainPageSection">
            <SectionHeader
              title="Rituels hérités"
              subtitle={`${legacyBuckets.pilotageRituals.length} élément${legacyBuckets.pilotageRituals.length > 1 ? "s" : ""} d’organisation ou de revue a été retiré${legacyBuckets.pilotageRituals.length > 1 ? "s" : ""} du flux d’exécution.`}
            />
            <div className="mainPageSectionBody">
              <div className="pilotageLegacyList">
                {legacyBuckets.pilotageRituals.slice(0, 4).map((goal) => (
                  <div key={goal.id} className="small2 textMuted pilotageLegacyItem">
                    {goal.title || "Rituel"}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AppScreen>
  );
}
