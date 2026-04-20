import React from "react";
import { AppInlineMetaCard, FeedbackMessage, GhostButton, PrimaryButton } from "../../shared/ui/app";
import FirstRunStepScreen from "./FirstRunStepScreen";

function renderPreviewLine(item) {
  if (typeof item === "string") return item;
  if (!item || typeof item !== "object") return "";
  const prefix = [item.dayLabel, item.slotLabel].filter(Boolean).join(" • ");
  const suffix = [item.categoryLabel, Number(item.minutes) > 0 ? `${item.minutes} min` : ""]
    .filter(Boolean)
    .join(" • ");
  return [prefix, item.title, suffix].filter(Boolean).join(" — ");
}

export default function FirstRunCommitScreen({
  data,
  selectedPlan,
  onBack,
  onContinue,
}) {
  return (
    <FirstRunStepScreen
      data={data}
      testId="first-run-screen-commit"
      title="Validation du plan choisi"
      subtitle="Ce lot ne crée pas encore le vrai système produit. Il persiste uniquement le choix et l'étape atteinte."
      badge=""
      footer={
        <>
          <GhostButton onClick={onBack}>Retour</GhostButton>
          <PrimaryButton disabled={!selectedPlan} onClick={onContinue}>
            Valider ce choix
          </PrimaryButton>
        </>
      }
    >
      <div className="firstRunSectionStack">
        {selectedPlan ? (
          <>
            <AppInlineMetaCard
              className="firstRunInfoCard"
              title={selectedPlan.title}
              text={selectedPlan.summary || "Plan de départ sélectionné."}
              meta={selectedPlan.variant || "plan"}
            />
            <div className="firstRunPlanPreviewList">
              {(Array.isArray(selectedPlan.preview) ? selectedPlan.preview : []).map((previewItem, index) => (
                <div key={`${selectedPlan.id}_${index}`} className="firstRunPlanPreviewItem">
                  {renderPreviewLine(previewItem)}
                </div>
              ))}
            </div>
          </>
        ) : (
          <FeedbackMessage tone="error">Choisis un plan avant de continuer.</FeedbackMessage>
        )}
      </div>
    </FirstRunStepScreen>
  );
}
