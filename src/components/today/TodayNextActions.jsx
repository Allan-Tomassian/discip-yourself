import React from "react";
import { GateButton, GateSection } from "../../shared/ui/gate/Gate";

export default function TodayNextActions({
  actions = [],
  onOpenOccurrence,
}) {
  const safeActions = Array.isArray(actions) ? actions.slice(0, 3) : [];

  return (
    <GateSection className="GateSurfacePremium GateCardPremium" collapsible={false}>
      <div className="col" style={{ gap: 12 }}>
        <div>
          <div className="titleSm">À venir aujourd’hui</div>
          <div className="small2" style={{ opacity: 0.8 }}>3 créneaux maximum, triés par heure.</div>
        </div>
        {safeActions.length ? (
          safeActions.map((item) => (
            <div
              key={item.id}
              className="listItem GateRowPremium"
              style={{ display: "grid", gap: 6 }}
            >
              <div className="small2" style={{ opacity: 0.78 }}>
                {[item.start || "Fenêtre libre", item.categoryName || "Catégorie"].filter(Boolean).join(" • ")}
              </div>
              <div className="itemTitle">{item.title || "Action"}</div>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div className="small2" style={{ opacity: 0.82 }}>
                  {Number.isFinite(item.durationMinutes) ? `${item.durationMinutes} min` : "Durée libre"}
                </div>
                <GateButton
                  type="button"
                  variant="ghost"
                  className="GatePressable"
                  withSound
                  onClick={() => onOpenOccurrence?.(item)}
                >
                  Ouvrir
                </GateButton>
              </div>
            </div>
          ))
        ) : (
          <div className="small2">Aucune autre occurrence restante aujourd’hui.</div>
        )}
      </div>
    </GateSection>
  );
}
