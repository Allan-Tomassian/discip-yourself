import React from "react";
import { GateButton, GateSection } from "../../shared/ui/gate/Gate";

function labelForState(viewState) {
  if (viewState === "running") return "En cours";
  if (viewState === "paused") return "En pause";
  if (viewState === "completed") return "Terminée";
  if (viewState === "blocked") return "Bloquée";
  if (viewState === "reported") return "Reportée";
  return "Prête";
}

export default function FocusSessionView({
  title = "Session",
  categoryName = "Catégorie",
  plannedDurationLabel = "",
  elapsedLabel = "",
  remainingLabel = "",
  viewState = "idle",
  canStart = false,
  canPause = false,
  canComplete = false,
  onStart,
  onPause,
  onComplete,
  onBlock,
  onOpenReport,
  showFeedback = false,
  feedbackLevel = "",
  feedbackText = "",
  onFeedbackLevelChange,
  onFeedbackTextChange,
  onFeedbackSubmit,
  reportMode = false,
  onChooseReport,
}) {
  const isFinal = viewState === "completed" || viewState === "blocked" || viewState === "reported";

  return (
    <div className="col" style={{ gap: 12 }}>
      <GateSection title={title} collapsible={false} className="GateSurfacePremium GateCardPremium">
        <div className="col" style={{ gap: 8 }}>
          <div className="small2" style={{ opacity: 0.78 }}>{categoryName}</div>
          <div className="titleSm">{labelForState(viewState)}</div>
          {plannedDurationLabel ? <div className="small2">Prévu: {plannedDurationLabel}</div> : null}
          {elapsedLabel ? <div className="small2">Écoulé: {elapsedLabel}</div> : null}
          {remainingLabel ? <div className="small2">Reste: {remainingLabel}</div> : null}
        </div>
      </GateSection>

      {!isFinal ? (
        <GateSection title="Actions" collapsible={false} className="GateSurfacePremium GateCardPremium">
          <div className="GatePrimaryCtaRow" style={{ flexWrap: "wrap" }}>
            <GateButton
              type="button"
              className="GatePressable"
              withSound
              onClick={() => onStart?.()}
              disabled={!canStart}
            >
              {viewState === "paused" ? "Reprendre" : "Démarrer"}
            </GateButton>
            <GateButton
              type="button"
              variant="ghost"
              className="GatePressable"
              withSound
              onClick={() => onPause?.()}
              disabled={!canPause}
            >
              Pause
            </GateButton>
            <GateButton
              type="button"
              variant="ghost"
              className="GatePressable"
              withSound
              onClick={() => onBlock?.()}
              disabled={!canComplete}
            >
              Bloqué
            </GateButton>
            <GateButton
              type="button"
              variant="ghost"
              className="GatePressable"
              withSound
              onClick={() => onOpenReport?.()}
              disabled={!canComplete}
            >
              Reporter
            </GateButton>
            <GateButton
              type="button"
              className="GatePressable"
              withSound
              onClick={() => onComplete?.()}
              disabled={!canComplete}
            >
              Terminé
            </GateButton>
          </div>
        </GateSection>
      ) : null}

      {reportMode ? (
        <GateSection title="Reporter" collapsible={false} className="GateSurfacePremium GateCardPremium">
          <div className="GatePrimaryCtaRow" style={{ flexWrap: "wrap" }}>
            <GateButton type="button" className="GatePressable" withSound onClick={() => onChooseReport?.("later_today")}>
              Plus tard aujourd’hui
            </GateButton>
            <GateButton type="button" className="GatePressable" withSound onClick={() => onChooseReport?.("tomorrow")}>
              Demain
            </GateButton>
            <GateButton type="button" variant="ghost" className="GatePressable" withSound onClick={() => onChooseReport?.("planning")}>
              Choisir dans Planning
            </GateButton>
          </div>
        </GateSection>
      ) : null}

      {showFeedback ? (
        <GateSection title="Feedback de fin" collapsible={false} className="GateSurfacePremium GateCardPremium">
          <div className="col" style={{ gap: 12 }}>
            <div className="GatePrimaryCtaRow" style={{ flexWrap: "wrap" }}>
              {["facile", "normal", "difficile"].map((level) => (
                <GateButton
                  key={level}
                  type="button"
                  variant={feedbackLevel === level ? "primary" : "ghost"}
                  className="GatePressable"
                  withSound
                  onClick={() => onFeedbackLevelChange?.(level)}
                >
                  {level}
                </GateButton>
              ))}
            </div>
            <textarea
              className="GateTextareaPremium"
              rows={3}
              value={feedbackText}
              onChange={(event) => onFeedbackTextChange?.(event.target.value)}
              placeholder="Ajoute un retour rapide si utile…"
            />
            <div className="GatePrimaryCtaRow">
              <GateButton
                type="button"
                className="GatePressable"
                withSound
                onClick={() => onFeedbackSubmit?.()}
                disabled={!feedbackLevel}
              >
                Enregistrer
              </GateButton>
            </div>
          </div>
        </GateSection>
      ) : null}
    </div>
  );
}
