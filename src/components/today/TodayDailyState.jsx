import React from "react";
import { GateSection } from "../../shared/ui/gate/Gate";
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
    <GateSection
      className="GateMainSection GateSecondarySectionCard todaySectionCard todayDailyStateCard GateSurfacePremium GateCardPremium"
      collapsible={false}
      style={activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : undefined}
    >
      <div className="col todaySectionBody">
        <div className="todayDailyStateGrid">
          <div className="listItem GateRowPremium GateAnalyticsCard todayDailyStateItem todayDailyStateMetric">
            <div className="small2 GateRoleMetricLabel">Prévu</div>
            <div className="titleSm GateRoleMetricValue">{formatMinutes(plannedMinutes)}</div>
          </div>
          <div className="listItem GateRowPremium GateAnalyticsCard todayDailyStateItem todayDailyStateMetric">
            <div className="small2 GateRoleMetricLabel">Fait</div>
            <div className="titleSm GateRoleMetricValue">{formatMinutes(doneMinutes)}</div>
          </div>
          <div className="listItem GateRowPremium GateAnalyticsCard todayDailyStateItem todayDailyStateMetric">
            <div className="small2 GateRoleMetricLabel">Restant</div>
            <div className="titleSm GateRoleMetricValue">{formatMinutes(remainingMinutes)}</div>
          </div>
        </div>
      </div>
    </GateSection>
  );
}
