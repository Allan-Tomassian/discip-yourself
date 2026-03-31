import React, { useMemo } from "react";
import { GateButton, GateSection } from "../../shared/ui/gate/Gate";
import "../../features/today/today.css";
import ManualAiStatus from "../ai/ManualAiStatus";
import CategoryPill from "../CategoryPill";
import { getCategoryUiVars } from "../../utils/categoryAccent";
import { ANALYSIS_COPY, UI_COPY } from "../../ui/labels";
import { BehaviorCue } from "../../feedback/BehaviorFeedbackContext";

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
  behaviorCue = null,
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
  const displayTitle = title || (isPreparing ? "Préparation du prochain pas" : "Aucune action prioritaire");
  const displayReason = reason || (isPreparing ? "Lecture en cours." : "Aucun repère disponible.");
  const displayContribution = contributionLabel || "Maintenir l’élan sur ta priorité active.";
  const displayImpact = impactText || "";
  const displayCategory = recommendedCategoryLabel || categoryName || "À préciser";

  return (
    <GateSection
      className={[
        "GateMainSection",
        "GateMainSectionCard",
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
            statusLabel={analysisModeLabel || ANALYSIS_COPY.localDiagnostic}
            detailLabel={[analysisStorageLabel, timestampLabel].filter(Boolean).join(" • ")}
            stageLabel={analysisStageLabel}
          />
          {behaviorCue ? <BehaviorCue cue={behaviorCue} category={activeCategory || category || null} /> : null}
        </div>
      </div>
      <div className="todayHeroBody">
        <div className="todayHeroTitle GateRoleCardTitle">{displayTitle}</div>
        <div className="todayHeroMetaRow">
          <CategoryPill category={category} label={displayCategory} className="todayHeroCategoryPill" />
          <div className="todayHeroDurationChip">{durationLabel || "Durée libre"}</div>
        </div>
        <div className="todayHeroDetailList">
          <div className="todayHeroDetailBlock">
            <div className="todayHeroDetailLabel GateRoleCardMeta">Pourquoi maintenant</div>
            <div className="todayHeroDetailText GateRoleHelperText">{displayReason}</div>
          </div>
          <div className="todayHeroDetailBlock">
            <div className="todayHeroDetailLabel GateRoleCardMeta">Direction</div>
            <div className="todayHeroDetailText GateRoleHelperText">{displayContribution}</div>
          </div>
          {displayImpact ? (
            <div className="todayHeroDetailBlock">
              <div className="todayHeroDetailLabel GateRoleCardMeta">Effet visé</div>
              <div className="todayHeroDetailText GateRoleHelperText">{displayImpact}</div>
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
        <div className="small2 GateRoleCardMeta" style={{ opacity: 0.88 }}>
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
              {UI_COPY.backToLocalDiagnostic}
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
              {UI_COPY.openPlanning}
            </GateButton>
          ) : null}
        </div>
      ) : null}
    </GateSection>
  );
}
