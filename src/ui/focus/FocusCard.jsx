import React, { useState } from "react";
import { AppCard, GhostButton, StatusBadge } from "../../shared/ui/app";
import "./focusCard.css";

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
    : "Rien de prévu";
  const hasAlternatives = Array.isArray(alternativeCandidates) && alternativeCandidates.length > 0;
  const statusTone =
    statusText === "En cours"
      ? "info"
      : statusText === "Fait"
        ? "success"
        : statusText === "Reportée" || statusText === "Annulée"
          ? "warning"
          : "info";

  const [showAlternatives, setShowAlternatives] = useState(false);
  const focusSummary = displayOccurrence
    ? `${displayTitle}${displayTime || displayDuration ? " · " : ""}${[
        displayTime || null,
        displayDuration ? `${displayDuration} min` : null,
      ]
        .filter(Boolean)
        .join(" · ")}`
    : "Aucun focus secondaire sélectionné";

  return (
    <AppCard className="focusCard focusCardCompact" data-tour-id="today-focus-card">
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
              <div className="cardSectionTitle">Ajuster le focus</div>
            </div>
          </div>
          <div className="focusHeaderActions">
            {hasAlternatives ? (
              <GhostButton type="button" size="sm" className="focusManageBtn" onClick={() => setShowAlternatives((v) => !v)}>
                {showAlternatives ? "Fermer" : "Changer"}
              </GhostButton>
            ) : null}
            {isOverride ? (
              <GhostButton type="button" size="sm" className="focusManageBtn" onClick={onResetOverride}>
                Revenir au plan
              </GhostButton>
            ) : null}
          </div>
        </div>
        <div className="focusBody">
          <div className="focusLine">
            <StatusBadge className="focusCategoryBadge" tone="info">
              Focus actuel · {displayCategoryName}
            </StatusBadge>
            <StatusBadge className="focusStatusBadge" tone={statusTone}>
              {statusText}
            </StatusBadge>
          </div>
          <div className="focusNextRow">
            <span className="focusNextValue">{focusSummary}</span>
          </div>
          <div className="focusHeroHint">Change le focus seulement si tu veux dévier du plan du jour.</div>
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
                  <span className="focusAltTitle">{goalsById.get(item.occ.goalId)?.title || "Action"}</span>
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
    </AppCard>
  );
}
