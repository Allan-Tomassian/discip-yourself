import React from "react";
import { AppCard, GhostButton, StatusBadge } from "../../shared/ui/app";
import CategoryPill from "../CategoryPill";
import { getCategoryUiVars } from "../../utils/categoryAccent";

export default function TodayNextActions({
  actions = [],
  onOpenOccurrence,
  activeCategory = null,
}) {
  const safeActions = Array.isArray(actions) ? actions.slice(0, 3) : [];

  return (
    <AppCard
      className="todaySectionCard todayNextActionsCard"
      style={activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : undefined}
    >
      <div className="todaySectionBody">
        {safeActions.length ? (
          <div className="todayNextActionsList">
            {safeActions.map((item) => (
              <div key={item.id} className="todayNextActionRow">
              <div className="todayNextActionTop">
                <div className="todayNextActionTime">{item.start || "Fenêtre libre"}</div>
                <CategoryPill
                  category={item.category || null}
                  color={item.category?.color || ""}
                  label={item.categoryName || "Catégorie"}
                />
              </div>
              <div className="todayNextActionTitleRow">
                <div className="todayNextActionTitle">{item.title || "Action"}</div>
                {item.isAiPriority ? (
                  <StatusBadge tone="info" className="todayHeroCoachBadge todayNextActionPriority">
                    Priorité IA
                  </StatusBadge>
                ) : null}
              </div>
              <div className="todayNextActionFooter">
                <div className="todayNextActionDuration">
                  {Number.isFinite(item.durationMinutes) ? `${item.durationMinutes} min` : "Durée libre"}
                </div>
                <GhostButton
                  type="button"
                  size="sm"
                  className="todayNextActionTrigger"
                  onClick={() => onOpenOccurrence?.(item)}
                >
                  Démarrer
                </GhostButton>
              </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="todayNextActionEmpty">
            <div className="todayNextActionEmptyTitle">Rien d’autre d’utile n’est prévu aujourd’hui.</div>
            <div className="todayNextActionEmptyMeta">
              Le reste du jour reste libre pour garder un rythme lisible.
            </div>
          </div>
        )}
      </div>
    </AppCard>
  );
}
