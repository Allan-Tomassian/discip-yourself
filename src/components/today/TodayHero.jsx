import React from "react";
import { GateButton, GateSection } from "../../shared/ui/gate/Gate";

function buildBadges({ isAiRecommendation, isFresh }) {
  const badges = [];
  if (isAiRecommendation) badges.push("Recommandation IA");
  if (isFresh) badges.push("Mis à jour récemment");
  return badges;
}

export default function TodayHero({
  title = "Aucune action prioritaire",
  categoryName = "",
  durationLabel = "",
  reason = "",
  onStart,
  onOpenPlanning,
  canStart = false,
  isAiRecommendation = false,
  isFresh = false,
}) {
  const badges = buildBadges({ isAiRecommendation, isFresh });

  return (
    <GateSection className="todayHeroCard GateSurfacePremium GateCardPremium" collapsible={false}>
      <div className="todayHeroHeader">
        <div className="todayHeroHeaderCluster">
          <div className="todayHeroKicker">Priorité du moment</div>
          {badges.length ? (
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              {badges.map((badge) => (
                <span key={badge} className="todayHeroCoachBadge is-ai">
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="todayHeroBody">
        <div className="todayHeroTitle">{title}</div>
        <div className="todayHeroMeta">
          {[categoryName, durationLabel].filter(Boolean).join(" • ") || "Action à préciser"}
        </div>
        {reason ? <div className="small2" style={{ opacity: 0.82 }}>{reason}</div> : null}
      </div>
      <div className="todayHeroActions GatePrimaryCtaRow">
        <GateButton
          type="button"
          className="GatePressable todayHeroPrimaryBtn"
          withSound
          onClick={() => onStart?.()}
          disabled={!canStart}
        >
          Démarrer
        </GateButton>
        <GateButton
          type="button"
          variant="ghost"
          className="GatePressable todayHeroSecondaryBtn"
          withSound
          onClick={() => onOpenPlanning?.()}
        >
          Voir planning
        </GateButton>
      </div>
    </GateSection>
  );
}
