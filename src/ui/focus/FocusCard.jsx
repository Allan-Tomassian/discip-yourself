import React, { useState } from "react";
import { Button, Card } from "../../components/UI";
import "./focus.css";

export default function FocusCard({
  drag = false,
  setActivatorNodeRef,
  listeners,
  attributes,
  focusOccurrence = null,
  baseOccurrence = null,
  alternativeCandidates = [],
  onSelectAlternative,
  onResetOverride,
  isOverride = false,
  onStartSession,
  normalizeOccurrenceForUI = (occ) => occ,
  goalsById = new Map(),
  categoriesById = new Map(),
  activeOccurrenceId = null,
}) {
  const displayOccurrence = focusOccurrence || null;
  const displayOccurrenceUI = displayOccurrence ? normalizeOccurrenceForUI(displayOccurrence) : null;
  const displayGoal = displayOccurrence ? goalsById.get(displayOccurrence.goalId) || null : null;
  const displayCategory = displayGoal ? categoriesById.get(displayGoal.categoryId) || null : null;
  const displayTitle = displayGoal?.title || "Action";
  const displayCategoryName = displayCategory?.name || "Sans catégorie";
  const displayTime =
    displayOccurrenceUI?.start && displayOccurrenceUI.start !== "00:00" ? displayOccurrenceUI.start : "Journée";
  const displayDuration = Number.isFinite(displayOccurrence?.durationMinutes)
    ? displayOccurrence.durationMinutes
    : Number.isFinite(displayGoal?.durationMinutes)
      ? displayGoal.durationMinutes
      : Number.isFinite(displayGoal?.sessionMinutes)
        ? displayGoal.sessionMinutes
        : null;
  const statusText = displayOccurrence
    ? activeOccurrenceId && displayOccurrence.id === activeOccurrenceId
      ? "En cours"
      : displayOccurrence.status === "done"
        ? "Fait"
        : displayOccurrence.status === "skipped"
          ? "Reportée"
          : displayOccurrence.status === "canceled"
            ? "Annulée"
            : "Planifiée"
    : "Rien de prévu, choisis une action prioritaire.";
  const canStart = Boolean(displayOccurrence && typeof onStartSession === "function");
  const hasAlternatives = Array.isArray(alternativeCandidates) && alternativeCandidates.length > 0;

  const [showAlternatives, setShowAlternatives] = useState(false);

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
            {isOverride ? (
              <Button variant="ghost" className="focusManageBtn" onClick={onResetOverride}>
                Revenir au plan
              </Button>
            ) : null}
          </div>
        </div>
        <div className="focusBody">
          <div className="focusLine">
            <span className="badge focusCategoryBadge">Catégorie · {displayCategoryName}</span>
          </div>
          <div className="focusNextRow">
            <span className="focusNextLabel">Prévu maintenant</span>
            <span className="focusNextValue">
              {displayOccurrence
                ? `${displayTitle} • ${displayTime}${displayDuration ? ` • ${displayDuration} min` : ""} • ${statusText}`
                : statusText}
            </span>
          </div>
          <div className="focusCtaRow">
            <Button variant="primary" className="focusCtaBtn" onClick={() => onStartSession?.(displayOccurrence)} disabled={!canStart}>
              Démarrer
            </Button>
            {hasAlternatives ? (
              <Button variant="ghost" className="focusAltBtn" onClick={() => setShowAlternatives((v) => !v)}>
                Changer
              </Button>
            ) : null}
          </div>
          {hasAlternatives && showAlternatives && typeof onSelectAlternative === "function" ? (
            <div className="focusAltList">
              {alternativeCandidates.map((item) => (
                <button
                  key={item.occ.id}
                  type="button"
                  className="focusAltItem"
                  onClick={() => {
                    onSelectAlternative(item);
                    setShowAlternatives(false);
                  }}
                >
                  <span className="focusAltTitle">
                    {goalsById.get(item.occ.goalId)?.title || "Action"}
                  </span>
                  <span className="focusAltMeta">
                    {item.occ.start && item.occ.start !== "00:00" ? item.occ.start : "Journée"}
                    {item.warning ? " · déviation" : ""}
                  </span>
                </button>
              ))}
              {baseOccurrence && isOverride ? (
                <div className="focusAltNote">Plan initial: {goalsById.get(baseOccurrence.goalId)?.title || "Action"}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
