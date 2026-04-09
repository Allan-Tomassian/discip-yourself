import React from "react";
import { BehaviorCue } from "../../feedback/BehaviorFeedbackContext";
import {
  AppCard,
  AppTextarea,
  GhostButton,
  PrimaryButton,
  StatusBadge,
} from "../../shared/ui/app";

function labelForState(viewState) {
  if (viewState === "running") return "En cours";
  if (viewState === "paused") return "En pause";
  if (viewState === "completed") return "Terminée";
  if (viewState === "blocked") return "Bloquée";
  if (viewState === "reported") return "Reportée";
  return "Prête";
}

function toneForState(viewState) {
  if (viewState === "running" || viewState === "paused") return "info";
  if (viewState === "completed") return "success";
  if (viewState === "blocked") return "warning";
  if (viewState === "reported") return "info";
  return "info";
}

export default function FocusSessionView({
  title = "Session",
  categoryName = "Catégorie",
  actionProtocol = null,
  plannedDurationLabel = "",
  elapsedLabel = "",
  remainingLabel = "",
  behaviorCue = null,
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
  const isRunning = viewState === "running";
  const isPaused = viewState === "paused";
  const startLabel = isPaused ? "Reprendre" : "Démarrer";
  const completeLabel = "Terminer";
  const protocolItems = actionProtocol
    ? [
        { label: "Pourquoi", text: actionProtocol.why },
        { label: "Départ", text: actionProtocol.firstStep },
        { label: "Si blocage", text: actionProtocol.ifBlocked },
        { label: "Réussi quand", text: actionProtocol.successDefinition },
      ].filter((item) => item.text)
    : [];

  return (
    <div className="sessionViewStack">
      <AppCard className="sessionCard" variant="elevated">
        <div className="sessionCardBody">
          <div className="sessionHeaderRow">
            <div className="sessionHeaderText">
              <div className="sessionMeta">{categoryName}</div>
              <div className="sessionTitle">{title}</div>
            </div>
            <StatusBadge tone={toneForState(viewState)}>{labelForState(viewState)}</StatusBadge>
          </div>
          {behaviorCue ? <BehaviorCue cue={behaviorCue} /> : null}
          {protocolItems.length ? (
            <div className="sessionProtocol" data-testid="session-action-protocol">
              <div className="sessionProtocolGrid">
                {protocolItems.map((item) => (
                  <div key={item.label} className="sessionProtocolItem">
                    <div className="sessionProtocolLabel">{item.label}</div>
                    <div className="sessionProtocolText">{item.text}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="sessionMetrics">
            {plannedDurationLabel ? (
              <div className="sessionMetric">
                <div className="sessionMetricLabel">Prévu</div>
                <div className="sessionMetricValue">{plannedDurationLabel}</div>
              </div>
            ) : null}
            {elapsedLabel ? (
              <div className="sessionMetric">
                <div className="sessionMetricLabel">Écoulé</div>
                <div className="sessionMetricValue">{elapsedLabel}</div>
              </div>
            ) : null}
            {remainingLabel ? (
              <div className="sessionMetric">
                <div className="sessionMetricLabel">Reste</div>
                <div className="sessionMetricValue">{remainingLabel}</div>
              </div>
            ) : null}
          </div>
        </div>
      </AppCard>

      {!isFinal ? (
        <AppCard className="sessionCard">
          <div className="sessionActionSection">
            <div className="sessionSectionTitle">Prochain pas</div>
            <div className="sessionActions sessionActions--primary">
              <PrimaryButton
                type="button"
                className="sessionActionButton sessionActionButton--primary"
                onClick={() => onStart?.()}
                disabled={!canStart}
              >
                {startLabel}
              </PrimaryButton>
              <PrimaryButton
                type="button"
                className="sessionActionButton sessionActionButton--primary"
                onClick={() => onComplete?.()}
                disabled={!canComplete}
              >
                {completeLabel}
              </PrimaryButton>
            </div>
            <div className="sessionActions sessionActions--secondary">
              <GhostButton
                type="button"
                className="sessionActionButton"
                onClick={() => onPause?.()}
                disabled={!canPause}
              >
                {isRunning ? "Mettre en pause" : "Pause"}
              </GhostButton>
              <GhostButton
                type="button"
                className="sessionActionButton"
                onClick={() => onOpenReport?.()}
                disabled={!canComplete}
              >
                Reporter
              </GhostButton>
              <GhostButton
                type="button"
                className="sessionActionButton"
                onClick={() => onBlock?.()}
                disabled={!canComplete}
              >
                Bloquer
              </GhostButton>
            </div>
          </div>
        </AppCard>
      ) : null}

      {reportMode ? (
        <AppCard className="sessionCard">
          <div className="sessionActionSection">
            <div className="sessionSectionTitle">Reporter</div>
            <div className="sessionFieldHint">Choisis un report immédiat ou renvoie la session dans le planning.</div>
            <div className="sessionActions">
              <PrimaryButton
                type="button"
                className="sessionActionButton"
                onClick={() => onChooseReport?.("later_today")}
              >
              Plus tard aujourd’hui
              </PrimaryButton>
              <PrimaryButton
                type="button"
                className="sessionActionButton"
                onClick={() => onChooseReport?.("tomorrow")}
              >
              Demain
              </PrimaryButton>
              <GhostButton
                type="button"
                className="sessionActionButton"
                onClick={() => onChooseReport?.("planning")}
              >
              Choisir dans le planning
              </GhostButton>
            </div>
          </div>
        </AppCard>
      ) : null}

      {showFeedback ? (
        <AppCard className="sessionCard">
          <div className="sessionActionSection">
            <div className="sessionSectionTitle">Feedback de fin</div>
            <div className="sessionActions">
              {["facile", "normal", "difficile"].map((level) => (
                feedbackLevel === level ? (
                  <PrimaryButton
                    key={level}
                    type="button"
                    className="sessionActionButton"
                    onClick={() => onFeedbackLevelChange?.(level)}
                  >
                    {level}
                  </PrimaryButton>
                ) : (
                  <GhostButton
                  key={level}
                  type="button"
                  className="sessionActionButton"
                  onClick={() => onFeedbackLevelChange?.(level)}
                >
                  {level}
                  </GhostButton>
                )
              ))}
            </div>
            <AppTextarea
              className="sessionFeedbackInput"
              rows={3}
              value={feedbackText}
              onChange={(event) => onFeedbackTextChange?.(event.target.value)}
              placeholder="Ajoute un retour rapide si utile…"
            />
            <div className="sessionFooterActions">
              <PrimaryButton
                type="button"
                className="sessionActionButton"
                onClick={() => onFeedbackSubmit?.()}
                disabled={!feedbackLevel}
              >
                Valider la session
              </PrimaryButton>
            </div>
          </div>
        </AppCard>
      ) : null}
    </div>
  );
}
