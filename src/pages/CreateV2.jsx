import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { AccentItem, Button, Card } from "../components/UI";
import {
  CREATION_STEPS,
  STEP_HABITS,
  STEP_OUTCOME,
} from "../creation/creationSchema";
import { normalizeCreationDraft } from "../creation/creationDraft";

const STEP_LABELS = {
  [STEP_OUTCOME]: "Objectif",
  [STEP_HABITS]: "Actions",
};

function isOutcomeReady(draft) {
  const outcomes = Array.isArray(draft?.outcomes) ? draft.outcomes : [];
  if (outcomes.length !== 1) return false;
  const outcome = outcomes[0];
  if (!outcome || typeof outcome !== "object") return false;
  return Boolean((outcome.title || "").trim()) && Boolean((outcome.deadline || "").trim());
}

function isHabitsReady(habits) {
  if (!Array.isArray(habits) || habits.length === 0) return false;
  return habits.every((habit) => habit && habit.title);
}

function getNextStep(draft) {
  if (!isOutcomeReady(draft)) return STEP_OUTCOME;
  if (!isHabitsReady(draft.habits)) return STEP_HABITS;
  return STEP_HABITS;
}

export default function CreateV2({ data, onBack, onOpenStep, onUseLegacyFlow }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const nextStep = getNextStep(draft);
  const nextIndex = CREATION_STEPS.indexOf(nextStep);
  const outcomesCount = Array.isArray(draft.outcomes) ? draft.outcomes.length : 0;
  const habitsCount = Array.isArray(draft.habits) ? draft.habits.length : 0;

  const stepStatuses = {
    [STEP_OUTCOME]: isOutcomeReady(draft),
    [STEP_HABITS]: isHabitsReady(draft.habits),
  };

  const stepRightLabels = {
    [STEP_OUTCOME]: `${outcomesCount} objectif${outcomesCount > 1 ? "s" : ""}`,
    [STEP_HABITS]: `${habitsCount} action${habitsCount > 1 ? "s" : ""}`,
  };

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle={<span className="textAccent">Créer</span>}
      headerSubtitle="Nouveau parcours"
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        {onBack ? (
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </Button>
        ) : null}
        <Card accentBorder>
          <div className="p18 col gap12">
            <div className="titleSm">Progression</div>
            <div className="stack stackGap8">
              {CREATION_STEPS.map((step) => (
                <AccentItem
                  key={step}
                  selected={step === nextStep}
                  onClick={() => {
                    const stepIndex = CREATION_STEPS.indexOf(step);
                    if (stepIndex > nextIndex) return;
                    if (typeof onOpenStep === "function") onOpenStep(step);
                  }}
                  rightSlot={
                    <div className="small2">
                      {stepRightLabels[step] || (stepStatuses[step] ? "✔" : "•")}
                    </div>
                  }
                >
                  <div className="small2">{STEP_LABELS[step]}</div>
                </AccentItem>
              ))}
            </div>
            <div className="row rowEnd">
              {typeof onUseLegacyFlow === "function" ? (
                <Button variant="ghost" onClick={onUseLegacyFlow}>
                  Mode classique
                </Button>
              ) : null}
              <Button onClick={() => (typeof onOpenStep === "function" ? onOpenStep(nextStep) : null)}>
                Continuer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
