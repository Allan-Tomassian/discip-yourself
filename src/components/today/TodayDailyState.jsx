import React from "react";
import { MetricRow } from "../../shared/ui/app";
import { getCategoryUiVars } from "../../utils/categoryAccent";

function formatMinutes(value) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `${safe} min`;
}

export default function TodayDailyState({
  plannedMinutes = 0,
  doneMinutes = 0,
  remainingMinutes = 0,
  activeCategory = null,
}) {
  return (
    <div
      className="todayDailyState"
      style={activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : undefined}
    >
      <div className="todayDailyStateGrid">
        <div className="todayDailyStateMetricCell">
          <MetricRow className="todayDailyStateMetricRow" label="Prévu" value={formatMinutes(plannedMinutes)} />
        </div>
        <div className="todayDailyStateMetricCell">
          <MetricRow className="todayDailyStateMetricRow" label="Fait" value={formatMinutes(doneMinutes)} />
        </div>
        <div className="todayDailyStateMetricCell">
          <MetricRow className="todayDailyStateMetricRow" label="Restant" value={formatMinutes(remainingMinutes)} />
        </div>
      </div>
    </div>
  );
}
