import React from "react";
import { GateButton, GateSection } from "../../shared/ui/gate/Gate";
import CategoryPill from "../CategoryPill";
import { getCategoryUiVars } from "../../utils/categoryAccent";

export default function TodayNextActions({
  actions = [],
  onOpenOccurrence,
  activeCategory = null,
}) {
  const safeActions = Array.isArray(actions) ? actions.slice(0, 3) : [];

  return (
    <GateSection
      className="GateMainSection todaySectionCard GateSurfacePremium GateCardPremium"
      collapsible={false}
      style={activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : undefined}
    >
      <div className="col todaySectionBody">
        <div className="todaySectionHeader">
          <div className="titleSm">À venir aujourd’hui</div>
          <div className="small2" style={{ opacity: 0.8 }}>3 créneaux maximum, triés par heure.</div>
        </div>
        {safeActions.length ? (
          safeActions.map((item) => (
            <div
              key={item.id}
              className="listItem GateRowPremium todayNextActionItem"
            >
              <div className="todayNextActionTop">
                <div className="todayNextActionTime">{item.start || "Fenêtre libre"}</div>
                <CategoryPill
                  category={item.category || null}
                  color={item.category?.color || ""}
                  label={item.categoryName || "Catégorie"}
                />
              </div>
              <div className="todayNextActionTitleRow">
                <div className="itemTitle todayNextActionTitle">{item.title || "Action"}</div>
                {item.isAiPriority ? (
                  <span className="todayHeroCoachBadge is-ai">Priorité IA</span>
                ) : null}
              </div>
              <div className="todayNextActionFooter">
                <div className="small2 todayNextActionDuration">
                  {Number.isFinite(item.durationMinutes) ? `${item.durationMinutes} min` : "Durée libre"}
                </div>
                <GateButton
                  type="button"
                  variant="ghost"
                  className="GatePressable"
                  withSound
                  onClick={() => onOpenOccurrence?.(item)}
                >
                  Démarrer
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
