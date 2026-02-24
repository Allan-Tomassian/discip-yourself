import React, { useState } from "react";
import { GateBadge, GateButton, GateRow, GateSection } from "../../shared/ui/gate/Gate";
import "../../features/today/today.css";

function FocusButton({ variant = "primary", className = "", ...props }) {
  const gateVariant = variant === "ghost" ? "ghost" : "primary";
  const mergedClassName = [className, "GatePressable"].filter(Boolean).join(" ");
  return <GateButton variant={gateVariant} className={mergedClassName} {...props} />;
}

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

  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <GateSection
      className="focusCard focusCardCompact GateSurfacePremium GateCardPremium"
      collapsible={false}
      data-tour-id="today-focus-card"
    >
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
            {hasAlternatives ? (
              <FocusButton variant="ghost" className="focusManageBtn" onClick={() => setShowAlternatives((v) => !v)}>
                {showAlternatives ? "Fermer" : "Changer"}
              </FocusButton>
            ) : null}
            {isOverride ? (
              <FocusButton variant="ghost" className="focusManageBtn" onClick={onResetOverride}>
                Revenir au plan
              </FocusButton>
            ) : null}
          </div>
        </div>
        <div className="focusBody">
          <div className="focusLine">
            <GateBadge className="focusCategoryBadge">Catégorie · {displayCategoryName}</GateBadge>
            <span className="focusStatusBadge">{statusText}</span>
          </div>
          <div className="focusNextRow">
            <span className="focusNextValue">
              {displayOccurrence
                ? `${displayTitle} • ${displayTime}${displayDuration ? ` • ${displayDuration} min` : ""}`
                : statusText}
            </span>
          </div>
          <div className="focusHeroHint">Utilise “Démarrer” dans “À faire maintenant”.</div>
          {hasAlternatives && showAlternatives && typeof onSelectAlternative === "function" ? (
            <div className="focusAltList">
              {alternativeCandidates.map((item) => (
                <GateRow
                  key={item.occ.id}
                  className="focusAltItem GateRowPremium GatePressable"
                  onClick={() => {
                    onSelectAlternative(item);
                    setShowAlternatives(false);
                  }}
                  right={
                    <span className="focusAltMeta">
                      {item.occ.start && item.occ.start !== "00:00" ? item.occ.start : "Journée"}
                      {item.warning ? " · déviation" : ""}
                    </span>
                  }
                >
                  <span className="focusAltTitle">
                    {goalsById.get(item.occ.goalId)?.title || "Action"}
                  </span>
                </GateRow>
              ))}
              {baseOccurrence && isOverride ? (
                <div className="focusAltNote">Plan initial: {goalsById.get(baseOccurrence.goalId)?.title || "Action"}</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </GateSection>
  );
}
