import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeLibraryFocusTarget } from "../app/coachCreatedViewTarget";
import { resolveGoalType } from "../domain/goalType";
import { getVisibleCategories } from "../domain/categoryVisibility";
import { computeAggregateProgress, getGoalProgress } from "../logic/goals";
import { splitProcessByLink } from "../logic/linking";
import { AppScreen } from "../shared/ui/app";
import { resolveCategoryColor } from "../utils/categoryPalette";

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round((Number.isFinite(value) ? value : 0) * 100)));
}

function formatSubtitle(goal, category) {
  const notes = typeof goal?.notes === "string" ? goal.notes.trim() : "";
  if (notes) return notes;
  if (goal?.deadline) return `Target: ${goal.deadline}`;
  if (category?.name) return category.name;
  return "Linked execution underneath.";
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
      title: category?.name ? `${category.name} actions` : "Standalone actions",
      subtitle: "Unlinked actions still available in the real app.",
      category,
      progress,
      actions: items,
    };
  });
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

  const cards = useMemo(() => {
    const outcomeCards = outcomes.map((outcome) => {
      const category = categoriesById.get(outcome.categoryId || "") || null;
      const linked = splitProcessByLink(processGoals, outcome.id).linked;
      return {
        id: outcome.id,
        type: "outcome",
        title: outcome.title || "Untitled objective",
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
  const focusTarget = normalizeLibraryFocusTarget(safeData?.ui?.libraryFocusTarget);
  const focusTargetRef = useRef("");

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
      headerTitle="Objectives"
      headerRight={
        <button
          type="button"
          className="lovableObjectivesCreate"
          aria-label="Create"
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
        {cards.length ? (
          <div className="lovableObjectivesList">
            {cards.map((card) => {
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
                      <div className="lovableObjectiveTitle">{card.title}</div>
                      <div className="lovableObjectiveSubtitle">{card.subtitle}</div>
                    </div>
                    <div className="lovableObjectiveChevron">{expanded ? "⌃" : "⌄"}</div>
                  </button>
                  {expanded ? (
                    <div className="lovableObjectiveBody">
                      {card.category?.name ? (
                        <div className="lovableObjectiveCategory">{card.category.name}</div>
                      ) : null}
                      <div className="lovableObjectiveTasks">
                        {card.actions.length ? (
                          card.actions.map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              className={`lovableObjectiveTask${action.status === "done" ? " is-done" : ""}`}
                              data-objective-row={action.id}
                              onClick={() => onEditItem?.({ id: action.id, type: "PROCESS", categoryId: action.categoryId || null })}
                            >
                              <span className="lovableObjectiveTaskCircle" />
                              <span className="lovableObjectiveTaskTitle">{action.title || "Untitled action"}</span>
                            </button>
                          ))
                        ) : (
                          <div className="lovableMuted">No linked actions yet.</div>
                        )}
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
                            Edit objective
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="lovableGhostButton"
                          onClick={() => onOpenCreateAction?.(card.category?.id || null, card.type === "outcome" ? card.id : null)}
                        >
                          Add action
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
            <div className="lovableEmptyTitle">No objectives yet.</div>
            <p className="lovableEmptyCopy">
              Create your first objective to start mapping real work into the new Objectives surface.
            </p>
          </div>
        )}
      </div>
    </AppScreen>
  );
}
