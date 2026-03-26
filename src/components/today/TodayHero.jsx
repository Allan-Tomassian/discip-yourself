import React, { useMemo } from "react";
import { GateButton, GateSection } from "../../shared/ui/gate/Gate";
import "../../features/today/today.css";
import ManualAiStatus from "../ai/ManualAiStatus";
import CategoryPill from "../CategoryPill";
import { getCategoryUiVars } from "../../utils/categoryAccent";

export default function TodayHero({
  title = "Aucune action prioritaire",
  category = null,
  activeCategory = null,
  categoryName = "",
  durationLabel = "",
  reason = "",
  contributionLabel = "",
  recommendedCategoryLabel = "",
  impactText = "",
  analysisStatusKind = "local",
  analysisModeLabel = "",
  analysisStorageLabel = "",
  timestampLabel = "",
  analysisStageLabel = "",
  primaryLabel = "Démarrer",
  onPrimaryAction,
  canPrimaryAction = false,
  onAnalyze,
  analyzeLabel = "Analyser ma priorité",
  analyzeDisabled = false,
  analyzeError = "",
  onDismissAnalysis,
  onOpenPlanning,
  showPlanningShortcut = true,
  isPreparing = false,
}) {
  const heroAccentVars = useMemo(
    () => (activeCategory ? getCategoryUiVars(activeCategory, { level: "surface" }) : null),
    [activeCategory]
  );
  const displayTitle = title || (isPreparing ? "Préparation de la recommandation" : "Aucune action prioritaire");
  const displayReason = reason || (isPreparing ? "Analyse en cours." : "Aucune raison disponible.");
  const displayContribution = contributionLabel || "Maintenir l’élan sur ta priorité active.";
  const displayImpact = impactText || "";
  const displayCategory = recommendedCategoryLabel || categoryName || "À préciser";

  return (
    <GateSection
      className={[
        "GateMainSection",
        "todayHeroCard",
        "GateSurfacePremium",
        "GateCardPremium",
      ]
        .filter(Boolean)
        .join(" ")}
      collapsible={false}
      style={heroAccentVars || undefined}
    >
      <div className="todayHeroHeader">
        <div className="todayHeroHeaderCluster">
          <ManualAiStatus
            statusKind={analysisStatusKind}
            statusLabel={analysisModeLabel || "Diagnostic local"}
            detailLabel={[analysisStorageLabel, timestampLabel].filter(Boolean).join(" • ")}
            stageLabel={analysisStageLabel}
          />
        </div>
      </div>
      <div className="todayHeroBody">
        <div className="todayHeroTitle">{displayTitle}</div>
        <div className="todayHeroMetaRow">
          <CategoryPill category={category} label={displayCategory} className="todayHeroCategoryPill" />
          <div className="todayHeroDurationChip">{durationLabel || "Durée libre"}</div>
        </div>
        <div className="todayHeroDetailList">
          <div className="todayHeroDetailBlock">
            <div className="todayHeroDetailLabel">Pourquoi</div>
            <div className="todayHeroDetailText">{displayReason}</div>
          </div>
          <div className="todayHeroDetailBlock">
            <div className="todayHeroDetailLabel">Contribue à</div>
            <div className="todayHeroDetailText">{displayContribution}</div>
          </div>
          {displayImpact ? (
            <div className="todayHeroDetailBlock">
              <div className="todayHeroDetailLabel">Impact attendu</div>
              <div className="todayHeroDetailText">{displayImpact}</div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="todayHeroActions GatePrimaryCtaRow">
        <GateButton
          type="button"
          className="GatePressable todayHeroPrimaryBtn"
          withSound
          onClick={() => onPrimaryAction?.()}
          disabled={!canPrimaryAction}
        >
          {primaryLabel}
        </GateButton>
        <GateButton
          type="button"
          variant="ghost"
          className="GatePressable todayHeroSecondaryBtn"
          withSound
          onClick={() => onAnalyze?.()}
          disabled={analyzeDisabled}
        >
          {analyzeDisabled && analysisStageLabel ? analysisStageLabel : analyzeLabel}
        </GateButton>
      </div>
      {analyzeError ? (
        <div className="small2" style={{ opacity: 0.88 }}>
          {analyzeError}
        </div>
      ) : null}
      {showPlanningShortcut || onDismissAnalysis ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {onDismissAnalysis ? (
            <GateButton
              type="button"
              variant="ghost"
              className="GatePressable"
              withSound
              onClick={() => onDismissAnalysis?.()}
            >
              Revenir au diagnostic local
            </GateButton>
          ) : null}
          {showPlanningShortcut ? (
            <GateButton
              type="button"
              variant="ghost"
              className="GatePressable"
              withSound
              onClick={() => onOpenPlanning?.()}
            >
              Ouvrir mon planning
            </GateButton>
          ) : null}
        </div>
      ) : null}
    </GateSection>
  );
}
