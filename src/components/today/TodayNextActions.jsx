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
      className="GateMainSection GateSecondarySectionCard todaySectionCard todayNextActionsCard GateSurfacePremium GateCardPremium"
      collapsible={false}
      style={activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : undefined}
    >
      <div className="col todaySectionBody">
        {safeActions.length ? (
          safeActions.map((item) => (
            <div
              key={item.id}
              className="listItem GateRowPremium GateInlineMetaCard todayNextActionItem"
            >
              <div className="todayNextActionTop">
                <div className="todayNextActionTime GateRoleCardMeta">{item.start || "Fenêtre libre"}</div>
                <CategoryPill
                  category={item.category || null}
                  color={item.category?.color || ""}
                  label={item.categoryName || "Catégorie"}
                />
              </div>
              <div className="todayNextActionTitleRow">
                <div className="itemTitle GateRoleCardTitle todayNextActionTitle">{item.title || "Action"}</div>
                {item.isAiPriority ? (
                  <span className="todayHeroCoachBadge is-ai">Priorité IA</span>
                ) : null}
              </div>
              <div className="todayNextActionFooter">
                <div className="small2 GateRoleCardMeta todayNextActionDuration">
                  {Number.isFinite(item.durationMinutes) ? `${item.durationMinutes} min` : "Durée libre"}
                </div>
                <GateButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="GatePressable todayNextActionTrigger"
                  withSound
                  onClick={() => onOpenOccurrence?.(item)}
                >
                  Démarrer
                </GateButton>
              </div>
            </div>
          ))
        ) : (
          <div className="todayNextActionEmpty GateInlineMetaCard">
            <div className="small2 GateRoleCardMeta">Rien d’autre d’utile n’est prévu aujourd’hui.</div>
            <div className="small2 textMuted2">Le reste du jour reste libre pour garder un rythme lisible.</div>
          </div>
        )}
      </div>
    </GateSection>
  );
}
