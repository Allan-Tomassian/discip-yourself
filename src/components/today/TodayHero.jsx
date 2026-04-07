import React from "react";
import { TODAY_SCREEN_COPY } from "../../ui/labels";

export default function TodayHero({
  title = TODAY_SCREEN_COPY.noPriorityTitle,
  reason = "",
  contributionLabel = "",
  recommendedCategoryLabel = "",
  durationLabel = "",
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

  return (
    <div className="lovableCard lovablePriorityCard">
      <div className="lovablePriorityEyebrow">{displayCategory}</div>
      <h2 className="lovablePriorityTitle">{displayTitle}</h2>
      {durationLabel ? (
        <div className="todayV2HeroMetaRow">
          <span className="todayV2HeroDuration">{durationLabel}</span>
        </div>
      ) : null}
      <p className="lovablePriorityMeta">{displayReason}</p>
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
