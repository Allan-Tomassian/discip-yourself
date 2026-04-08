import React from "react";
import { TODAY_SCREEN_COPY } from "../../ui/labels";

export default function TodayHero({
  title = TODAY_SCREEN_COPY.noPriorityTitle,
  reason = "",
  contributionLabel = "",
  recommendedCategoryLabel = "",
  categoryColor = "",
  durationLabel = "",
  timingLabel = "",
  stateLabel = "",
  stateTone = "ready",
  supportLabel = "",
  primaryLabel = TODAY_SCREEN_COPY.primaryAction,
  secondaryLabel = "",
  onPrimaryAction,
  onSecondaryAction,
  canPrimaryAction = false,
  canSecondaryAction = false,
  isPreparing = false,
}) {
  const displayTitle =
    title || (isPreparing ? TODAY_SCREEN_COPY.preparingTitle : TODAY_SCREEN_COPY.noPriorityTitle);
  const displayReason =
    reason ||
    contributionLabel ||
    (isPreparing ? TODAY_SCREEN_COPY.preparingReason : TODAY_SCREEN_COPY.noPriorityReason);
  const displayCategory = recommendedCategoryLabel || TODAY_SCREEN_COPY.priorityCategoryFallback;
  const displaySupportLabel = supportLabel || "";
  const showReason = Boolean(displayReason) && (
    isPreparing ||
    stateTone === "clarify" ||
    stateTone === "overload" ||
    stateTone === "validated"
  );

  return (
    <div
      className="lovableCard lovablePriorityCard todayShellHeroCard"
      data-testid="today-hero-card"
      style={categoryColor ? { "--today-hero-category-accent": categoryColor } : undefined}
    >
      <div className="todayShellHeroTopline">
        <div className="lovablePriorityEyebrow todayShellHeroEyebrow">{displayCategory}</div>
        {stateLabel ? (
          <div className={`todayShellHeroState is-${stateTone}`}>
            {stateLabel}
          </div>
        ) : null}
      </div>
      <h2 className="lovablePriorityTitle">{displayTitle}</h2>
      {timingLabel || durationLabel ? (
        <div className="todayV2HeroMetaRow">
          {timingLabel ? <span className="todayV2HeroTiming">{timingLabel}</span> : null}
          {durationLabel ? <span className="todayV2HeroDuration">{durationLabel}</span> : null}
        </div>
      ) : null}
      {displaySupportLabel ? <div className="todayShellHeroGuide">{displaySupportLabel}</div> : null}
      {showReason ? <p className="lovablePriorityMeta">{displayReason}</p> : null}
      <div className="todayV2HeroActions">
        <button
          type="button"
          className="lovablePrimaryButton"
          onClick={() => onPrimaryAction?.()}
          disabled={!canPrimaryAction}
        >
          {primaryLabel}
          <span aria-hidden="true">→</span>
        </button>
        {secondaryLabel ? (
          <button
            type="button"
            className="lovableGhostButton todayV2HeroSecondaryButton"
            onClick={() => onSecondaryAction?.()}
            disabled={!canSecondaryAction}
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
