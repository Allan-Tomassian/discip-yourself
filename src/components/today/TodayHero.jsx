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
  actionProtocolBrief = [],
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
  const isValidated = stateTone === "validated";
  const briefItems = Array.isArray(actionProtocolBrief)
    ? actionProtocolBrief
        .filter((item) => item && typeof item.text === "string" && item.text.trim())
        .slice(0, 2)
    : [];
  const showTopline = !isValidated && Boolean(displayCategory || stateLabel);
  const showMeta = !isValidated && Boolean(timingLabel || durationLabel);
  const showReason = Boolean(displayReason) && (
    isPreparing ||
    stateTone === "clarify" ||
    stateTone === "overload" ||
    stateTone === "validated"
  );

  return (
    <div
      className={`lovableCard lovablePriorityCard todayShellHeroCard${isValidated ? " is-validated" : ""}`}
      data-testid="today-hero-card"
      style={!isValidated && categoryColor ? { "--today-hero-category-accent": categoryColor } : undefined}
    >
      {showTopline ? (
        <div className="todayShellHeroTopline">
          {displayCategory ? <div className="lovablePriorityEyebrow todayShellHeroEyebrow">{displayCategory}</div> : null}
          {stateLabel ? (
            <div className={`todayShellHeroState is-${stateTone}`}>
              {stateLabel}
            </div>
          ) : null}
        </div>
      ) : null}
      <h2 className="lovablePriorityTitle">{displayTitle}</h2>
      {showMeta ? (
        <div className="todayV2HeroMetaRow">
          {timingLabel ? <span className="todayV2HeroTiming">{timingLabel}</span> : null}
          {durationLabel ? <span className="todayV2HeroDuration">{durationLabel}</span> : null}
        </div>
      ) : null}
      {displaySupportLabel ? <div className="todayShellHeroGuide">{displaySupportLabel}</div> : null}
      {showReason ? <p className="lovablePriorityMeta">{displayReason}</p> : null}
      {briefItems.length ? (
        <div className="todayActionProtocol" data-testid="today-action-protocol">
          {briefItems.map((item) => (
            <div key={`${item.label}:${item.text}`} className="todayActionProtocolLine">
              <span className="todayActionProtocolLabel">{item.label}</span>
              <span className="todayActionProtocolText">{item.text}</span>
            </div>
          ))}
        </div>
      ) : null}
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
