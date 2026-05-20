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
  categoryName = "Catégorie",
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
  onReturnToday,
}) {
  const isFinal = viewState === "completed" || viewState === "blocked" || viewState === "reported";
  const isRunning = viewState === "running";
  const isPaused = viewState === "paused";
  const isGuided = Boolean(guidedPlan && !isFinal);
  const isGuidedPreview = isGuided && guidedMode === "preview";
  const isGuidedActive = isGuided && guidedMode === "active";
  const isCompleted = viewState === "completed";
  const isBlocked = viewState === "blocked";
  const isReported = viewState === "reported";
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
  const runtimeTone =
    isGuided ? "guided" : reportMode || isPaused || isReported ? "attention" : isBlocked ? "critical" : "standard";
  const runtimeStateClass = [
    "sessionRuntimeStack",
    `is-${runtimeTone}`,
    isRunning ? "is-running" : "",
    isPaused ? "is-paused" : "",
    showFeedback ? "is-feedback" : "",
    reportMode ? "is-reporting" : "",
    isCompleted ? "is-completed" : "",
    isBlocked ? "is-blocked" : "",
    isReported ? "is-reported" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const heroEyebrow = isGuided
    ? isGuidedPreview
      ? "GUIDÉ IA"
      : "COACH IA"
    : reportMode
      ? "REPORT"
      : showFeedback
        ? "VALIDATION"
        : isPaused
          ? "PAUSE COURTE"
          : isRunning
            ? "BLOC EN COURS"
            : isCompleted
              ? "SESSION"
              : isBlocked
                ? "BLOCAGE"
                : isReported
                  ? "REPORTÉ"
                  : "SESSION";
  const heroTitle = isGuided
    ? isGuidedPreview
      ? "Mode guidé disponible"
      : "Guidage actif"
    : reportMode
      ? "Reporter sans abandonner"
      : showFeedback
        ? "Bloc terminé ?"
        : isPaused
          ? "Pause courte"
          : isRunning
            ? "Bloc en cours"
            : isCompleted
              ? "Preuve validée."
              : isBlocked
                ? "Bloc interrompu"
                : isReported
                  ? "Bloc reporté"
                  : "Protège ce bloc.";
  const heroSubtitle = isGuided
    ? isGuidedPreview
      ? "Le Coach IA t’accompagne pour exécuter ce bloc avec clarté."
      : "Reste avec l’étape actuelle. Le reste peut attendre."
    : reportMode
      ? "Choisis une option saine. Reporter n’est pas abandonner."
      : showFeedback
        ? "Prends 30 secondes. Sois honnête."
        : isPaused
          ? "Reprends avant de renégocier."
          : isRunning
            ? "Reste sur la prochaine action utile."
            : isCompleted
              ? "Ton système a reçu une preuve d’exécution."
              : isBlocked
                ? "Le bloc est marqué comme bloqué."
                : isReported
                  ? "Ton système garde la trace du report."
                  : "Une seule action compte maintenant.";
  const primaryAction =
    isGuidedPreview
      ? {
          label: "Lancer en mode guidé",
          onClick: onStart,
          disabled: !canStart,
          className: "sessionDockPrimaryAction",
        }
      : isPaused
        ? {
            label: "Reprendre",
            onClick: onStart,
            disabled: !canStart,
            className: "sessionDockPrimaryAction sessionDockPrimaryAction--attention",
          }
        : isRunning
          ? {
              label: "Terminer le bloc",
              onClick: onComplete,
              disabled: !canComplete,
              className: "sessionDockPrimaryAction",
            }
          : !isFinal && !showFeedback && !reportMode
            ? {
                label: "Démarrer le bloc",
                onClick: onStart,
                disabled: !canStart,
                className: "sessionDockPrimaryAction",
              }
            : null;
  const showStandardDock = !isFinal && !showFeedback && !reportMode;
  const showFullStandardBrief = !isGuided && !isRunning && !isPaused && !showFeedback && !reportMode && !isFinal;
  const showCompactFocusBrief = !isGuided && (isRunning || isPaused);
  const focusInstruction = isPaused
    ? "Reprends avant de renégocier."
    : actionProtocol?.firstStep || "Reste sur la prochaine action utile.";
  const focusReason = actionProtocol?.why || "Ce bloc protège ton avancée du jour.";

  return (
    <div className={runtimeStateClass}>
      <div className="sessionRuntimeHero">
        <div className="sessionRuntimeHeroEyebrow">{heroEyebrow}</div>
        {isRunning ? (
          <div className="sessionRuntimeTimerShell" aria-label={`Temps restant ${heroTimerLabel}`}>
            <div className="sessionRuntimeTimer">{heroTimerLabel}</div>
            {plannedDurationLabel ? <div className="sessionRuntimeTimerTotal">/ {plannedDurationLabel}</div> : null}
          </div>
        ) : isPaused ? (
          <div className="sessionRuntimePauseMark" aria-hidden="true">
            <span />
            <span />
          </div>
        ) : isCompleted ? (
          <div className="sessionRuntimeSuccessMark" aria-hidden="true">✓</div>
        ) : null}
        {isGuided ? (
          <div className="sessionRuntimeProgressRow">
            <div className="sessionRuntimeDots" aria-hidden="true">
              {renderProgressDots(progressDotsTotal, progressDotsIndex)}
            </div>
            <div className="sessionRuntimeProgressLabel">{progressLabel}</div>
          </div>
        ) : null}
        <div className="sessionRuntimeTitle">{heroTitle}</div>
        <div className="sessionRuntimeSubtitle">{heroSubtitle}</div>
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
      ) : showFullStandardBrief ? (
        <div className="sessionRuntimeBrief" data-testid="session-action-protocol">
          <div className="sessionRuntimeBriefHeader">
            <div className="sessionRuntimeBriefEyebrowRow">
              <div className="sessionRuntimeBriefTitle">{title}</div>
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
            <div className="sessionRuntimeBriefRow">
              <div className="sessionRuntimeBriefLabel">Catégorie</div>
              <div className="sessionRuntimeBriefText">{categoryName || "Catégorie"}</div>
            </div>
            {plannedDurationLabel ? (
              <div className="sessionRuntimeBriefRow">
                <div className="sessionRuntimeBriefLabel">Durée</div>
                <div className="sessionRuntimeBriefText">{plannedDurationLabel}</div>
              </div>
            ) : null}
            {protocolItems.length ? (
              protocolItems.map((item) => (
                <div key={item.label} className="sessionRuntimeBriefRow">
                  <div className="sessionRuntimeBriefLabel">{item.label}</div>
                  <div className="sessionRuntimeBriefText">{item.text}</div>
                </div>
              ))
            ) : (
              <div className="sessionRuntimeBriefRow">
                <div className="sessionRuntimeBriefLabel">Pourquoi ça compte</div>
                <div className="sessionRuntimeBriefText">Ce bloc protège ton avancée du jour.</div>
              </div>
            )}
          </div>
        </div>
      ) : showCompactFocusBrief ? (
        <div
          className={`sessionRuntimeFocusCard${isPaused ? " is-attention" : ""}`}
          data-testid="session-action-protocol"
        >
          <div className="sessionRuntimeFocusEyebrow">{isPaused ? "PAUSE" : "TÂCHE EN COURS"}</div>
          <div className="sessionRuntimeFocusTitle">{title}</div>
          <div className="sessionRuntimeFocusMeta">
            <span>{categoryName || "Catégorie"}</span>
            {plannedDurationLabel ? <span>{plannedDurationLabel}</span> : null}
          </div>
          <div className="sessionRuntimeFocusInstruction">{focusInstruction}</div>
          <div className="sessionRuntimeFocusReason">{focusReason}</div>
        </div>
      ) : null}

      {runtimeStats.length && !isGuided && !showFeedback && !reportMode && !isFinal ? (
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

      {showStandardDock ? (
        <div
          className={`sessionActionDock${isGuided ? " sessionActionDock--guided" : " sessionActionDock--standard"}`}
          data-testid="session-action-dock"
        >
          {isGuidedPreview ? (
            <div className="sessionGuidedPreviewActions" data-testid="session-guided-preview-actions">
              <PrimaryButton
                type="button"
                className={primaryAction?.className || "sessionDockPrimaryAction"}
                onClick={() => primaryAction?.onClick?.()}
                disabled={primaryAction?.disabled}
              >
                {primaryAction?.label || "Lancer en mode guidé"}
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
                Session standard
              </button>
            </div>
          ) : showTools || (isGuided && showAdjust) ? (
            <div className={`sessionDockUtilityRow${showTools ? " has-tools" : ""}`}>
              {isGuided && showAdjust ? (
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
              {primaryAction ? (
                <div className="sessionDockPrimaryRow">
                  <PrimaryButton
                    type="button"
                    className={primaryAction.className}
                    onClick={() => primaryAction.onClick?.()}
                    disabled={primaryAction.disabled}
                  >
                    {primaryAction.label}
                  </PrimaryButton>
                </div>
              ) : null}
              <div className="sessionDockSecondaryRow">
                {isRunning ? (
                  <GhostButton
                    type="button"
                    className="sessionDockSecondaryAction sessionDockSecondaryAction--attention"
                    onClick={() => onPause?.()}
                    disabled={!canPause}
                  >
                    Pause
                  </GhostButton>
                ) : null}
                {isPaused ? (
                  <GhostButton
                    type="button"
                    className="sessionDockSecondaryAction sessionDockSecondaryAction--attention"
                    onClick={() => onOpenReport?.()}
                    disabled={!canComplete}
                  >
                    Reporter
                  </GhostButton>
                ) : null}
                {!isRunning && !isPaused && showAdjust ? (
                  <GhostButton
                    type="button"
                    className="sessionDockSecondaryAction"
                    onClick={() => onOpenAdjust?.()}
                  >
                    Ajuster
                  </GhostButton>
                ) : null}
                {isRunning ? (
                  <GhostButton
                    type="button"
                    className="sessionDockSecondaryAction"
                    onClick={() => onOpenAdjust?.()}
                    disabled={!showAdjust}
                  >
                    Ajuster
                  </GhostButton>
                ) : null}
                {!isRunning && !isPaused ? (
                  <GhostButton
                    type="button"
                    className="sessionDockSecondaryAction sessionDockSecondaryAction--attention"
                    onClick={() => onOpenReport?.()}
                    disabled={!canComplete}
                  >
                    Reporter
                  </GhostButton>
                ) : null}
                <PrimaryButton
                  type="button"
                  className="sessionDockDangerAction"
                  onClick={() => onBlock?.()}
                  disabled={!canComplete}
                >
                  Bloquer
                </PrimaryButton>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {isFinal ? (
        <div className="sessionCompletionSurface">
          <div className="sessionCompletionEyebrow">
            {isCompleted ? "VALIDÉ" : isReported ? "REPORTÉ" : "INTERRUPTION"}
          </div>
          <div className="sessionCompletionTitle">
            {isCompleted ? "Preuve validée." : isReported ? "Bloc reporté proprement." : "Bloc marqué comme bloqué."}
          </div>
          <div className="sessionCompletionCopy">
            {isCompleted
              ? "Le progrès est revenu dans ton système."
              : isReported
                ? "Le report est enregistré. Tu peux revenir au cockpit."
                : "Le bloc est conservé pour être repris ou ajusté."}
          </div>
          <PrimaryButton type="button" className="sessionDockPrimaryAction" onClick={() => onReturnToday?.()}>
            Retour à Today
          </PrimaryButton>
        </div>
      ) : null}

      {reportMode ? (
        <div className="sessionSupplementCard sessionSupplementCard--report">
          <div className="sessionSupplementEyebrow">REPORT</div>
          <div className="sessionSupplementTitle">Reporter sans abandonner</div>
          <div className="sessionSupplementHint">Choisis une option saine. Le bloc reste dans ton système.</div>
          <div className="sessionSupplementActions">
            <button type="button" className="sessionReportOption" onClick={() => onChooseReport?.("later_today")}>
              <span>
                <strong>Plus tard aujourd’hui</strong>
                <small>Replanifier ce bloc.</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
            <button type="button" className="sessionReportOption" onClick={() => onChooseReport?.("tomorrow")}>
              <span>
                <strong>Demain</strong>
                <small>Le replacer demain.</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
            <button type="button" className="sessionReportOption" onClick={() => onChooseReport?.("planning")}>
              <span>
                <strong>Choisir dans le planning</strong>
                <small>Reprendre le contrôle de l’horaire.</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      ) : null}

      {showFeedback ? (
        <div className="sessionSupplementCard sessionSupplementCard--feedback">
          <div className="sessionSupplementEyebrow">VALIDATION</div>
          <div className="sessionSupplementTitle">Bloc terminé ?</div>
          <div className="sessionSupplementHint">Quel niveau d’effort as-tu donné ?</div>
          <div className="sessionSupplementActions sessionSupplementActions--feedback">
            {["facile", "normal", "difficile"].map((level) => (
              <button
                key={level}
                type="button"
                className={`sessionFeedbackChoice${feedbackLevel === level ? " is-selected" : ""}`}
                onClick={() => onFeedbackLevelChange?.(level)}
              >
                {level}
              </button>
            ))}
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
