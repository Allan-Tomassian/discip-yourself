import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeLibraryFocusTarget } from "../app/coachCreatedViewTarget";
import { resolveGoalType } from "../domain/goalType";
import { getVisibleCategories } from "../domain/categoryVisibility";
import {
  deriveExecutionStatusForOccurrence,
  EXECUTION_SURFACE_STATUS,
} from "../logic/executionStatus";
import {
  buildObjectiveProgressModel,
  OBJECTIVE_PROGRESS_SOURCE,
} from "../features/objectives/objectiveProgressModel";
import { AppScreen, CompactCategoryFilter } from "../shared/ui/app";
import {
  CommandBadge,
  CommandCard,
  CommandCTA,
  CommandEmptyState,
  CommandSectionHeader,
  CommandSurface,
} from "../shared/ui/command";
import { OBJECTIVES_SCREEN_COPY } from "../ui/labels";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/datetime";
import "../features/objectives/objectives.css";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round((Number.isFinite(value) ? value : 0) * 100)));
}

const PROGRESS_SOURCE_LABELS = Object.freeze({
  [OBJECTIVE_PROGRESS_SOURCE.EXECUTION]: "Progression d’exécution",
  [OBJECTIVE_PROGRESS_SOURCE.MANUAL]: "Progression manuelle",
  [OBJECTIVE_PROGRESS_SOURCE.NONE]: "Point de départ",
});

function formatSubtitle(goal) {
  const notes = typeof goal?.notes === "string" ? goal.notes.trim() : "";
  if (notes) return notes;
  if (goal?.deadline) return `${OBJECTIVES_SCREEN_COPY.deadlinePrefix} : ${goal.deadline}`;
  return OBJECTIVES_SCREEN_COPY.fallbackSubtitle;
}

function getStandaloneProgressSummary(items) {
  const completedCount = items.reduce((sum, item) => sum + (item.completedCount || 0), 0);
  const expectedCount = items.reduce((sum, item) => sum + (item.expectedCount || 0), 0);
  const frictionCount = items.reduce((sum, item) => sum + (item.frictionCount || 0), 0);
  const executionItems = items.filter((item) => item.source === OBJECTIVE_PROGRESS_SOURCE.EXECUTION);
  if (executionItems.length) {
    return {
      progress: expectedCount ? completedCount / expectedCount : 0,
      source: OBJECTIVE_PROGRESS_SOURCE.EXECUTION,
      sourceLabel: frictionCount ? "Friction détectée" : PROGRESS_SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.EXECUTION],
      progressLabel: PROGRESS_SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.EXECUTION],
      evidenceLabel: expectedCount ? `${completedCount}/${expectedCount} blocs validés` : "Aucun bloc validé",
      frictionCount,
      status: frictionCount
        ? { key: "execution_friction", label: "Friction détectée", tone: "attention" }
        : { key: "active", label: "Actif", tone: "execution" },
    };
  }

  const manualItems = items.filter((item) => item.source === OBJECTIVE_PROGRESS_SOURCE.MANUAL);
  if (manualItems.length) {
    const progress = manualItems.reduce((sum, item) => sum + (item.displayProgress || 0), 0) / manualItems.length;
    return {
      progress,
      source: OBJECTIVE_PROGRESS_SOURCE.MANUAL,
      sourceLabel: PROGRESS_SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.MANUAL],
      progressLabel: PROGRESS_SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.MANUAL],
      evidenceLabel: "Progression saisie manuellement",
      frictionCount,
      status: { key: "active", label: "Actif", tone: "execution" },
    };
  }

  return {
    progress: 0,
    source: OBJECTIVE_PROGRESS_SOURCE.NONE,
    sourceLabel: "Point de départ",
    progressLabel: PROGRESS_SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.NONE],
    evidenceLabel: "Aucun bloc exécuté dans la fenêtre.",
    frictionCount,
    status: { key: "needs_structure", label: "À structurer", tone: "attention" },
  };
}

