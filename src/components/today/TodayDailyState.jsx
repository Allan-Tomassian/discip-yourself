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
      className="GateMainSection todaySectionCard GateSurfacePremium GateCardPremium"
      collapsible={false}
      style={activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : undefined}
    >
      <div className="col todaySectionBody">
        <div className="todaySectionHeader">
          <div className="titleSm">État du jour</div>
          <div className="small2" style={{ opacity: 0.8 }}>Résumé compact de la charge et de l’exécution.</div>
        </div>
        <div
          className="todayDailyStateGrid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          <div className="listItem GateRowPremium todayDailyStateItem">
            <div className="small2">Planifié</div>
            <div className="titleSm">{formatMinutes(plannedMinutes)}</div>
          </div>
          <div className="listItem GateRowPremium todayDailyStateItem">
            <div className="small2">Réalisé</div>
            <div className="titleSm">{formatMinutes(doneMinutes)}</div>
          </div>
          <div className="listItem GateRowPremium todayDailyStateItem">
            <div className="small2">Restant</div>
            <div className="titleSm">{formatMinutes(remainingMinutes)}</div>
          </div>
        </div>
      </div>
    </GateSection>
  );
}
