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
  reasonLinkType = "",
  reasonLinkLabel = "",
  contributionLabel = "",
  recommendedCategoryLabel = "",
  impactText = "",
  aiStatusLabel = "",
  timestampLabel = "",
  onStart,
  onOpenPlanning,
  canStart = false,
  isAiRecommendation = false,
  isFresh = false,
  isPreparing = false,
}) {
  const badges = buildBadges({ isAiRecommendation, isFresh });
  const displayTitle = title || (isPreparing ? "Préparation de la recommandation" : "Aucune action prioritaire");
  const displayReason = reason || (isPreparing ? "L’IA prépare la priorité du moment." : "Aucune raison disponible.");
  const displayContribution = contributionLabel || impactText || "Maintenir l’élan sur ta priorité active.";
  const displayCategory = recommendedCategoryLabel || categoryName || "À préciser";

  return (
    <GateSection className="todayHeroCard GateSurfacePremium GateCardPremium" collapsible={false}>
      <div className="todayHeroHeader">
        <div className="todayHeroHeaderCluster">
          <div className="todayHeroKicker">Action recommandée</div>
          {aiStatusLabel || timestampLabel ? (
            <div className="small2" style={{ opacity: 0.82 }}>
              {[aiStatusLabel, timestampLabel].filter(Boolean).join(" • ")}
            </div>
          ) : null}
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
        <div className="todayHeroTitle">{displayTitle}</div>
        {reasonLinkLabel ? (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className={`todayHeroCoachBadge${reasonLinkType === "cross_category" ? " is-ai" : ""}`}>
              {reasonLinkLabel}
            </span>
          </div>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 10,
          }}
        >
          <div className="listItem GateRowPremium">
            <div className="small2">Catégorie</div>
            <div className="titleSm">{displayCategory}</div>
          </div>
          <div className="listItem GateRowPremium">
            <div className="small2">Durée</div>
            <div className="titleSm">{durationLabel || "Libre"}</div>
          </div>
        </div>
        <div className="col" style={{ gap: 8 }}>
          <div>
            <div className="small2" style={{ opacity: 0.72 }}>Pourquoi</div>
            <div className="small2" style={{ opacity: 0.92 }}>{displayReason}</div>
          </div>
          <div>
            <div className="small2" style={{ opacity: 0.72 }}>Contribue à</div>
            <div className="small2" style={{ opacity: 0.92 }}>{displayContribution}</div>
          </div>
        </div>
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
