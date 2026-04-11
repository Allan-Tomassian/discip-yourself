import React, { useEffect, useRef } from "react";
import { GhostButton, ProgressBar } from "../../shared/ui/app";

function readMinuteLabel(value) {
  return Number.isFinite(value) && value > 0 ? `${value} min` : "";
}

function readRestLabel(value) {
  return Number.isFinite(value) && value > 0 ? `${Math.round(value)} s repos` : "";
}

function readStepStatus(step, mode) {
  if (mode === "preview") return "Aperçu";
  if (step.isActive) return "Active";
  if (step.state === "done") return "Terminée";
  return "À venir";
}

function readProgressKindLabel(step) {
  if (step.progressKind === "timed") return "Rythme guidé";
  if (step.progressKind === "checklist") return "Checklist";
  return "Ouverte";
}

function SessionChecklistRow({ item, interactive = false, onToggle }) {
  const className = `sessionGuidedChecklistRow${item.checked ? " is-checked" : ""}${
    interactive ? " is-interactive" : ""
  }`;

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        onClick={onToggle}
        aria-pressed={item.checked === true}
      >
        <span className="sessionGuidedChecklistMarker" aria-hidden="true" />
        <span className="sessionGuidedChecklistText">
          <span className="sessionGuidedChecklistLabel">{item.label}</span>
          <span className="sessionGuidedChecklistHint">{item.guidance}</span>
        </span>
      </button>
    );
  }

  return (
    <div className={className}>
      <span className="sessionGuidedChecklistMarker" aria-hidden="true" />
      <span className="sessionGuidedChecklistText">
        <span className="sessionGuidedChecklistLabel">{item.label}</span>
        <span className="sessionGuidedChecklistHint">{item.guidance}</span>
      </span>
    </div>
  );
}

function SessionGuidedPreviewRows({ step }) {
  return (
    <div className="sessionGuidedPreviewRows">
      {step.items.slice(0, 4).map((item) => (
        <div key={item.id} className="sessionGuidedPreviewRow">
          <div className="sessionGuidedPreviewRowText">
            <div className="sessionGuidedPreviewRowLabel">{item.label}</div>
            <div className="sessionGuidedPreviewRowHint">{item.guidance}</div>
          </div>
          <div className="sessionGuidedPreviewRowMeta">{readMinuteLabel(item.minutes)}</div>
        </div>
      ))}
    </div>
  );
}

