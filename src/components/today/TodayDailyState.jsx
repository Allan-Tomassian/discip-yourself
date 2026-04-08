import React from "react";
import { TODAY_SCREEN_COPY } from "../../ui/labels";

function formatMinutes(value) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `${safe} min`;
}

function clampRatio(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export default function TodayDailyState({
  model = null,
  plannedMinutes = 0,
  doneMinutes = 0,
  doneBlocksCount = 0,
  plannedBlocksCount = 0,
  nextBlockLabel = "",
}) {
  const ratio = clampRatio(
    model?.ratio ??
      (plannedBlocksCount > 0
        ? doneBlocksCount / plannedBlocksCount
        : plannedMinutes > 0
          ? doneMinutes / plannedMinutes
          : 0)
  );
  const safeDoneBlocksCount = Number.isFinite(model?.doneBlocksCount) ? model.doneBlocksCount : doneBlocksCount;
  const safePlannedBlocksCount = Number.isFinite(model?.plannedBlocksCount)
    ? model.plannedBlocksCount
    : plannedBlocksCount;
  const safeDoneMinutes = Number.isFinite(model?.doneMinutes) ? model.doneMinutes : doneMinutes;
  const safeNextBlockLabel =
    typeof model?.nextBlockLabel === "string" && model.nextBlockLabel.trim()
      ? model.nextBlockLabel.trim()
      : nextBlockLabel || TODAY_SCREEN_COPY.progressNothingReady;
  const blocksSummary =
    safePlannedBlocksCount > 0
      ? `${safeDoneBlocksCount}/${safePlannedBlocksCount}`
      : `${safeDoneBlocksCount}`;
  const pipCount = 5;
  const filledPips = Math.max(
    safeDoneBlocksCount > 0 ? 1 : 0,
    Math.min(pipCount, Math.round(ratio * pipCount))
  );
  const summaryLabel = `${blocksSummary} validés`;
  const minutesLabel = formatMinutes(safeDoneMinutes);
  const nextLabel =
    safeNextBlockLabel && safeNextBlockLabel !== TODAY_SCREEN_COPY.progressNothingReady
      ? `Prochain: ${safeNextBlockLabel}`
      : TODAY_SCREEN_COPY.progressNothingReady;

  return (
    <div
      className="todayDailyState"
      data-testid="today-progress-strip"
      aria-label={`${summaryLabel}. ${minutesLabel}. ${nextLabel}.`}
    >
      <div className="todayDailyStateRail" aria-hidden="true">
        {Array.from({ length: pipCount }, (_, index) => (
          <span
            key={`pip-${index}`}
            className={`todayDailyStatePip${index < filledPips ? " is-active" : ""}`}
          />
        ))}
      </div>
      <div className="todayDailyStateSummaryLine">
        <span className="todayDailyStateSummaryItem">{summaryLabel}</span>
        <span className="todayDailyStateDivider" aria-hidden="true">·</span>
        <span className="todayDailyStateSummaryItem">{minutesLabel}</span>
        <span className="todayDailyStateDivider" aria-hidden="true">·</span>
        <span className="todayDailyStateNextLabel">{nextLabel}</span>
      </div>
    </div>
  );
}
