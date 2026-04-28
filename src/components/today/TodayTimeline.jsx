import React from "react";
import { Check } from "lucide-react";
import CommandSurface from "./CommandSurface";

export default function TodayTimeline({
  items = [],
  progressLabel = "--%",
  onSelectItem,
}) {
  const safeItems = Array.isArray(items) ? items.filter((item) => item?.id).slice(0, 6) : [];
  const displayItems = safeItems.length
    ? safeItems
    : [
        {
          id: "empty",
          timeLabel: "--:--",
          title: "Planning à structurer",
          status: "empty",
        },
      ];

  return (
    <CommandSurface className="todayTimelineCard" tone="timeline" data-testid="today-timeline-card">
      <div className="todayTimelineHeader">
        <span>Timeline du jour</span>
      </div>

      <div className="todayTimelineViewport">
        <div className="todayTimelineTrack" role="list" aria-label="Timeline du jour">
          {displayItems.map((item) => {
            const complete = item.status === "done";
            const active = item.status === "active" || item.status === "in_progress";
            const empty = item.status === "empty";
            return (
              <button
                key={item.id}
                type="button"
                className={`todayTimelinePoint${complete ? " is-done" : ""}${active ? " is-active" : ""}${empty ? " is-empty" : ""}`}
                onClick={() => (!empty ? onSelectItem?.(item) : undefined)}
                disabled={empty}
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
          <span className="todayTimelineProgressEnd" aria-label={`Progression ${progressLabel}`}>
            {progressLabel}
          </span>
        </div>
      </div>
    </CommandSurface>
  );
}