function SessionGuidedTimedBody({ step, isActive }) {
  const currentItemMeta = [
    readMinuteLabel(step.currentItem?.minutes),
    readRestLabel(step.currentItem?.restSec),
    step.currentItem?.transitionLabel || "",
  ].filter(Boolean);

  if (!isActive) {
    return <SessionGuidedPreviewRows step={step} />;
  }

  return (
    <div className="sessionGuidedStepBody">
      {step.currentItem ? (
        <div className="sessionGuidedStepCurrentItem">
          <div className="sessionGuidedStepCurrentLabel">{step.currentItem.label}</div>
          {currentItemMeta.length ? (
            <div className="sessionGuidedStepCurrentMeta">{currentItemMeta.join(" · ")}</div>
          ) : null}
          <div className="sessionGuidedStepCurrentText">{step.currentItem.guidance}</div>
          {step.currentItem.successCue ? (
            <div className="sessionGuidedStepCurrentCue">{step.currentItem.successCue}</div>
          ) : null}
          <ProgressBar
            className="sessionGuidedStepCurrentProgress"
            value01={step.currentItemProgress01 || 0}
            tone="info"
            label={step.progressLabel}
          />
        </div>
      ) : null}
      {step.nextItem ? (
        <div className="sessionGuidedStepNext">
          <div className="sessionGuidedStepNextLabel">Ensuite</div>
          <div className="sessionGuidedStepNextValue">{step.nextItem.label}</div>
          <div className="sessionGuidedStepNextMeta">
            {[step.nextItem.stepLabel, readMinuteLabel(step.nextItem.minutes)].filter(Boolean).join(" · ")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SessionGuidedChecklistBody({
  step,
  isActive,
  onToggleChecklistItem,
  onAdvanceStep,
}) {
  return (
    <div className="sessionGuidedStepBody">
      <div className="sessionGuidedStepChecklistMeta">{step.progressLabel}</div>
      <div className="sessionGuidedChecklistRows">
        {step.items.map((item) => (
          <SessionChecklistRow
            key={item.id}
            item={item}
            interactive={isActive}
            onToggle={() => onToggleChecklistItem?.(step.id, item.id)}
          />
        ))}
      </div>
      {isActive ? (
        <GhostButton type="button" className="sessionGuidedStepInlineAction" onClick={onAdvanceStep}>
          Étape terminée
        </GhostButton>
      ) : null}
    </div>
  );
}

function SessionGuidedOpenBody({ step, isActive, onAdvanceStep }) {
  return (
    <div className="sessionGuidedStepBody">
      <SessionGuidedPreviewRows step={step} />
      {step.successCue ? <div className="sessionGuidedStepOpenCue">{step.successCue}</div> : null}
      {isActive ? (
        <GhostButton type="button" className="sessionGuidedStepInlineAction" onClick={onAdvanceStep}>
          Étape terminée
        </GhostButton>
      ) : null}
    </div>
  );
}

function SessionGuidedSlide({
  step,
  totalSteps = 1,
  mode = "preview",
  onToggleChecklistItem,
  onAdvanceStep,
}) {
  const isActive = mode === "active" && step.isActive;

  return (
    <article
      className={`sessionGuidedSlide${step.isViewed ? " is-viewed" : ""}${isActive ? " is-active" : ""}`}
      data-testid={step.isViewed ? "session-guided-slide-viewed" : undefined}
    >
      <div className="sessionGuidedSlideHeader">
        <div className="sessionGuidedSlideMeta">
          <span>Étape {step.stepIndex + 1}/{totalSteps}</span>
          <span>{readProgressKindLabel(step)}</span>
        </div>
        <div className="sessionGuidedSlideStatus">{readStepStatus(step, mode)}</div>
      </div>
      <div className="sessionGuidedSlideTitle">{step.label}</div>
      {step.purpose ? <div className="sessionGuidedSlidePurpose">{step.purpose}</div> : null}
      {step.progressKind === "timed" ? (
        <SessionGuidedTimedBody step={step} isActive={isActive} />
      ) : step.progressKind === "checklist" ? (
        <SessionGuidedChecklistBody
          step={step}
          isActive={isActive}
          onToggleChecklistItem={onToggleChecklistItem}
          onAdvanceStep={onAdvanceStep}
        />
      ) : (
        <SessionGuidedOpenBody step={step} isActive={isActive} onAdvanceStep={onAdvanceStep} />
      )}
      {step.successCue && step.progressKind !== "open" && !isActive ? (
        <div className="sessionGuidedSlideCue">{step.successCue}</div>
      ) : null}
    </article>
  );
}

export default function SessionGuidedDeck({
  plan = null,
  loading = false,
  onViewStep,
  onReturnToActiveStep,
  onToggleChecklistItem,
  onAdvanceStep,
}) {
  const trackRef = useRef(null);
  const lastNotifiedIndexRef = useRef(0);

  useEffect(() => {
    if (!plan || !trackRef.current) return;
    lastNotifiedIndexRef.current = plan.viewedStepIndex;
    const track = trackRef.current;
    const slideWidth = track.clientWidth || 1;
    const nextLeft = slideWidth * plan.viewedStepIndex;
    if (Math.abs(track.scrollLeft - nextLeft) < 2) return;
    track.scrollTo({ left: nextLeft, behavior: "auto" });
  }, [plan]);

  if (!plan) return null;

  const handleScroll = () => {
    if (!trackRef.current) return;
    const track = trackRef.current;
    const slideWidth = track.clientWidth || 1;
    const nextIndex = Math.round(track.scrollLeft / slideWidth);
    if (nextIndex === lastNotifiedIndexRef.current) return;
    lastNotifiedIndexRef.current = nextIndex;
    onViewStep?.(nextIndex);
  };

  return (
    <div className="sessionGuidedPlan" data-testid="session-guided-plan">
      <div className="sessionGuidedPlanEyebrow">Plan du bloc</div>
      {plan.mode === "active" && plan.canReturnToActiveStep ? (
        <div className="sessionGuidedPlanNotice" data-testid="session-guided-active-step-notice">
          <div className="sessionGuidedPlanNoticeText">
            Étape active: {plan.activeStepIndex + 1}/{plan.totalSteps}
          </div>
          <GhostButton type="button" size="sm" onClick={onReturnToActiveStep}>
            Recentrer
          </GhostButton>
        </div>
      ) : null}
      <div
        ref={trackRef}
        className={`sessionGuidedSlidesTrack${loading ? " is-locked" : ""}`}
        data-testid="session-guided-slide-track"
        onScroll={handleScroll}
      >
        {plan.steps.map((step, index) => (
          <div key={step.id || `step-${index}`} className="sessionGuidedSlideFrame">
            <SessionGuidedSlide
              step={{ ...step, stepIndex: index }}
              totalSteps={plan.totalSteps}
              mode={plan.mode}
              onToggleChecklistItem={onToggleChecklistItem}
              onAdvanceStep={onAdvanceStep}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
