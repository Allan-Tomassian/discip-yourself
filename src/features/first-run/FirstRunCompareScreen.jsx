import React from "react";
import { AppChip, AppFormSection, ChoiceCard, GhostButton, PrimaryButton } from "../../shared/ui/app";
import FirstRunStepScreen from "./FirstRunStepScreen";

function buildMetrics(plan) {
  const metrics = plan?.comparisonMetrics || {};
  return [
    Number(metrics.weeklyMinutes) > 0 ? `${metrics.weeklyMinutes} min` : "",
    Number(metrics.totalBlocks) > 0 ? `${metrics.totalBlocks} blocs` : "",
    Number(metrics.recoverySlots) > 0 ? `${metrics.recoverySlots} jours de marge` : "",
    metrics.dailyDensity === "soutenue" ? "Rythme soutenu" : "Rythme respirable",
  ].filter(Boolean);
}

function renderPreviewLine(item) {
  if (!item || typeof item !== "object") return "";
  const prefix = [item.dayLabel, item.slotLabel].filter(Boolean).join(" • ");
  const suffix = [item.categoryLabel, Number(item.minutes) > 0 ? `${item.minutes} min` : ""]
    .filter(Boolean)
    .join(" • ");
  return [prefix, item.title, suffix].filter(Boolean).join(" — ");
}

export default function FirstRunCompareScreen({
  data,
  generatedPlans,
  selectedPlanId,
  onBack,
  onSelectPlan,
  onContinue,
}) {
  const safePlans = Array.isArray(generatedPlans?.plans) ? generatedPlans.plans : [];

  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-compare"
      title="Choisis ton point de départ"
      subtitle=""
      badge="5/5"
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!selectedPlanId} onClick={onContinue}>
            Continuer avec ce plan
          </PrimaryButton>
        </>
      }
    >
      <div className="firstRunSectionStack">
        <div className="firstRunChoiceGrid firstRunCompareChoiceGrid">
          {safePlans.map((plan) => (
            <ChoiceCard
              key={plan.id}
              className="firstRunChoiceCard"
              title={plan.title}
              description={plan.summary}
              selected={selectedPlanId === plan.id}
              badge={selectedPlanId === plan.id ? "Sélectionné" : null}
              onClick={() => onSelectPlan(plan.id)}
            />
          ))}
        </div>

        {safePlans.map((plan) => (
          <AppFormSection
            key={`preview_${plan.id}`}
            className="firstRunFormSection"
            bodyClassName="firstRunFormSectionBody"
            title={plan.title}
            description=""
          >
            <div className="firstRunCompareBlock">
              <div className="firstRunCompareMetricRow">
                {buildMetrics(plan).map((metric, index) => (
                  <AppChip key={`${plan.id}_metric_${index}`} className="firstRunCompareMetricChip">
                    {metric}
                  </AppChip>
                ))}
              </div>

              <div className="firstRunCompareCategoryRow">
                {(Array.isArray(plan.categories) ? plan.categories : []).map((category) => (
                  <AppChip
                    key={`${plan.id}_category_${category.id}`}
                    className={`firstRunCompareCategoryChip ${category.role === "primary" ? "is-primary" : ""}`}
                  >
                    {category.label}
                    {Number(category.blockCount) > 0 ? ` · ${category.blockCount}` : ""}
                  </AppChip>
                ))}
              </div>

              <div className="firstRunCompareRationale">
                {[plan?.rationale?.whyFit, plan?.rationale?.capacityFit, plan?.rationale?.constraintFit]
                  .filter(Boolean)
                  .map((line, index) => (
                    <div key={`${plan.id}_rationale_${index}`} className="firstRunPlanPreviewItem">
                      {line}
                    </div>
                  ))}
              </div>

              <div className="firstRunPlanPreviewList">
                {(Array.isArray(plan.todayPreview) && plan.todayPreview.length ? plan.todayPreview : plan.preview).map((previewItem, index) => (
                  <div key={`${plan.id}_${index}`} className="firstRunPlanPreviewItem">
                    {renderPreviewLine(previewItem)}
                  </div>
                ))}
              </div>
            </div>
          </AppFormSection>
        ))}
      </div>
    </FirstRunStepScreen>
  );
}
