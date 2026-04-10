import React from "react";
import { BehaviorCue } from "../../feedback/BehaviorFeedbackContext";
import { AppTextarea, GhostButton, PrimaryButton, ProgressBar } from "../../shared/ui/app";

function readMinuteLabel(value) {
  return Number.isFinite(value) && value > 0 ? `${value} min` : "";
}

function readRestLabel(value) {
  return Number.isFinite(value) && value > 0 ? `${Math.round(value)} s repos` : "";
}

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
  categoryName = "Catégorie",
  actionProtocol = null,
  guidedPlan = null,
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
  showAdjust = false,
  adjustMode = "standard",
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
  const protocolItems = actionProtocol
    ? [
        { label: "Pourquoi", text: actionProtocol.why },
        { label: "Départ", text: actionProtocol.firstStep },
        { label: "Si blocage", text: actionProtocol.ifBlocked },
        { label: "Réussi quand", text: actionProtocol.successDefinition },
      ].filter((item) => item.text)
    : [];
  const guidedSteps = Array.isArray(guidedPlan?.steps) ? guidedPlan.steps : [];
  const totalSteps = Math.max(1, Number(guidedPlan?.totalSteps || guidedSteps.length || 1));
  const currentStepIndex = Math.max(0, Number(guidedPlan?.currentStepIndex || 0));
  const currentStepItems = Array.isArray(guidedPlan?.currentStep?.items) ? guidedPlan.currentStep.items : [];
  const currentItem = guidedPlan?.currentItem || null;
  const currentItemMeta = [
    readMinuteLabel(currentItem?.minutes),
    readRestLabel(currentItem?.restSec),
    currentItem?.transitionLabel || "",
  ].filter(Boolean);
  const nextItem = guidedPlan?.nextItem || null;
  const previewItems = currentStepItems
    .filter((item) => item?.id && item.id !== currentItem?.id && item.state !== "done")
    .slice(0, 2);
  const runtimeStats = [
    { label: "Prévu", value: plannedDurationLabel },
    { label: "Écoulé", value: elapsedLabel },
    { label: "Reste", value: remainingLabel },
  ].filter((item) => item.value);
  const heroTimerLabel = timerLabel || remainingLabel || elapsedLabel || plannedDurationLabel || "00:00";

  return (
    <div className={`sessionRuntimeStack${guidedPlan && !isFinal ? " is-guided" : " is-standard"}`}>
      <div className="sessionRuntimeHero">
        <div className="sessionRuntimeTimer">{heroTimerLabel}</div>
        {guidedPlan && !isFinal ? (
          <div className="sessionRuntimeProgressRow">
            <div className="sessionRuntimeDots" aria-hidden="true">
              {renderProgressDots(totalSteps, currentStepIndex)}
            </div>
            <div className="sessionRuntimeProgressLabel">
              Étape {currentStepIndex + 1}/{totalSteps}
            </div>
          </div>
        ) : null}
        <div className="sessionRuntimeTitle">{title}</div>
        {!guidedPlan && categoryName ? (
          <div className="sessionRuntimeSubtitle">{categoryName}</div>
        ) : null}
      </div>

      {guidedPlan && !isFinal ? (
        <div className="sessionGuidedPlan" data-testid="session-guided-plan">
          <div className="sessionGuidedPlanEyebrow">Plan du bloc</div>
          {adjustmentSummary ? (
            <div className="sessionAdjustmentNotice" data-testid="session-adjustment-summary">
              <span className="sessionAdjustmentNoticeLabel">{adjustmentLabel || "Ajustée"}</span>
              <span className="sessionAdjustmentNoticeText">{adjustmentSummary}</span>
            </div>
          ) : null}
          <div className="sessionGuidedPlanCurrent">
            <div className="sessionGuidedPlanMeta">
              Étape {currentStepIndex + 1}/{totalSteps}
              {currentItem ? ` · Item ${Number(guidedPlan?.currentItemIndex || 0) + 1}/${Math.max(currentStepItems.length, 1)}` : ""}
            </div>
            <div className="sessionGuidedPlanTitle">{guidedPlan?.currentStep?.label || "Étape"}</div>
            {guidedPlan?.currentStep?.purpose ? (
              <div className="sessionGuidedPlanStepPurpose">{guidedPlan.currentStep.purpose}</div>
            ) : null}
            {currentItem ? (
              <div className="sessionGuidedPlanCurrentItem">
                <div className="sessionGuidedPlanCurrentItemLabel">{currentItem.label}</div>
                {currentItemMeta.length ? (
                  <div className="sessionGuidedPlanCurrentItemMeta">{currentItemMeta.join(" · ")}</div>
                ) : null}
                <div className="sessionGuidedPlanText">{currentItem.guidance}</div>
                {currentItem.successCue ? (
                  <div className="sessionGuidedPlanSuccessCue">{currentItem.successCue}</div>
                ) : null}
                <ProgressBar
                  className="sessionGuidedPlanProgress"
                  value01={guidedPlan?.currentItemProgress01 || 0}
                  tone="info"
                  label={readMinuteLabel(currentItem.minutes)}
                />
              </div>
            ) : null}
            {nextItem ? (
              <div className="sessionGuidedPlanNext">
                <div className="sessionGuidedPlanNextLabel">Ensuite</div>
                <div className="sessionGuidedPlanNextValue">{nextItem.label}</div>
                <div className="sessionGuidedPlanNextMeta">
                  {[nextItem.stepLabel, readMinuteLabel(nextItem.minutes)].filter(Boolean).join(" · ")}
                </div>
              </div>
            ) : null}
          </div>
          {previewItems.length ? (
            <div className="sessionGuidedPlanSteps">
              {previewItems.map((item, index) => (
                <div key={item.id || `${item.label}-${index}`} className="sessionGuidedPlanStep">
                  <div className="sessionGuidedPlanStepBody">
                    <span className="sessionGuidedPlanStepLabel">{item.label}</span>
                    {item.successCue ? (
                      <span className="sessionGuidedPlanStepText">{item.successCue}</span>
                    ) : item.guidance ? (
                      <span className="sessionGuidedPlanStepText">{item.guidance}</span>
                    ) : null}
                  </div>
                  <span className="sessionGuidedPlanStepMinutes">{readMinuteLabel(item.minutes)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : protocolItems.length ? (
        <div className="sessionRuntimeBrief" data-testid="session-action-protocol">
          <div className="sessionRuntimeBriefHeader">
            <div className="sessionRuntimeBriefTitle">Bloc prêt</div>
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

      {behaviorCue ? <div className="sessionBehaviorCueSlot"><BehaviorCue cue={behaviorCue} /></div> : null}

      {runtimeStats.length ? (
        <div className="sessionRuntimeMetaStrip">
          {runtimeStats.map((item) => (
            <div key={item.label} className="sessionRuntimeMetaItem">
              <div className="sessionRuntimeMetaLabel">{item.label}</div>
              <div className="sessionRuntimeMetaValue">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {!isFinal ? (
        <div className="sessionActionDock" data-testid="session-action-dock">
          {showAdjust ? (
            <GhostButton
              type="button"
              className={`sessionDockAdjustButton${adjustMode === "guided" ? " sessionDockAdjustButton--guided" : ""}`}
              onClick={() => onOpenAdjust?.()}
            >
              Réajuster
            </GhostButton>
          ) : null}
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