function groupStandaloneActions(actionModels, categoriesById) {
  const groups = new Map();
  for (const actionModel of actionModels) {
    const categoryId = actionModel?.action?.categoryId || "standalone";
    if (!groups.has(categoryId)) groups.set(categoryId, []);
    groups.get(categoryId).push(actionModel);
  }
  return Array.from(groups.entries()).map(([categoryId, items]) => {
    const category = categoriesById.get(categoryId) || null;
    const summary = getStandaloneProgressSummary(items);
    return {
      id: `standalone:${categoryId}`,
      type: "standalone",
      title: category?.name ? `${category.name} ${OBJECTIVES_SCREEN_COPY.standaloneSuffix}` : OBJECTIVES_SCREEN_COPY.standaloneTitle,
      subtitle: OBJECTIVES_SCREEN_COPY.standaloneSubtitle,
      category,
      progress: summary.progress,
      actions: items.map((item) => item.action).filter(Boolean),
      source: summary.source,
      sourceLabel: summary.sourceLabel,
      progressLabel: summary.progressLabel,
      evidenceLabel: summary.evidenceLabel,
      frictionCount: summary.frictionCount,
      status: summary.status,
    };
  });
}

function compareOccurrences(left, right) {
  const leftDate = String(left?.date || "");
  const rightDate = String(right?.date || "");
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
  const leftStart = String(left?.start || left?.slotKey || "");
  const rightStart = String(right?.start || right?.slotKey || "");
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function formatOccurrenceMeta(dateKey) {
  if (!dateKey) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(new Date(`${dateKey}T12:00:00`));
  } catch {
    return dateKey;
  }
}

function resolveOccurrenceItemState(occurrence, sessionHistory = []) {
  const dateKey = normalizeLocalDateKey(occurrence?.date) || "";
  const derived = deriveExecutionStatusForOccurrence(occurrence, {
    sessionHistory,
    dateKey,
  });
  if (derived.status === EXECUTION_SURFACE_STATUS.DONE) {
    return { isDone: true, tone: "execution", statusLabel: "Validé" };
  }
  if (derived.status === EXECUTION_SURFACE_STATUS.MISSED) {
    return { isDone: false, tone: "attention", statusLabel: "Manqué" };
  }
  if (derived.status === EXECUTION_SURFACE_STATUS.BLOCKED) {
    return { isDone: false, tone: "attention", statusLabel: "Bloqué" };
  }
  if (derived.status === EXECUTION_SURFACE_STATUS.REPORTED) {
    return { isDone: false, tone: "attention", statusLabel: "Signalé" };
  }
  if (derived.status === EXECUTION_SURFACE_STATUS.POSTPONED) {
    return { isDone: false, tone: "attention", statusLabel: "Reporté" };
  }
  if (derived.status === EXECUTION_SURFACE_STATUS.ACTIVE) {
    return { isDone: false, tone: "execution", statusLabel: "En cours" };
  }
  return { isDone: false, tone: "neutral", statusLabel: "" };
}

