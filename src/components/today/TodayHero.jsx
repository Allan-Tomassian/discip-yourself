import React from "react";
import { TODAY_SCREEN_COPY } from "../../ui/labels";

export default function TodayHero({
  title = TODAY_SCREEN_COPY.noPriorityTitle,
  reason = "",
  contributionLabel = "",
  recommendedCategoryLabel = "",
  primaryLabel = TODAY_SCREEN_COPY.primaryAction,
  onPrimaryAction,
  canPrimaryAction = false,
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
      <p className="lovablePriorityMeta">{displayReason}</p>
      <button
        type="button"
        className="lovablePrimaryButton"
        onClick={() => onPrimaryAction?.()}
        disabled={!canPrimaryAction}
      >
        {primaryLabel}
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
