import React from "react";
import { Check } from "lucide-react";
import CommandSurface from "./CommandSurface";

export default function TodayTimeline({
  state = "neutral",
  tone = "neutral",
  motionIntensity = "normal",
  timelineMode = "normal",
  items = [],
  progressLabel = "--%",
  onSelectItem,
}) {
  const safeItems = Array.isArray(items) ? items.filter((item) => item?.id).slice(0, 6) : [];
  const hasReliableTimeline = safeItems.length > 0 && timelineMode !== "disabled" && timelineMode !== "empty";
  const safeProgressLabel = String(progressLabel || "").trim();
  const showProgressLabel = hasReliableTimeline || (safeProgressLabel && safeProgressLabel !== "--%");
  const displayItems = safeItems.length
    ? safeItems
    : [
        {
          id: "empty",
          timeLabel: "--:--",
          title: timelineMode === "disabled" ? "Données indisponibles" : "Planning à structurer",
          status: "empty",
        },
      ];
  const className = [
    "todayTimelineCard",
    state ? `today-state-${state}` : "",
    tone ? `today-tone-${tone}` : "",
    motionIntensity ? `today-motion-${motionIntensity}` : "",
    timelineMode ? `is-timeline-${timelineMode}` : "",
    !hasReliableTimeline ? "has-placeholder-timeline" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const disabledTimeline = timelineMode === "disabled";

  return (
    <CommandSurface className={className} tone="timeline" data-testid="today-timeline-card">
      <div className="todayTimelineHeader">
        <span>Timeline du jour</span>
      </div>

      <div className="todayTimelineViewport">
        <div className="todayTimelineTrack" role="list" aria-label="Timeline du jour">
          {displayItems.map((item) => {
            const complete = item.status === "done";
            const active = item.status === "active" || item.status === "in_progress";
            const empty = item.status === "empty";
            const late = item.status === "late";
            const postponed = item.status === "postponed";
            const disabled = empty || disabledTimeline;
            return (
              <button
                key={item.id}
                type="button"
                className={`todayTimelinePoint${complete ? " is-done" : ""}${active ? " is-active" : ""}${late ? " is-late" : ""}${postponed ? " is-postponed" : ""}${empty ? " is-empty" : ""}`}
                onClick={() => (!disabled ? onSelectItem?.(item) : undefined)}
                disabled={disabled}
                role="listitem"
              >
                <span className="todayTimelinePointTime">{item.timeLabel}</span>
                <span className="todayTimelinePointTitle">{item.title}</span>
                <span className="todayTimelinePointMarker" aria-hidden="true">
                  {complete ? <Check size={12} strokeWidth={2.4} /> : null}
                </span>
              </button>
            );
          })}
          {showProgressLabel ? (
            <span className="todayTimelineProgressEnd" aria-label={`Progression ${safeProgressLabel}`}>
              {safeProgressLabel}
            </span>
          ) : null}
        </div>
      </div>
    </CommandSurface>
  );
}
