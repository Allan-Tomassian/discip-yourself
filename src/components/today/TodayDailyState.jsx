import React from "react";
import { GateSection } from "../../shared/ui/gate/Gate";

function formatMinutes(value) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `${safe} min`;
}

export default function TodayDailyState({
  plannedMinutes = 0,
  doneMinutes = 0,
  remainingMinutes = 0,
}) {
  return (
    <GateSection className="GateSurfacePremium GateCardPremium" collapsible={false}>
      <div className="col" style={{ gap: 12 }}>
        <div>
          <div className="titleSm">État du jour</div>
          <div className="small2" style={{ opacity: 0.8 }}>Résumé compact de la charge et de l’exécution.</div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          <div className="listItem GateRowPremium">
            <div className="small2">Planifié</div>
            <div className="titleSm">{formatMinutes(plannedMinutes)}</div>
          </div>
          <div className="listItem GateRowPremium">
            <div className="small2">Réalisé</div>
            <div className="titleSm">{formatMinutes(doneMinutes)}</div>
          </div>
          <div className="listItem GateRowPremium">
            <div className="small2">Restant</div>
            <div className="titleSm">{formatMinutes(remainingMinutes)}</div>
          </div>
        </div>
      </div>
    </GateSection>
  );
}
