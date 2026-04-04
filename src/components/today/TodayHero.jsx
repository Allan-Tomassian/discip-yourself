import React, { useMemo } from "react";
import { AppCard, FeedbackMessage, GhostButton, PrimaryButton } from "../../shared/ui/app";
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
    <AppCard variant="elevated" className="todayHeroCard" style={heroAccentVars || undefined}>
      <div className="todayHeroContent">
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
          <div className="todayHeroTitle">{displayTitle}</div>
          <div className="todayHeroMetaRow">
            <CategoryPill category={category} label={displayCategory} className="todayHeroCategoryPill" />
            <div className="todayHeroDurationChip">{durationLabel || "Durée libre"}</div>
          </div>
          <div className="todayHeroDetailList">
            <div className="todayHeroDetailBlock">
              <div className="todayHeroDetailLabel">Pourquoi maintenant</div>
              <div className="todayHeroDetailText">{displayReason}</div>
            </div>
            <div className="todayHeroDetailBlock">
              <div className="todayHeroDetailLabel">Direction</div>
              <div className="todayHeroDetailText">{displayContribution}</div>
            </div>
            {displayImpact ? (
              <div className="todayHeroDetailBlock">
                <div className="todayHeroDetailLabel">Effet visé</div>
                <div className="todayHeroDetailText">{displayImpact}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="todayHeroActions">
          <PrimaryButton
            type="button"
            className="todayHeroPrimaryBtn"
            onClick={() => onPrimaryAction?.()}
            disabled={!canPrimaryAction}
          >
            {primaryLabel}
          </PrimaryButton>
          <GhostButton
            type="button"
            size="sm"
            className="todayHeroSecondaryBtn"
            onClick={() => onAnalyze?.()}
            disabled={analyzeDisabled}
          >
            {analyzeDisabled && analysisStageLabel ? analysisStageLabel : analyzeLabel}
          </GhostButton>
        </div>

        {analyzeError ? (
          <FeedbackMessage tone="error" className="todayHeroError" role="alert">
            {analyzeError}
          </FeedbackMessage>
        ) : null}

        {showPlanningShortcut || onDismissAnalysis ? (
          <div className="todayHeroUtilityRow">
            {onDismissAnalysis ? (
              <GhostButton
                type="button"
                size="sm"
                className="todayHeroUtilityButton"
                onClick={() => onDismissAnalysis?.()}
              >
                {UI_COPY.backToLocalDiagnostic}
              </GhostButton>
            ) : null}
            {showPlanningShortcut ? (
              <GhostButton
                type="button"
                size="sm"
                className="todayHeroUtilityButton"
                onClick={() => onOpenPlanning?.()}
              >
                {UI_COPY.openPlanning}
              </GhostButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppCard>
  );
}
