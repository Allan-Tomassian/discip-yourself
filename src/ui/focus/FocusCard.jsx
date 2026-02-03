import React from "react";
import { Button, Card } from "../../components/UI";
import { toLocalDateKey } from "../../utils/dateKey";
import "./focus.css";

export default function FocusCard({
  drag = false,
  setActivatorNodeRef,
  listeners,
  attributes,
  focusCategory = null,
  selectedGoal = null,
  canManageCategory = false,
  onOpenManageCategory,
  currentPlannedOccurrence = null,
  nextPlannedOccurrence = null,
  onStartSession,
  onPrepareSession,
  normalizeOccurrenceForUI = (occ) => occ,
  goalsById = new Map(),
}) {
  const categoryName = focusCategory?.name || "Sans catégorie";
  const goalTitle = selectedGoal?.title || "Aucun objectif principal";
  const canManage = Boolean(canManageCategory && focusCategory?.id && typeof onOpenManageCategory === "function");
  const displayOccurrence = currentPlannedOccurrence || nextPlannedOccurrence || null;
  const displayOccurrenceUI = displayOccurrence ? normalizeOccurrenceForUI(displayOccurrence) : null;
  const displayGoal = displayOccurrence ? goalsById.get(displayOccurrence.goalId) || null : null;
  const displayTitle = displayGoal?.title || "Action";
  const todayKey = toLocalDateKey(new Date());
  const displayDateKey = typeof displayOccurrence?.date === "string" ? displayOccurrence.date : "";
  const displayTime =
    displayOccurrenceUI?.start && displayOccurrenceUI.start !== "00:00"
      ? displayOccurrenceUI.start
      : displayDateKey === todayKey
        ? "Aujourd’hui"
        : displayDateKey
          ? `${displayDateKey.slice(8, 10)}/${displayDateKey.slice(5, 7)}`
          : "";
  const statusText = displayOccurrence
    ? displayOccurrence.status === "done"
      ? "Fait"
      : displayOccurrence.status === "skipped"
        ? "Reportée"
        : displayOccurrence.status === "canceled"
          ? "Annulée"
          : "Planifiée"
    : "Aucune action planifiée";
  const canStart = Boolean(currentPlannedOccurrence && typeof onStartSession === "function");
  const canPrepare = Boolean(!currentPlannedOccurrence && typeof onPrepareSession === "function");

  return (
    <Card className="focusCard" data-tour-id="today-focus-card">
      <div className="focusCardBody">
        <div className="focusHeader">
          <div className="focusHeaderLeft">
            <div className="cardSectionTitleRow">
              {drag ? (
                <button
                  ref={setActivatorNodeRef}
                  {...listeners}
                  {...attributes}
                  className="dragHandle"
                  aria-label="Réorganiser"
                >
                  ⋮⋮
                </button>
              ) : null}
              <div className="cardSectionTitle">Focus du jour</div>
            </div>
          </div>
          <div className="focusHeaderActions">
            <Button
              variant="ghost"
              onClick={() => onOpenManageCategory?.(focusCategory?.id)}
              aria-label="Gérer la catégorie"
              className={`focusManageBtn${canManage ? "" : " is-hidden"}`}
              disabled={!canManage}
              tabIndex={canManage ? 0 : -1}
            >
              Gérer
            </Button>
          </div>
        </div>
        <div className="focusBody">
          <div className="focusLine">
            <span className="badge focusCategoryBadge">Catégorie · {categoryName}</span>
          </div>
          <div className="focusMainGoal">
            Objectif principal · <span className="focusMainGoalValue">{goalTitle}</span>
          </div>
          <div className="focusNextRow">
            <span className="focusNextLabel">Prochaine</span>
            <span className="focusNextValue">
              {displayOccurrence
                ? `${displayTitle} • ${displayTime || "Journée"} • ${statusText}`
                : statusText}
            </span>
            {!displayOccurrence && canManage ? (
              <button
                type="button"
                className="focusInlineLink"
                onClick={() => onOpenManageCategory?.(focusCategory?.id)}
              >
                Créer une action
              </button>
            ) : null}
          </div>
          <div className="focusCtaRow">
            <Button
              variant={currentPlannedOccurrence ? "primary" : "secondary"}
              className="focusCtaBtn"
              onClick={() => {
                if (currentPlannedOccurrence) {
                  onStartSession?.(currentPlannedOccurrence);
                } else {
                  onPrepareSession?.();
                }
              }}
              disabled={currentPlannedOccurrence ? !canStart : !canPrepare}
            >
              {currentPlannedOccurrence ? "Démarrer" : "Préparer"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
