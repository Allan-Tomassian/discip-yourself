import React, { useCallback, useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { GateBadge, GateButton, GateSection } from "../shared/ui/gate/Gate";
import SelectControl from "../ui/select/Select";
import { useAuth } from "../auth/useAuth";
import { requestAiCoachChat } from "../infra/aiCoachChatClient";
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
import { computeCategoryRadarRows, computePilotageInsights } from "../features/pilotage/radarModel";
import { sanitizePilotageRadarSelection } from "../logic/state/normalizers";
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

const PILOTAGE_RADAR_STORAGE_KEY = "pilotageRadarSelection";

const arrayEqual = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((id, idx) => id === b[idx]);

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

function formatMinutes(value) {
  if (!Number.isFinite(value)) return "0 min";
  return `${Math.max(0, Math.round(value))} min`;
}

function normalizeRadarSelection(selection, availableIds, fallbackIds) {
  const available = Array.isArray(availableIds) ? availableIds.filter(Boolean) : [];
  if (!available.length) return [];
  const allowed = new Set(available);
  const out = [];
  const pushIfValid = (id) => {
    if (typeof id !== "string" || !allowed.has(id)) return;
    if (out.includes(id)) return;
    out.push(id);
  };
  (Array.isArray(selection) ? selection : []).forEach(pushIfValid);
  (Array.isArray(fallbackIds) ? fallbackIds : []).forEach(pushIfValid);
  available.forEach(pushIfValid);
  return out.slice(0, Math.min(3, available.length));
}

function loadRadarSelectionFromStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PILOTAGE_RADAR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
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

function buildPilotageCoachFallback({ selectedCategory, selectedCounts, selectedWeek, constanceSummary }) {
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
      recommendation: "Ajoute 1 action simple et planifiable cette semaine.",
    };
  }

  if ((selectedWeek?.expected || 0) === 0) {
    return {
      summary: `Aucun rythme visible en ${selectedCategory.name || "catégorie"}.`,
      problem: "La semaine n’a aucun créneau crédible pour cette catégorie.",
      recommendation: "Planifie 1 bloc court récurrent pour relancer la continuité.",
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
  generationWindowDays = null,
  isPlanningUnlimited = false,
}) {
  void generationWindowDays;
  void isPlanningUnlimited;
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const allCategories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const occurrences = useMemo(() => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []), [safeData.occurrences]);
  const legacyBuckets = useMemo(
    () => collectSystemInboxBuckets({ goals: safeData.goals, categories: safeData.categories }),
    [safeData.categories, safeData.goals]
  );

  const now = useMemo(() => new Date(), []);
  const weekBounds = useMemo(() => getWindowBounds("7d", now), [now]);
  const twoWeekBounds = useMemo(() => getWindowBounds("14d", now), [now]);
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

  const radarWindow = twoWeekBounds;
  const categoryRadarRows = useMemo(
    () => computeCategoryRadarRows(safeData, radarWindow.fromKey, radarWindow.toKey),
    [radarWindow.fromKey, radarWindow.toKey, safeData]
  );
  const availableRadarIds = useMemo(
    () => categoryRadarRows.map((row) => row.categoryId).filter(Boolean),
    [categoryRadarRows]
  );
  const sanitizeRadarSelection = useCallback(
    (selection) =>
      sanitizePilotageRadarSelection(
        { categories: allCategories, ui: { pilotageRadarSelection: selection } },
        { selection, categories: allCategories }
      ),
    [allCategories]
  );
  const defaultRadarSelection = useMemo(() => {
    const seed = categoryRadarRows.slice(0, 3).map((row) => row.categoryId);
    return normalizeRadarSelection(seed, availableRadarIds, availableRadarIds);
  }, [availableRadarIds, categoryRadarRows]);
  const uiRadarSelection = useMemo(
    () => sanitizeRadarSelection(safeData?.ui?.pilotageRadarSelection),
    [safeData?.ui?.pilotageRadarSelection, sanitizeRadarSelection]
  );
  const persistedRadarSelection = useMemo(() => {
    const source = uiRadarSelection.length ? uiRadarSelection : loadRadarSelectionFromStorage();
    return sanitizeRadarSelection(source);
  }, [sanitizeRadarSelection, uiRadarSelection]);
  const [radarSelection, setRadarSelection] = useState(
    normalizeRadarSelection(
      persistedRadarSelection.length ? persistedRadarSelection : defaultRadarSelection,
      availableRadarIds,
      defaultRadarSelection
    )
  );

  useEffect(() => {
    setRadarSelection((previous) => {
      const normalized = sanitizeRadarSelection(
        normalizeRadarSelection(previous, availableRadarIds, defaultRadarSelection)
      );
      return arrayEqual(previous, normalized) ? previous : normalized;
    });
  }, [availableRadarIds, defaultRadarSelection, sanitizeRadarSelection]);

  useEffect(() => {
    if (typeof setData !== "function") return;
    const normalized = sanitizeRadarSelection(
      normalizeRadarSelection(radarSelection, availableRadarIds, defaultRadarSelection)
    );
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PILOTAGE_RADAR_STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // noop
      }
    }
    const current = sanitizeRadarSelection(
      normalizeRadarSelection(
        uiRadarSelection.length ? uiRadarSelection : defaultRadarSelection,
        availableRadarIds,
        defaultRadarSelection
      )
    );
    if (arrayEqual(normalized, current)) return;
    setData((previous) => {
      const prevUi = previous?.ui && typeof previous.ui === "object" ? previous.ui : {};
      const prevSelection = Array.isArray(prevUi.pilotageRadarSelection) ? prevUi.pilotageRadarSelection : [];
      if (arrayEqual(prevSelection, normalized)) return previous;
      return {
        ...previous,
        ui: {
          ...prevUi,
          pilotageRadarSelection: normalized,
        },
      };
    });
  }, [
    availableRadarIds,
    defaultRadarSelection,
    radarSelection,
    sanitizeRadarSelection,
    setData,
    uiRadarSelection,
  ]);

  const safeRadarSelection = useMemo(
    () => sanitizeRadarSelection(radarSelection),
    [radarSelection, sanitizeRadarSelection]
  );
  const radarVisibleRows = useMemo(
    () =>
      safeRadarSelection
        .map((id) => categoryRadarRows.find((row) => row.categoryId === id))
        .filter(Boolean)
        .slice(0, 3),
    [categoryRadarRows, safeRadarSelection]
  );
  const insights = useMemo(
    () => computePilotageInsights(safeData, radarWindow.fromKey, radarWindow.toKey),
    [radarWindow.fromKey, radarWindow.toKey, safeData]
  );

  const handleRadarSelect = useCallback(
    (slotIndex, nextId) => {
      if (!availableRadarIds.includes(nextId)) return;
      setRadarSelection((previous) => {
        const next = Array.isArray(previous) ? [...previous] : [];
        const existingIndex = next.findIndex((id) => id === nextId);
        if (existingIndex >= 0 && existingIndex !== slotIndex) {
          next[existingIndex] = next[slotIndex];
        }
        next[slotIndex] = nextId;
        return sanitizeRadarSelection(
          normalizeRadarSelection(next, availableRadarIds, defaultRadarSelection)
        );
      });
    },
    [availableRadarIds, defaultRadarSelection, sanitizeRadarSelection]
  );

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

  const [analysisState, setAnalysisState] = useState({
    loading: false,
    summary: "",
    problem: "",
    recommendation: "",
    source: "fallback",
  });
  const coachFallback = useMemo(
    () =>
      buildPilotageCoachFallback({
        selectedCategory,
        selectedCounts,
        selectedWeek,
        constanceSummary,
      }),
    [constanceSummary, selectedCategory, selectedCounts, selectedWeek]
  );

  useEffect(() => {
    setAnalysisState({
      loading: false,
      summary: coachFallback.summary,
      problem: coachFallback.problem,
      recommendation: coachFallback.recommendation,
      source: "fallback",
    });
  }, [coachFallback]);

  const handleAnalyzeCategory = useCallback(async () => {
    if (!selectedCategory) return;
    setAnalysisState((previous) => ({
      ...previous,
      loading: true,
    }));
    if (!accessToken) {
      setAnalysisState({
        loading: false,
        summary: coachFallback.summary,
        problem: coachFallback.problem,
        recommendation: coachFallback.recommendation,
        source: "fallback",
      });
      return;
    }
    const result = await requestAiCoachChat({
      accessToken,
      payload: {
        selectedDateKey,
        activeCategoryId: selectedCategory.id,
        message: "Analyse cette catégorie et donne un résumé court, un problème majeur et une recommandation concrète.",
        recentMessages: [],
      },
    });
    if (result.ok && result.reply) {
      const recommendationBits = [
        result.reply.primaryAction?.label || "",
        Number.isFinite(result.reply.suggestedDurationMin) ? `${result.reply.suggestedDurationMin} min` : "",
      ].filter(Boolean);
      setAnalysisState({
        loading: false,
        summary: result.reply.headline || coachFallback.summary,
        problem: result.reply.reason || coachFallback.problem,
        recommendation: recommendationBits.join(" • ") || coachFallback.recommendation,
        source: "ai",
      });
      return;
    }
    setAnalysisState({
      loading: false,
      summary: coachFallback.summary,
      problem: coachFallback.problem,
      recommendation: coachFallback.recommendation,
      source: "fallback",
    });
  }, [accessToken, coachFallback.problem, coachFallback.recommendation, coachFallback.summary, selectedCategory, selectedDateKey]);

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
                <div className="sectionTitle">Analyse IA manuelle</div>
                <div className="small2 textMuted">Une demande explicite, pas d’analyse automatique.</div>
              </div>
              <Button onClick={handleAnalyzeCategory} disabled={!selectedCategory || analysisState.loading}>
                {analysisState.loading ? "Analyse..." : "Analyser cette catégorie"}
              </Button>
            </div>
            <div className="pilotageInsights">
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Résumé</div>
                <div>{analysisState.summary}</div>
              </div>
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Problème majeur</div>
                <div>{analysisState.problem}</div>
              </div>
              <div className="pilotageInsightItem">
                <div className="small2 textMuted">Recommandation</div>
                <div>{analysisState.recommendation}</div>
              </div>
            </div>
            <div className="small2 textMuted">
              {analysisState.source === "ai" ? "Réponse IA active." : "Fallback local actif."}
            </div>
          </div>
        </Card>

        <Card data-tour-id="pilotage-discipline">
          <div className="p18 col" style={{ gap: 12 }}>
            <div>
              <div className="sectionTitle">Radar secondaire</div>
              <div className="small2 textMuted">Comparaison optionnelle pour repérer les écarts.</div>
            </div>

            <details className="pilotageDetails" open>
              <summary>Afficher le radar et les comparaisons</summary>
              <div className="pilotageDetailsBody">
                <div className="pilotageRadarGrid">
                  <div className="pilotageRadarPanel">
                    <div className="pilotageRadarSvg">
                      {radarVisibleRows.length ? (
                        <svg viewBox="0 0 240 240" role="img" aria-label="Radar pilotage">
                          <circle cx="120" cy="120" r="96" className="pilotageRadarGridLine" />
                          <circle cx="120" cy="120" r="64" className="pilotageRadarGridLine" />
                          <circle cx="120" cy="120" r="32" className="pilotageRadarGridLine" />
                          {["Discipline", "Régularité", "Charge", "Focus"].map((label, index) => {
                            const angle = (Math.PI * 2 * index) / 4 - Math.PI / 2;
                            const x = 120 + Math.cos(angle) * 110;
                            const y = 120 + Math.sin(angle) * 110;
                            return (
                              <g key={label}>
                                <line x1="120" y1="120" x2={x} y2={y} className="pilotageRadarAxis" />
                                <text x={x} y={y} className="pilotageRadarLabel">
                                  {label}
                                </text>
                              </g>
                            );
                          })}
                          {radarVisibleRows.map((row) => {
                            const points = row.values
                              .map((axis, index) => {
                                const angle = (Math.PI * 2 * index) / 4 - Math.PI / 2;
                                const radius = 96 * clamp01(axis.value || 0);
                                const x = 120 + Math.cos(angle) * radius;
                                const y = 120 + Math.sin(angle) * radius;
                                return `${x},${y}`;
                              })
                              .join(" ");
                            return (
                              <polygon
                                key={row.categoryId}
                                points={points}
                                fill={row.color}
                                fillOpacity="0.18"
                                stroke={row.color}
                                strokeWidth="2"
                              />
                            );
                          })}
                        </svg>
                      ) : (
                        <div className="small2 textMuted">Aucune donnée récente.</div>
                      )}
                    </div>
                    <div className="pilotageRadarLegend">
                      {radarVisibleRows.map((row) => (
                        <div key={row.categoryId} className="pilotageLegendRow">
                          <span className="pilotageLegendDot" style={{ background: row.color }} />
                          <span className="small2">{row.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pilotageRadarPanel">
                    <div className="sectionTitle">Catégories visibles</div>
                    <div className="pilotageRadarSelects">
                      {radarSelection.slice(0, 3).map((id, slotIndex) => (
                        <Select
                          key={`radar-slot-${slotIndex}`}
                          value={id || ""}
                          onChange={(event) => handleRadarSelect(slotIndex, event.target.value)}
                        >
                          {categoryRadarRows.map((row) => (
                            <option key={row.categoryId} value={row.categoryId}>
                              {row.label}
                            </option>
                          ))}
                        </Select>
                      ))}
                    </div>
                    <div className="small2 textMuted">
                      Discipline = fait / attendu, régularité = jours actifs, charge = pression du volume, focus = concentration sur quelques actions.
                    </div>
                  </div>
                </div>

                <div className="pilotageInsights">
                  <div className="pilotageInsightItem">{insights.topCategory}</div>
                  <div className="pilotageInsightItem">{insights.missedAction}</div>
                  <div className="pilotageInsightItem">{insights.bestSlot}</div>
                </div>
              </div>
            </details>
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
