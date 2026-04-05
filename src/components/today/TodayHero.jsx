import React from "react";

export default function TodayHero({
  title = "No main priority",
  reason = "",
  contributionLabel = "",
  recommendedCategoryLabel = "",
  primaryLabel = "Start Now",
  onPrimaryAction,
  canPrimaryAction = false,
  isPreparing = false,
}) {
  const displayTitle = title || (isPreparing ? "Preparing the next step" : "No main priority");
  const displayReason =
    reason || contributionLabel || (isPreparing ? "Reading your current context." : "No clear priority is available yet.");
  const displayCategory = recommendedCategoryLabel || "Main priority";

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
