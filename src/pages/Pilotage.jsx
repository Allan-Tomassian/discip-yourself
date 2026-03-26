import React, { useCallback, useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { GateBadge, GateButton, GateSection } from "../shared/ui/gate/Gate";
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
import { getCategoryAccentVars } from "../utils/categoryAccent";
import DisciplineTrendChart from "../features/pilotage/DisciplineTrendChart";
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
  category,
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
      category={category}
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
      signals: ["Ajoute une catégorie ou rends-la visible pour commencer le pilotage."],
      focusCategory: null,
    };
  }

  const signals = [];
  if (focusCategory?.name) {
    signals.push(`${focusCategory.name} reste le meilleur point d’entrée pour lire tes progrès actuels.`);
  }
  if (structuredCategories.length) {
    signals.push(`${structuredCategories.length} catégorie${structuredCategories.length > 1 ? "s" : ""} ont déjà une structure exploitable.`);
  }
  if (emptyCategories.length) {
    signals.push(`${emptyCategories.length} catégorie${emptyCategories.length > 1 ? "s" : ""} restent encore sans base claire.`);
  }
  if (activeStatuses.length) {
    signals.push(`${activeStatuses.length} catégorie${activeStatuses.length > 1 ? "s" : ""} sont actives cette semaine.`);
  }

  return {
    summary:
      structuredCategories.length > 0
        ? `${structuredCategories.length} catégorie${structuredCategories.length > 1 ? "s" : ""} sur ${safeCategories.length} montrent déjà une dynamique exploitable.`
        : "Aucune catégorie n’a encore assez de structure pour dégager une vraie lecture.",
    signals: signals.slice(0, 3),
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
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const detailCategory = useMemo(
    () => categories.find((category) => category.id === openCategoryId) || null,
    [categories, openCategoryId]
  );

  const detailCounts = useMemo(
    () => (detailCategory?.id ? countsByCategory.get(detailCategory.id) || null : null),
    [countsByCategory, detailCategory?.id]
  );
  const detailStatus = useMemo(
    () => (detailCategory?.id ? statusByCategory.get(detailCategory.id) || null : null),
    [detailCategory?.id, statusByCategory]
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

  const handleAnalyzeCategory = useCallback(async () => {
    if (!detailCategory) return;
    await manualPilotageAnalysis.runAnalysis({
      execute: () =>
        requestAiCoachChat({
          accessToken,
          payload: {
            selectedDateKey,
            activeCategoryId: detailCategory.id,
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
  }, [accessToken, detailCategory, manualPilotageAnalysis, persistenceScope, pilotageAnalysisContextKey, selectedDateKey]);

  const getCategoryColor = useCallback(
    (category) => category?.color || category?.accentColor || category?.hex || category?.themeColor || "#6EE7FF",
    []
  );

  return (
    <ScreenShell
      headerTitle={<span data-tour-id="pilotage-title">Pilotage</span>}
      headerSubtitle="Vue d’ensemble"
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="stack stackGap12">
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
                  <div key={category.id} className="pilotageCategoryStack">
                    <PilotageCategoryRow
                      category={category}
                      color={getCategoryColor(category)}
                      selected={openCategoryId === category.id}
                      onClick={() => togglePilotageCategory(category.id)}
                      summary={summary}
                      statusLabel={STATUS_LABELS[label] || "Active"}
                      statusStyle={STATUS_STYLES[label] || STATUS_STYLES.ACTIVE}
                    >
                      {category.name || "Catégorie"}
                    </PilotageCategoryRow>
                    {openCategoryId === category.id ? (
                      <div
                        className="pilotageInlineDetail"
                        style={getCategoryAccentVars(category)}
                      >
                        <div className="pilotageInlineGrid">
                          <div className="pilotageInlinePanel">
                            <div className="sectionTitle">Structure de la catégorie</div>
                            <div className="col" style={{ gap: 10 }}>
                              {detailCategoryProfileSummary?.subject ? (
                                <StatRow label="Sujet principal" value={detailCategoryProfileSummary.subject} />
                              ) : null}
                              {detailCategoryProfileSummary?.mainGoal ? (
                                <StatRow label="Objectif principal" value={detailCategoryProfileSummary.mainGoal} />
                              ) : null}
                              {detailCategoryProfileSummary?.currentPriority ? (
                                <StatRow label="Priorité actuelle" value={detailCategoryProfileSummary.currentPriority} />
                              ) : null}
                              <StatRow
                                label="Structure"
                                value={
                                  detailCounts
                                    ? `${detailCounts.activeOutcomesCount || 0} ${LABELS.goalsLower} · ${detailCounts.processCount || 0} ${LABELS.actionsLower}`
                                    : "—"
                                }
                              />
                              <StatRow
                                label="Semaine (fait / attendu)"
                                value={detailWeek ? `${detailWeek.done || 0} / ${detailWeek.expected || 0}` : "—"}
                                right={
                                  detailWeek && (detailWeek.missed || 0) > 0 ? (
                                    <GateBadge
                                      className="pilotageStatusBadge"
                                      style={{ ...STATUS_STYLES.EMPTY, borderWidth: 1, borderStyle: "solid" }}
                                    >
                                      {detailWeek.missed} manquée{detailWeek.missed > 1 ? "s" : ""}
                                    </GateBadge>
                                  ) : null
                                }
                              />
                              {!detailCategoryProfileSummary?.hasProfile && !detailCounts?.processCount && !detailCounts?.activeOutcomesCount ? (
                                <div className="pilotageInsightItem">
                                  <div className="small2 textMuted">État actuel</div>
                                  <div>Cette catégorie n’a pas encore assez de structure pour produire une lecture plus fine.</div>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="pilotageInlinePanel" data-tour-id="pilotage-discipline">
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <div>
                                <div className="sectionTitle">Évolution discipline</div>
                                <div className="small2 textMuted">La courbe montre comment cette catégorie avance sur les derniers jours.</div>
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
                                <div className="small2">Niveau actuel</div>
                                <div className="titleSm">
                                  {Number.isFinite(disciplineTrend.summary.currentScore) ? `${disciplineTrend.summary.currentScore}%` : "—"}
                                </div>
                              </div>
                              <div className="listItem GateRowPremium">
                                <div className="small2">Rythme</div>
                                <div className="titleSm">{formatDisciplineTrendLabel(disciplineTrend.summary.trendLabel)}</div>
                              </div>
                              <div className="listItem GateRowPremium">
                                <div className="small2">Jours avec progression</div>
                                <div className="titleSm">{disciplineTrend.summary.scoredDays}</div>
                              </div>
                              <div className="listItem GateRowPremium">
                                <div className="small2">Jours sans attente</div>
                                <div className="titleSm">{disciplineTrend.summary.neutralDays}</div>
                              </div>
                            </div>
                            <DisciplineTrendChart
                              key={disciplineTrendChartKey}
                              trend={disciplineTrend}
                              color={getCategoryColor(detailCategory)}
                              animated
                            />
                          </div>

                          <div className="pilotageInlinePanel">
                            <div className="sectionTitle">Constance locale</div>
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

                          <div className="pilotageInlinePanel">
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <div>
                                <div className="sectionTitle">Lecture de la catégorie</div>
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
                                <Button onClick={handleAnalyzeCategory} disabled={!detailCategory || manualPilotageAnalysis.loading}>
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
                                <div className="small2 textMuted">Point d’attention</div>
                                <div>{coachFallback.problem}</div>
                              </div>
                              <div className="pilotageInsightItem">
                                <div className="small2 textMuted">Prochain pas</div>
                                <div>{coachFallback.recommendation}</div>
                              </div>
                            </div>

                            {persistedPilotageAnalysis ? (
                              <div className="pilotageInlineAiPanel">
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
                                    <div className="small2 textMuted">Point d’attention</div>
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
                              <div className="pilotageInlineAiPanel">
                                <div className="sectionTitle">Analyse indisponible</div>
                                <div className="small2 textMuted">{manualPilotageAnalysis.error}</div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p18 col" style={{ gap: 12 }}>
            <div>
              <div className="sectionTitle">Statistiques globales</div>
              <div className="small2 textMuted">Lecture d’ensemble de l’activité récente avant d’ouvrir une catégorie.</div>
            </div>
            <div className="pilotageTopGrid">
              <div className="listItem GateRowPremium">
                <div className="small2">Niveau global</div>
                <div className="titleSm">{globalPilotageStats.globalScore}%</div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Actions faites / attendues</div>
                <div className="titleSm">
                  {globalPilotageStats.doneCount} / {globalPilotageStats.expectedCount}
                </div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Temps investi réel</div>
                <div className="titleSm">{formatMinutes(globalPilotageStats.realMinutes7)}</div>
              </div>
              <div className="listItem GateRowPremium">
                <div className="small2">Catégories actives</div>
                <div className="titleSm">
                  {globalPilotageStats.activeCategories} / {Math.max(categories.length, 1)}
                </div>
              </div>
            </div>
            <div className="pilotageInsights">
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Lecture globale</div>
                <div>
                  {globalPilotageStats.structuredCategories} catégorie
                  {globalPilotageStats.structuredCategories > 1 ? "s" : ""} ont déjà une base exploitable, avec{" "}
                  {globalPilotageStats.activeDays7} jour{globalPilotageStats.activeDays7 > 1 ? "s" : ""} utile
                  {globalPilotageStats.activeDays7 > 1 ? "s" : ""} sur 7.
                </div>
              </div>
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Points de friction</div>
                <div>
                  {globalPilotageStats.missedCount > 0
                    ? `${globalPilotageStats.missedCount} occurrence${globalPilotageStats.missedCount > 1 ? "s" : ""} manquée${globalPilotageStats.missedCount > 1 ? "s" : ""} sur la fenêtre récente.`
                    : "Aucune occurrence manquée sur la fenêtre récente."}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p18 col" style={{ gap: 12 }}>
            <div>
              <div className="sectionTitle">Synthèse globale</div>
              <div className="small2 textMuted">Lis rapidement où ton système avance vraiment.</div>
            </div>
            <div className="pilotageInsights">
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Vue d’ensemble</div>
                <div>{globalPilotageSummary.summary}</div>
              </div>
              {globalPilotageSummary.signals.map((signal) => (
                <div key={signal} className="pilotageInsightItem">
                  <div className="small2 textMuted">Signal principal</div>
                  <div>{signal}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

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
      </div>
    </ScreenShell>
  );
}
