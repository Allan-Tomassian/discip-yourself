import React from "react";
import { AppCard, MetricRow } from "../../shared/ui/app";
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
    <AppCard
      className="todaySectionCard todayDailyStateCard"
      style={activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : undefined}
    >
      <div className="col todaySectionBody">
        <div className="todayDailyStateGrid">
          <AppCard className="todayDailyStateItem todayDailyStateMetric">
            <MetricRow className="todayDailyStateMetricRow" label="Prévu" value={formatMinutes(plannedMinutes)} />
          </AppCard>
          <AppCard className="todayDailyStateItem todayDailyStateMetric">
            <MetricRow className="todayDailyStateMetricRow" label="Fait" value={formatMinutes(doneMinutes)} />
          </AppCard>
          <AppCard className="todayDailyStateItem todayDailyStateMetric">
            <MetricRow className="todayDailyStateMetricRow" label="Restant" value={formatMinutes(remainingMinutes)} />
          </AppCard>
        </div>
      </div>
    </AppCard>
  );
}