function buildObjectiveSections({ actions = [], actionProgressById, occurrencesByGoalId, sessionHistory, todayKey }) {
  const activeItems = actions
    .map((action) => {
      const progress = actionProgressById?.get(action.id) || null;
      const hasEvidence = progress?.hasExecutionData || progress?.hasManualProgress || progress?.frictionCount > 0;
      return {
        id: `active:${action.id}`,
        title: action.title || OBJECTIVES_SCREEN_COPY.untitledAction,
        meta: hasEvidence ? progress.labels?.evidence || "" : "",
        isDone: action.status === "done" || progress?.status?.key === "completed",
        tone: progress?.frictionCount > 0 ? "attention" : "neutral",
        statusLabel: progress?.frictionCount > 0 ? "Friction" : "",
        goal: action,
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title));

  const todayItems = [];
  const upcomingItems = [];

  for (const action of actions) {
    const occurrences = [...(occurrencesByGoalId.get(action.id) || [])].sort(compareOccurrences);
    for (const occurrence of occurrences) {
      const dateKey = normalizeLocalDateKey(occurrence?.date) || "";
      if (!dateKey) continue;
      const state = resolveOccurrenceItemState(occurrence, sessionHistory);
      const item = {
        id: `occurrence:${occurrence.id}`,
        title: action.title || OBJECTIVES_SCREEN_COPY.untitledAction,
        meta: dateKey === todayKey ? "" : formatOccurrenceMeta(dateKey),
        isDone: state.isDone,
        tone: state.tone,
        statusLabel: state.statusLabel,
        goal: action,
        occurrence,
      };
      if (dateKey === todayKey) {
        todayItems.push(item);
      } else if (dateKey > todayKey) {
        upcomingItems.push(item);
      }
    }
  }

  return [
    {
      key: "active",
      label: OBJECTIVES_SCREEN_COPY.activeActions,
      emptyLabel: OBJECTIVES_SCREEN_COPY.noActiveActions,
      items: activeItems,
    },
    {
      key: "today",
      label: OBJECTIVES_SCREEN_COPY.todayActions,
      emptyLabel: OBJECTIVES_SCREEN_COPY.noTodayActions,
      items: todayItems.slice(0, 4),
    },
    {
      key: "upcoming",
      label: OBJECTIVES_SCREEN_COPY.upcomingActions,
      emptyLabel: OBJECTIVES_SCREEN_COPY.noUpcomingActions,
      items: upcomingItems
        .sort((left, right) => compareOccurrences(left.occurrence, right.occurrence))
        .slice(0, 4),
    },
  ];
}

function openObjectiveActionEditor(action, onEditItem) {
  onEditItem?.({ id: action.id, type: "PROCESS", categoryId: action.categoryId || null });
}

function escapeSelectorValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeStatusKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveObjectiveStatus(goal, progress = 0) {
  const status = normalizeStatusKey(goal?.status || goal?.state || goal?.lifecycleStatus);
  if (["failed", "failure", "abandoned", "echec", "echoue"].includes(status)) {
    return { key: "failed", label: "Échoué", tone: "critical" };
  }
  if (["paused", "pause", "suspended", "on_hold", "hold", "en_pause"].includes(status)) {
    return { key: "paused", label: "En pause", tone: "attention" };
  }
  if (["completed", "complete", "done", "finished", "termine", "terminee"].includes(status) || progress >= 1) {
    return { key: "completed", label: "Terminé", tone: "execution" };
  }
  return { key: "active", label: "Actif", tone: "execution" };
}

function resolveActionTone(item, todayKey) {
  if (item?.tone) return item.tone;
  if (item?.isDone) return "execution";
  const dateKey = normalizeLocalDateKey(item?.occurrence?.date) || "";
  if (dateKey && dateKey < todayKey) return "attention";
  return "neutral";
}

function buildObjectiveCategoryOptions({ categories, cards, occurrencesByGoalId, todayKey }) {
  const stableOrder = new Map(categories.map((category, index) => [category.id, index]));

  return categories
    .map((category) => {
      const categoryCards = cards.filter((card) => card.category?.id === category.id);
      let nearbyItems = 0;
      let latestDateKey = "";

      for (const card of categoryCards) {
        const sections = buildObjectiveSections({
          actions: Array.isArray(card.actions) ? card.actions : [],
          occurrencesByGoalId,
          todayKey,
        });
        nearbyItems += sections.reduce((sum, section) => sum + section.items.length, 0);

        for (const action of Array.isArray(card.actions) ? card.actions : []) {
          const occurrences = occurrencesByGoalId.get(action.id) || [];
          for (const occurrence of occurrences) {
            const dateKey = normalizeLocalDateKey(occurrence?.date) || "";
            if (dateKey && dateKey > latestDateKey) latestDateKey = dateKey;
          }
        }
      }

      return {
        id: category.id,
        label: category.name,
        cardCount: categoryCards.length,
        nearbyItems,
        latestDateKey,
        stableIndex: stableOrder.get(category.id) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((left, right) => {
      if (right.cardCount !== left.cardCount) return right.cardCount - left.cardCount;
      if (right.nearbyItems !== left.nearbyItems) return right.nearbyItems - left.nearbyItems;
      if (left.latestDateKey !== right.latestDateKey) return String(right.latestDateKey).localeCompare(String(left.latestDateKey));
      return left.stableIndex - right.stableIndex;
    })
    .map(({ id, label }) => ({ id, label }));
}

export default function Objectives({
  data,
  setData,
  onOpenCreateMenu,
  onOpenCreateAction,
  onEditItem,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const todayKey = useMemo(() => todayLocalKey(), []);
  const outcomes = useMemo(
    () =>
      goals.filter((goal) => {
        if (resolveGoalType(goal) !== "OUTCOME") return false;
        return categoriesById.has(goal?.categoryId || "");
      }),
    [categoriesById, goals]
  );
  const processGoals = useMemo(
    () =>
      goals.filter((goal) => {
        if (resolveGoalType(goal) !== "PROCESS") return false;
        return categoriesById.has(goal?.categoryId || "");
      }),
    [categoriesById, goals]
  );
  const sessionHistory = useMemo(
    () => (Array.isArray(safeData.sessionHistory) ? safeData.sessionHistory : []),
    [safeData.sessionHistory]
  );
  const progressModel = useMemo(
    () =>
      buildObjectiveProgressModel({
        goals,
        occurrences: safeData.occurrences,
        sessionHistory,
        categories,
        dateKey: todayKey,
      }),
    [categories, goals, safeData.occurrences, sessionHistory, todayKey]
  );
  const occurrencesByGoalId = useMemo(() => {
    const map = new Map();
    for (const occurrence of Array.isArray(safeData.occurrences) ? safeData.occurrences : []) {
      if (!occurrence?.goalId || occurrence.status === "canceled" || occurrence.status === "skipped") continue;
      if (!map.has(occurrence.goalId)) map.set(occurrence.goalId, []);
      map.get(occurrence.goalId).push(occurrence);
    }
    return map;
  }, [safeData.occurrences]);

  const cards = useMemo(() => {
    const outcomeCards = outcomes.map((outcome) => {
      const category = categoriesById.get(outcome.categoryId || "") || null;
      const progress = progressModel.byObjectiveId.get(outcome.id) || null;
      const linked = (progress?.linkedActions || []).map((actionModel) => actionModel.action).filter(Boolean);
      return {
        id: outcome.id,
        type: "outcome",
        title: outcome.title || OBJECTIVES_SCREEN_COPY.untitledObjective,
        subtitle: formatSubtitle(outcome, category),
        category,
        progress: progress?.displayProgress || 0,
        source: progress?.source || OBJECTIVE_PROGRESS_SOURCE.NONE,
        sourceLabel: progress?.labels?.source || PROGRESS_SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.NONE],
        progressLabel: progress?.labels?.progress || PROGRESS_SOURCE_LABELS[OBJECTIVE_PROGRESS_SOURCE.NONE],
        evidenceLabel: progress?.labels?.evidence || "",
        frictionCount: progress?.frictionCount || 0,
        status: progress?.status || resolveObjectiveStatus(outcome, 0),
        actions: linked,
        outcome,
      };
    });
    const fallbackCards = groupStandaloneActions(progressModel.standaloneActions, categoriesById);
    return [...outcomeCards, ...fallbackCards].sort((left, right) => {
      return (right.progress || 0) - (left.progress || 0);
    });
  }, [categoriesById, outcomes, progressModel]);

  const [expandedCards, setExpandedCards] = useState({});
  const [categoryFilterId, setCategoryFilterId] = useState("all");
  const focusTarget = normalizeLibraryFocusTarget(safeData?.ui?.libraryFocusTarget);
  const focusTargetRef = useRef("");

  const filteredCards = useMemo(() => {
    if (categoryFilterId === "all") return cards;
    return cards.filter((card) => card.category?.id === categoryFilterId);
  }, [cards, categoryFilterId]);
  const categoryOptions = useMemo(
    () => buildObjectiveCategoryOptions({ categories, cards, occurrencesByGoalId, todayKey }),
    [cards, categories, occurrencesByGoalId, todayKey]
  );
  const overviewMetrics = useMemo(() => {
    const outcomeIds = new Set(outcomes.map((outcome) => outcome.id).filter(Boolean));
    const activeObjectives = outcomes.filter((outcome) => {
      const progress = progressModel.byObjectiveId.get(outcome.id) || null;
      return (progress?.status?.key || "active") === "active";
    }).length;
    const executableObjectives = outcomes
      .map((outcome) => progressModel.byObjectiveId.get(outcome.id) || null)
      .filter((progress) => progress?.source === OBJECTIVE_PROGRESS_SOURCE.EXECUTION);
    const averageProgress = executableObjectives.length
      ? Math.round(
          executableObjectives.reduce((sum, progress) => sum + clampPercent(progress.displayProgress || 0), 0) /
            executableObjectives.length
        )
      : 0;
    const linkedActionCount = processGoals.filter((goal) => {
      const progress = progressModel.byActionId.get(goal.id) || null;
      return Boolean(progress?.outcomeId && outcomeIds.has(progress.outcomeId));
    }).length;

    return {
      activeObjectives,
      averageProgress,
      hasExecutionAverage: executableObjectives.length > 0,
      linkedActionCount,
    };
  }, [outcomes, processGoals, progressModel]);

  const openCreateMenuFrom = (event) => {
    if (typeof onOpenCreateMenu !== "function") return;
    onOpenCreateMenu({
      source: "objectives",
      anchorEl: event.currentTarget,
      anchorRect: event.currentTarget.getBoundingClientRect(),
    });
  };

  useEffect(() => {
    const firstActionId = focusTarget?.actionIds?.[0] || null;
    const action = firstActionId ? processGoals.find((goal) => goal?.id === firstActionId) || null : null;
    const targetCardId =
      focusTarget?.outcomeId ||
      action?.parentId ||
      action?.outcomeId ||
      action?.primaryGoalId ||
      (focusTarget?.categoryId ? `standalone:${focusTarget.categoryId}` : action?.categoryId ? `standalone:${action.categoryId}` : "");
    if (!targetCardId) return;
    setExpandedCards((previous) => ({ ...previous, [targetCardId]: true }));
  }, [focusTarget?.actionIds, focusTarget?.categoryId, focusTarget?.outcomeId, processGoals]);

  useEffect(() => {
    const signature = JSON.stringify(focusTarget || null);
    if (!signature || signature === focusTargetRef.current) return;
    focusTargetRef.current = signature;
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const frameId = window.requestAnimationFrame(() => {
      const rowId = focusTarget?.actionIds?.[0] || focusTarget?.outcomeId || "";
      const selector = focusTarget?.actionIds?.length
        ? `[data-objective-row="${escapeSelectorValue(rowId)}"]`
        : `[data-objective-card="${escapeSelectorValue(rowId)}"]`;
      const node = document.querySelector(selector);
      if (!node || typeof node.scrollIntoView !== "function") return;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.classList.add("lovableHighlight");
      window.setTimeout(() => node.classList.remove("lovableHighlight"), 1400);
    });

    if (typeof setData === "function" && focusTarget) {
      setData((previous) => ({
        ...previous,
        ui: {
          ...(previous?.ui || {}),
          libraryFocusTarget: null,
        },
      }));
    }

    return () => window.cancelAnimationFrame(frameId);
  }, [focusTarget, setData]);

  return (
    <AppScreen
      pageId="objectives"
      headerTitle={OBJECTIVES_SCREEN_COPY.title}
      headerRight={
        typeof onOpenCreateMenu === "function" ? (
          <CommandCTA
            variant="secondary"
            tone="execution"
            className="lovableObjectivesCreate"
            data-testid="objectives-universal-capture-button"
            aria-label={OBJECTIVES_SCREEN_COPY.createAriaLabel}
            onClick={openCreateMenuFrom}
          >
            +
          </CommandCTA>
        ) : null
      }
    >
      <div className="objectivesCommandPage">
        <CommandSurface tone="execution" className="objectivesOverviewCommand objectivesHeroCommand">
          <CommandSectionHeader
            label="OBJECTIFS"
            title="Structure. Direction. Impact."
            tone="execution"
          />
        </CommandSurface>

        <p className="objectivesCommandIntent">
          Tes objectifs donnent le cap. Chaque action exécutée renforce ton système.
        </p>

        <CommandSurface
          tone="execution"
          density="compact"
          className="objectivesStatsStrip"
          aria-label="Vue d'ensemble des objectifs"
        >
          <div className="objectivesOverviewMetrics" aria-label="Vue d'ensemble des objectifs">
            <div className="objectivesMetric">
              <span className="objectivesMetricValue">{overviewMetrics.activeObjectives}</span>
              <span className="objectivesMetricLabel">Objectifs actifs</span>
            </div>
            <div className="objectivesMetric">
              <span className="objectivesMetricValue">
                {overviewMetrics.hasExecutionAverage ? `${overviewMetrics.averageProgress}%` : "--"}
              </span>
              <span className="objectivesMetricLabel">Progression d’exécution</span>
            </div>
            <div className="objectivesMetric">
              <span className="objectivesMetricValue">{overviewMetrics.linkedActionCount}</span>
              <span className="objectivesMetricLabel">Actions liées</span>
            </div>
          </div>
        </CommandSurface>

        {categories.length ? (
          <div className="objectivesFilterWrap">
            <CompactCategoryFilter
              label={OBJECTIVES_SCREEN_COPY.categoryFilterLabel}
              options={categoryOptions}
              value={categoryFilterId}
              onChange={setCategoryFilterId}
              allLabel={OBJECTIVES_SCREEN_COPY.allCategories}
            />
          </div>
        ) : null}

        {filteredCards.length ? (
          <div className="objectivesCommandList">
            {filteredCards.map((card) => {
              const expanded = Boolean(expandedCards[card.id]);
              const color = resolveCategoryColor(card.category, "#30f273");
              const progressPercent = clampPercent(card.progress);
              const status = card.status || resolveObjectiveStatus(card.outcome, card.progress);
              return (
                <CommandCard
                  key={card.id}
                  as="article"
                  tone={status.tone}
                  className="objectivesCommandCard"
                  data-objective-card={card.id}
                  style={{ "--objectives-category-accent": color }}
                >
                  <button
                    type="button"
                    className="objectivesCardHeader"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedCards((previous) => ({ ...previous, [card.id]: !expanded }))
                    }
                  >
                    <span className="objectivesCategoryMarker" aria-hidden="true" />
                    <span className="objectivesCardContent">
                      {card.category?.name ? (
                        <span className="objectivesCardCategory">{card.category.name}</span>
                      ) : null}
                      <span className="objectivesCardTitle">{card.title}</span>
                      <span className="objectivesCardSubtitle">{card.subtitle}</span>
                      <span className="objectivesProgressTrack" aria-hidden="true">
                        <span
                          className="objectivesProgressValue"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </span>
                      <span className="objectivesProgressSource">{card.sourceLabel}</span>
                      {card.evidenceLabel ? (
                        <span className="objectivesEvidenceText">{card.evidenceLabel}</span>
                      ) : null}
                    </span>
                    <span className="objectivesCardMeta">
                      <CommandBadge tone={status.tone} className="objectivesStatusBadge">
                        {status.label}
                      </CommandBadge>
                      <span className="objectivesProgressText">{progressPercent}%</span>
                      <span className="objectivesCardChevron" aria-hidden="true">
                        {expanded ? "⌃" : "⌄"}
                      </span>
                    </span>
                  </button>
                  {expanded ? (
                    <div className="objectivesCardBody">
                      <div className="objectivesDetailPanel">
                        <div>
                          <div className="objectivesDetailLabel">Vision</div>
                          <p className="objectivesDetailText">{card.subtitle}</p>
                        </div>
                        <div className="objectivesDetailProgress" aria-label={`Progression ${progressPercent}%`}>
                          <span>{progressPercent}%</span>
                          <span className="objectivesProgressSource">{card.progressLabel}</span>
                          {card.frictionCount > 0 ? (
                            <span className="objectivesFrictionText">
                              {card.frictionCount} friction{card.frictionCount > 1 ? "s" : ""}
                            </span>
                          ) : null}
                          <div className="objectivesProgressTrack">
                            <div
                              className="objectivesProgressValue"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="objectivesActionSections">
                        {buildObjectiveSections({
                          actions: card.actions,
                          actionProgressById: progressModel.byActionId,
                          occurrencesByGoalId,
                          sessionHistory,
                          todayKey,
                        }).map((section) => (
                          <div key={`${card.id}:${section.key}`} className="objectivesActionSection">
                            <div className="objectivesActionSectionTitle">{section.label}</div>
                            <div className="objectivesActionRows">
                              {section.items.length ? (
                                section.items.map((item) => {
                                  const actionTone = resolveActionTone(item, todayKey);
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      className="objectivesActionRow"
                                      data-command-tone={actionTone}
                                      data-objective-row={item.goal?.id || ""}
                                      onClick={() => openObjectiveActionEditor(item.goal, onEditItem)}
                                    >
                                      <span className="objectivesActionDot" aria-hidden="true" />
                                      <span className="objectivesActionBody">
                                        <span className="objectivesActionTitle">{item.title}</span>
                                        {item.meta ? <span className="objectivesActionMeta">{item.meta}</span> : null}
                                      </span>
                                      {item.statusLabel || item.isDone ? (
                                        <span className="objectivesActionDone">{item.statusLabel || "Validé"}</span>
                                      ) : null}
                                    </button>
                                  );
                                })
                              ) : (
                                <div className="objectivesSectionEmpty">{section.emptyLabel}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="objectivesCardFooter">
                        {card.type === "outcome" ? (
                          <CommandCTA
                            variant="ghost"
                            className="objectivesFooterAction"
                            onClick={() =>
                              onEditItem?.({
                                id: card.outcome.id,
                                type: "OUTCOME",
                                categoryId: card.outcome.categoryId || null,
                              })
                            }
                          >
                            {OBJECTIVES_SCREEN_COPY.editObjective}
                          </CommandCTA>
                        ) : null}
                        <CommandCTA
                          variant="secondary"
                          tone="execution"
                          className="objectivesFooterAction"
                          onClick={() => onOpenCreateAction?.(card.category?.id || null, card.type === "outcome" ? card.id : null)}
                        >
                          {OBJECTIVES_SCREEN_COPY.addAction}
                        </CommandCTA>
                      </div>
                    </div>
                  ) : null}
                </CommandCard>
              );
            })}
          </div>
        ) : (
          <CommandEmptyState
            label="OBJECTIFS"
            title="Aucun objectif pour le moment"
            subtitle="Les objectifs donnent une direction claire et transforment tes efforts en résultats."
            tone="execution"
            className="objectivesEmptyState"
            actions={
              typeof onOpenCreateMenu === "function" ? (
                <CommandCTA tone="execution" onClick={openCreateMenuFrom}>
                  Créer mon premier objectif
                </CommandCTA>
              ) : null
            }
          />
        )}
      </div>
    </AppScreen>
  );
}
