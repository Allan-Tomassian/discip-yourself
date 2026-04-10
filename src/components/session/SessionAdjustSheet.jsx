import React from "react";
import { AppSheet, GhostButton } from "../../shared/ui/app";

function SessionAdjustOption({
  title,
  description = "",
  badge = "",
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`sessionAdjustOption${disabled ? " is-disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <div className="sessionAdjustOptionText">
        <div className="sessionAdjustOptionTitle">{title}</div>
        {description ? <div className="sessionAdjustOptionDescription">{description}</div> : null}
      </div>
      {badge ? <div className="sessionAdjustOptionBadge">{badge}</div> : null}
    </button>
  );
}

export default function SessionAdjustSheet({
  open = false,
  mode = "standard",
  causes = [],
  selectedCause = "",
  options = [],
  currentSummary = "",
  loading = false,
  onClose,
  onSelectCause,
  onResetCause,
  onApply,
}) {
  const isGuided = mode === "guided";
  const subtitle = isGuided
    ? "Adapte la séance sans casser son objectif."
    : "Allège la séance sans ouvrir le guidage complet.";

  return (
    <AppSheet
      open={open}
      onClose={onClose}
      className="sessionAdjustSheet"
      placement="bottom"
      maxWidth={560}
    >
      <div className="sessionAdjustSheetContent">
        <div className="sessionAdjustSheetHeader">
          <div className="sessionAdjustSheetHeaderText">
            <div className="sessionAdjustSheetTitle">Réajuster</div>
            <div className="sessionAdjustSheetSubtitle">{subtitle}</div>
          </div>
          <div className="sessionAdjustSheetHeaderActions">
            {selectedCause ? (
              <GhostButton type="button" size="sm" onClick={onResetCause}>
                Retour
              </GhostButton>
            ) : null}
            <GhostButton type="button" size="sm" onClick={onClose}>
              Fermer
            </GhostButton>
          </div>
        </div>

        {currentSummary ? <div className="sessionAdjustSheetCurrent">{currentSummary}</div> : null}

        {!selectedCause ? (
          <div className="sessionAdjustSheetChoices" data-testid="session-adjust-causes">
            {causes.map((cause) => (
              <SessionAdjustOption
                key={cause.id}
                title={cause.label}
                description={cause.description || ""}
                onClick={() => onSelectCause?.(cause.id)}
              />
            ))}
          </div>
        ) : (
          <div className="sessionAdjustSheetChoices" data-testid="session-adjust-options">
            {options.map((option) => (
              <SessionAdjustOption
                key={option.strategyId}
                title={option.label}
                description={option.summary}
                badge={
                  option.aiPreferred
                    ? "Assisté"
                    : Number.isFinite(option.adjustedDurationMinutes)
                      ? `${option.adjustedDurationMinutes} min`
                      : ""
                }
                disabled={loading}
                onClick={() => onApply?.(option)}
              />
            ))}
            {!options.length ? (
              <div className="sessionAdjustSheetEmpty">
                Aucun ajustement utile pour cette cause dans l’état actuel de la séance.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AppSheet>
  );
}
