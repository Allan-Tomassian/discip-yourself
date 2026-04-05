import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeLibraryFocusTarget } from "../app/coachCreatedViewTarget";
import { resolveGoalType } from "../domain/goalType";
import { getVisibleCategories } from "../domain/categoryVisibility";
import { computeAggregateProgress, getGoalProgress } from "../logic/goals";
import { splitProcessByLink } from "../logic/linking";
import { AppChip, AppScreen } from "../shared/ui/app";
import { OBJECTIVES_SCREEN_COPY } from "../ui/labels";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/datetime";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round((Number.isFinite(value) ? value : 0) * 100)));
}

function formatSubtitle(goal, category) {
  const notes = typeof goal?.notes === "string" ? goal.notes.trim() : "";
  if (notes) return notes;
  if (goal?.deadline) return `${OBJECTIVES_SCREEN_COPY.deadlinePrefix} : ${goal.deadline}`;
  return OBJECTIVES_SCREEN_COPY.fallbackSubtitle;
}

function groupStandaloneActions(actions, categoriesById) {
  const groups = new Map();
  for (const action of actions) {
    const categoryId = action?.categoryId || "standalone";
    if (!groups.has(categoryId)) groups.set(categoryId, []);
    groups.get(categoryId).push(action);
  }
  return Array.from(groups.entries()).map(([categoryId, items]) => {
    const category = categoriesById.get(categoryId) || null;
    const done = items.filter((item) => item?.status === "done").length;
    const progress = items.length ? done / items.length : 0;
    return {
      id: `standalone:${categoryId}`,
      type: "standalone",
      title: category?.name ? `${category.name} ${OBJECTIVES_SCREEN_COPY.standaloneSuffix}` : OBJECTIVES_SCREEN_COPY.standaloneTitle,
      subtitle: OBJECTIVES_SCREEN_COPY.standaloneSubtitle,
      category,
      progress,
      actions: items,
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

function buildObjectiveSections({ actions = [], occurrencesByGoalId, todayKey }) {
  const activeItems = actions
    .map((action) => ({
      id: `active:${action.id}`,
      title: action.title || OBJECTIVES_SCREEN_COPY.untitledAction,
      meta: "",
      isDone: action.status === "done",
      goal: action,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));

  const todayItems = [];
  const upcomingItems = [];

  for (const action of actions) {
    const occurrences = [...(occurrencesByGoalId.get(action.id) || [])].sort(compareOccurrences);
    for (const occurrence of occurrences) {
      const dateKey = normalizeLocalDateKey(occurrence?.date) || "";
      if (!dateKey) continue;
      const item = {
        id: `occurrence:${occurrence.id}`,
        title: action.title || OBJECTIVES_SCREEN_COPY.untitledAction,
        meta: dateKey === todayKey ? "" : formatOccurrenceMeta(dateKey),
        isDone: occurrence.status === "done",
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

function ObjectiveRing({ progress = 0, color = "#8b78ff" }) {
  const circumference = 2 * Math.PI * 21;
  const offset = circumference - circumference * Math.max(0, Math.min(1, progress));
  return (
    <div className="lovableObjectiveRing" aria-hidden="true">
      <svg viewBox="0 0 52 52">
        <circle className="lovableObjectiveRingTrack" cx="26" cy="26" r="21" />
        <circle
          className="lovableObjectiveRingValue"
          cx="26"
          cy="26"
          r="21"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="lovableObjectiveRingLabel">{clampPercent(progress)}%</div>
    </div>
  );
}

function escapeSelectorValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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

  const goalProgressById = useMemo(() => {
    const map = new Map();
    for (const outcome of outcomes) {
      const linked = computeAggregateProgress({ goals }, outcome.id);
      const progress = outcome?.progress == null ? linked.progress : getGoalProgress(outcome);
      map.set(outcome.id, progress);
    }
    return map;
  }, [goals, outcomes]);

  const standaloneActions = useMemo(
    () => processGoals.filter((goal) => !outcomes.some((outcome) => outcome?.id && goal?.parentId === outcome.id)),
    [outcomes, processGoals]
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
      const linked = splitProcessByLink(processGoals, outcome.id).linked;
      return {
        id: outcome.id,
        type: "outcome",
        title: outcome.title || OBJECTIVES_SCREEN_COPY.untitledObjective,
        subtitle: formatSubtitle(outcome, category),
        category,
        progress: goalProgressById.get(outcome.id) || 0,
        actions: linked,
        outcome,
      };
    });
    const fallbackCards = groupStandaloneActions(standaloneActions, categoriesById);
    return [...outcomeCards, ...fallbackCards].sort((left, right) => {
      return (right.progress || 0) - (left.progress || 0);
    });
  }, [categoriesById, goalProgressById, outcomes, processGoals, standaloneActions]);

  const [expandedCards, setExpandedCards] = useState({});
  const [categoryFilterId, setCategoryFilterId] = useState("all");
  const focusTarget = normalizeLibraryFocusTarget(safeData?.ui?.libraryFocusTarget);
  const focusTargetRef = useRef("");

  const filteredCards = useMemo(() => {
    if (categoryFilterId === "all") return cards;
    return cards.filter((card) => card.category?.id === categoryFilterId);
  }, [cards, categoryFilterId]);

  useEffect(() => {
    const firstActionId = focusTarget?.actionIds?.[0] || null;
    const action = firstActionId ? processGoals.find((goal) => goal?.id === firstActionId) || null : null;
    const targetCardId =
      focusTarget?.outcomeId ||
      action?.parentId ||
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
        <button
          type="button"
          className="lovableObjectivesCreate"
          aria-label={OBJECTIVES_SCREEN_COPY.createAriaLabel}
          onClick={(event) =>
            onOpenCreateMenu?.({
              source: "objectives",
              anchorEl: event.currentTarget,
              anchorRect: event.currentTarget.getBoundingClientRect(),
            })
          }
        >
          +
        </button>
      }
    >
      <div className="lovablePage">
        {categories.length ? (
          <div className="lovableFilterRow" aria-label={OBJECTIVES_SCREEN_COPY.categoryFilterLabel}>
            <AppChip active={categoryFilterId === "all"} onClick={() => setCategoryFilterId("all")}>
              {OBJECTIVES_SCREEN_COPY.allCategories}
            </AppChip>
            {categories.map((category) => (
              <AppChip
                key={category.id}
                active={categoryFilterId === category.id}
                onClick={() => setCategoryFilterId(category.id)}
              >
                {category.name}
              </AppChip>
            ))}
          </div>
        ) : null}

        {filteredCards.length ? (
          <div className="lovableObjectivesList">
            {filteredCards.map((card) => {
              const expanded = Boolean(expandedCards[card.id]);
              const color = resolveCategoryColor(card.category, "#8b78ff");
              return (
                <div key={card.id} className="lovableCard lovableObjectiveCard" data-objective-card={card.id}>
                  <button
                    type="button"
                    className="lovableObjectiveHeader"
                    onClick={() =>
                      setExpandedCards((previous) => ({ ...previous, [card.id]: !expanded }))
                    }
                  >
                    <ObjectiveRing progress={card.progress} color={color} />
                    <div>
                      {card.category?.name ? (
                        <div className="lovableObjectiveCategory">{card.category.name}</div>
                      ) : null}
                      <div className="lovableObjectiveTitle">{card.title}</div>
                      <div className="lovableObjectiveSubtitle">{card.subtitle}</div>
                    </div>
                    <div className="lovableObjectiveChevron">{expanded ? "⌃" : "⌄"}</div>
                  </button>
                  {expanded ? (
                    <div className="lovableObjectiveBody">
                      <div className="lovableObjectiveSections">
                        {buildObjectiveSections({
                          actions: card.actions,
                          occurrencesByGoalId,
                          todayKey,
                        }).map((section) => (
                          <div key={`${card.id}:${section.key}`} className="lovableObjectiveSection">
                            <div className="lovableObjectiveSectionTitle">{section.label}</div>
                            <div className="lovableObjectiveTasks">
                              {section.items.length ? (
                                section.items.map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className={`lovableObjectiveTask${item.isDone ? " is-done" : ""}`}
                                    data-objective-row={item.goal?.id || ""}
                                    onClick={() => openObjectiveActionEditor(item.goal, onEditItem)}
                                  >
                                    <span className="lovableObjectiveTaskCircle" />
                                    <span className="lovableObjectiveTaskTitle">
                                      {item.title}
                                      {item.meta ? ` • ${item.meta}` : ""}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <div className="lovableMuted">{section.emptyLabel}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="lovableObjectiveFooter">
                        {card.type === "outcome" ? (
                          <button
                            type="button"
                            className="lovableGhostButton lovableObjectiveLink"
                            onClick={() =>
                              onEditItem?.({
                                id: card.outcome.id,
                                type: "OUTCOME",
                                categoryId: card.outcome.categoryId || null,
                              })
                            }
                          >
                            {OBJECTIVES_SCREEN_COPY.editObjective}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="lovableGhostButton"
                          onClick={() => onOpenCreateAction?.(card.category?.id || null, card.type === "outcome" ? card.id : null)}
                        >
                          {OBJECTIVES_SCREEN_COPY.addAction}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="lovableCard lovableEmptyCard">
            <div className="lovableEmptyTitle">{OBJECTIVES_SCREEN_COPY.emptyTitle}</div>
            <p className="lovableEmptyCopy">
              {OBJECTIVES_SCREEN_COPY.emptyCopy}
            </p>
          </div>
        )}
      </div>
    </AppScreen>
  );
}
