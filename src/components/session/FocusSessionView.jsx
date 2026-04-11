import React from "react";
import { BehaviorCue } from "../../feedback/BehaviorFeedbackContext";
import { AppTextarea, GhostButton, PrimaryButton } from "../../shared/ui/app";
import SessionGuidedDeck from "./SessionGuidedDeck";

function renderProgressDots(total, currentIndex) {
  const count = Math.max(1, Number.isFinite(total) ? total : 1);
  return Array.from({ length: count }, (_, index) => (
    <span
      key={`dot-${index}`}
      className={`sessionRuntimeDot${index === currentIndex ? " is-active" : ""}`}
      aria-hidden="true"
    />
  ));
}

export default function FocusSessionView({
  title = "Session",
  actionProtocol = null,
  guidedPlan = null,
  guidedMode = "",
  adjustmentLabel = "",
  adjustmentSummary = "",
  plannedDurationLabel = "",
  elapsedLabel = "",
  remainingLabel = "",
  timerLabel = "",
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
  onOpenAdjust,
  onOpenTools,
  onRegenerateGuided,
  onRevertToStandard,
  onViewGuidedStep,
  onReturnToActiveGuidedStep,
  onToggleGuidedChecklistItem,
  onAdvanceGuidedStep,
  showAdjust = false,
  showTools = false,
  adjustMode = "standard",
  toolTray = null,
  guidedRegenerating = false,
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
  const isGuided = Boolean(guidedPlan && !isFinal);
  const isGuidedPreview = isGuided && guidedMode === "preview";
  const isGuidedActive = isGuided && guidedMode === "active";
  const protocolItems = actionProtocol
    ? [
        { label: "Pourquoi", text: actionProtocol.why },
        { label: "Départ", text: actionProtocol.firstStep },
        { label: "Si blocage", text: actionProtocol.ifBlocked },
        { label: "Réussi quand", text: actionProtocol.successDefinition },
      ].filter((item) => item.text)
    : [];
  const inlineBehaviorCue = behaviorCue && !guidedPlan && !isFinal ? behaviorCue : null;
  const runtimeStats = [
    { label: "Prévu", value: plannedDurationLabel },
    { label: "Écoulé", value: elapsedLabel },
    { label: "Reste", value: remainingLabel },
  ].filter((item) => item.value);
  const heroTimerLabel = timerLabel || remainingLabel || elapsedLabel || plannedDurationLabel || "00:00";
  const progressDotsIndex = isGuided
    ? Math.max(0, Number(isGuidedPreview ? guidedPlan?.viewedStepIndex : guidedPlan?.activeStepIndex || 0))
    : 0;
  const progressDotsTotal = Math.max(1, Number(guidedPlan?.totalSteps || 1));
  const progressLabel = isGuidedPreview
    ? `Étape ${progressDotsIndex + 1}/${progressDotsTotal}`
    : `Étape ${Math.max(0, Number(guidedPlan?.activeStepIndex || 0)) + 1}/${progressDotsTotal}`;

  return (
    <div className={`sessionRuntimeStack${isGuided ? " is-guided" : " is-standard"}`}>
      <div className="sessionRuntimeHero">
        <div className="sessionRuntimeTimer">{heroTimerLabel}</div>
        {isGuided ? (
          <div className="sessionRuntimeProgressRow">
            <div className="sessionRuntimeDots" aria-hidden="true">
              {renderProgressDots(progressDotsTotal, progressDotsIndex)}
            </div>
            <div className="sessionRuntimeProgressLabel">{progressLabel}</div>
          </div>
        ) : null}
        <div className="sessionRuntimeTitle">{title}</div>
      </div>

      {isGuided ? (
        <div className="sessionGuidedSurface">
          {adjustmentSummary && isGuidedActive ? (
            <div className="sessionAdjustmentNotice" data-testid="session-adjustment-summary">
              <span className="sessionAdjustmentNoticeLabel">{adjustmentLabel || "Ajustée"}</span>
              <span className="sessionAdjustmentNoticeText">{adjustmentSummary}</span>
            </div>
          ) : null}
          <SessionGuidedDeck
            plan={guidedPlan}
            loading={guidedRegenerating}
            onViewStep={onViewGuidedStep}
            onReturnToActiveStep={onReturnToActiveGuidedStep}
            onToggleChecklistItem={onToggleGuidedChecklistItem}
            onAdvanceStep={onAdvanceGuidedStep}
          />
        </div>
      ) : protocolItems.length ? (
        <div className="sessionRuntimeBrief" data-testid="session-action-protocol">
          <div className="sessionRuntimeBriefHeader">
            <div className="sessionRuntimeBriefEyebrowRow">
              <div className="sessionRuntimeBriefTitle">Bloc prêt</div>
              {inlineBehaviorCue ? <BehaviorCue cue={inlineBehaviorCue} className="sessionRuntimeBriefCue" /> : null}
            </div>
            {adjustmentSummary ? (
              <div className="sessionAdjustmentNotice sessionAdjustmentNotice--inline" data-testid="session-adjustment-summary">
                <span className="sessionAdjustmentNoticeLabel">{adjustmentLabel || "Ajustée"}</span>
                <span className="sessionAdjustmentNoticeText">{adjustmentSummary}</span>
              </div>
            ) : null}
          </div>
          <div className="sessionRuntimeBriefRows">
            {protocolItems.map((item) => (
              <div key={item.label} className="sessionRuntimeBriefRow">
                <div className="sessionRuntimeBriefLabel">{item.label}</div>
                <div className="sessionRuntimeBriefText">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {runtimeStats.length && !isGuided ? (
        <div className="sessionRuntimeMetaStrip">
          {runtimeStats.map((item) => (
            <div key={item.label} className="sessionRuntimeMetaItem">
              <div className="sessionRuntimeMetaLabel">{item.label}</div>
              <div className="sessionRuntimeMetaValue">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {isGuidedActive ? toolTray : null}

      {!isFinal ? (
        <div
          className={`sessionActionDock${isGuided ? " sessionActionDock--guided" : " sessionActionDock--standard"}`}
          data-testid="session-action-dock"
        >
          {isGuidedPreview ? (
            <div className="sessionGuidedPreviewActions" data-testid="session-guided-preview-actions">
              <PrimaryButton
                type="button"
                className="sessionDockPrimaryAction"
                onClick={() => onStart?.()}
                disabled={!canStart}
              >
                Démarrer
              </PrimaryButton>
              <GhostButton
                type="button"
                className="sessionDockSecondaryAction"
                onClick={() => onRegenerateGuided?.()}
                disabled={guidedRegenerating}
              >
                Régénérer
              </GhostButton>
              <button type="button" className="sessionLaunchTextAction sessionGuidedPreviewTextAction" onClick={() => onRevertToStandard?.()}>
                Revenir au standard
              </button>
            </div>
          ) : showAdjust || showTools ? (
            <div className={`sessionDockUtilityRow${showTools ? " has-tools" : ""}`}>
              {showAdjust ? (
                <GhostButton
                  type="button"
                  className={`sessionDockAdjustButton${adjustMode === "guided" ? " sessionDockAdjustButton--guided" : ""}`}
                  onClick={() => onOpenAdjust?.()}
                >
                  Réajuster
                </GhostButton>
              ) : null}
              {showTools ? (
                <GhostButton
                  type="button"
                  className="sessionDockToolsButton"
                  onClick={() => onOpenTools?.()}
                >
                  Outils
                </GhostButton>
              ) : null}
            </div>
          ) : null}
          {!isGuidedPreview ? (
            <>
              <div className="sessionDockPrimaryRow">
                <PrimaryButton
                  type="button"
                  className="sessionDockPrimaryAction"
                  onClick={() => onStart?.()}
                  disabled={!canStart}
                >
                  {startLabel}
                </PrimaryButton>
                <PrimaryButton
                  type="button"
                  className="sessionDockPrimaryAction"
                  onClick={() => onComplete?.()}
                  disabled={!canComplete}
                >
                  Terminer
                </PrimaryButton>
              </div>
              <div className="sessionDockSecondaryRow">
                <GhostButton
                  type="button"
                  className="sessionDockSecondaryAction"
                  onClick={() => onPause?.()}
                  disabled={!canPause}
                >
                  {isRunning ? "Mettre en pause" : "Pause"}
                </GhostButton>
                <GhostButton
                  type="button"
                  className="sessionDockSecondaryAction"
                  onClick={() => onOpenReport?.()}
                  disabled={!canComplete}
                >
                  Reporter
                </GhostButton>
                <GhostButton
                  type="button"
                  className="sessionDockSecondaryAction"
                  onClick={() => onBlock?.()}
                  disabled={!canComplete}
                >
                  Bloquer
                </GhostButton>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {reportMode ? (
        <div className="sessionSupplementCard">
          <div className="sessionSupplementTitle">Reporter</div>
          <div className="sessionSupplementHint">Choisis un report immédiat ou renvoie la session dans le planning.</div>
          <div className="sessionSupplementActions">
            <PrimaryButton type="button" className="sessionDockPrimaryAction" onClick={() => onChooseReport?.("later_today")}>
              Plus tard aujourd’hui
            </PrimaryButton>
            <PrimaryButton type="button" className="sessionDockPrimaryAction" onClick={() => onChooseReport?.("tomorrow")}>
              Demain
            </PrimaryButton>
            <GhostButton type="button" className="sessionDockSecondaryAction" onClick={() => onChooseReport?.("planning")}>
              Choisir dans le planning
            </GhostButton>
          </div>
        </div>
      ) : null}

      {showFeedback ? (
        <div className="sessionSupplementCard">
          <div className="sessionSupplementTitle">Feedback de fin</div>
          <div className="sessionSupplementActions sessionSupplementActions--feedback">
            {["facile", "normal", "difficile"].map((level) =>
              feedbackLevel === level ? (
                <PrimaryButton
                  key={level}
                  type="button"
                  className="sessionDockPrimaryAction"
                  onClick={() => onFeedbackLevelChange?.(level)}
                >
                  {level}
                </PrimaryButton>
              ) : (
                <GhostButton
                  key={level}
                  type="button"
                  className="sessionDockSecondaryAction"
                  onClick={() => onFeedbackLevelChange?.(level)}
                >
                  {level}
                </GhostButton>
              )
            )}
          </div>
          <AppTextarea
            className="sessionFeedbackInput"
            rows={3}
            value={feedbackText}
            onChange={(event) => onFeedbackTextChange?.(event.target.value)}
            placeholder="Ajoute un retour rapide si utile…"
          />
          <div className="sessionSupplementActions">
            <PrimaryButton
              type="button"
              className="sessionDockPrimaryAction"
              onClick={() => onFeedbackSubmit?.()}
              disabled={!feedbackLevel}
            >
              Valider la session
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
