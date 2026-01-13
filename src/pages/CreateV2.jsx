import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { AccentItem, Button, Card } from "../components/UI";
import {
  CREATION_STEPS,
  STEP_CATEGORY,
  STEP_HABITS,
  STEP_OUTCOME,
  STEP_REVIEW,
  STEP_RHYTHM,
} from "../creation/creationSchema";
import { normalizeCreationDraft } from "../creation/creationDraft";

const STEP_LABELS = {
  [STEP_CATEGORY]: "Catégorie",
  [STEP_OUTCOME]: "Objectif",
  [STEP_HABITS]: "Habitudes",
  [STEP_RHYTHM]: "Rythme",
  [STEP_REVIEW]: "Vérification",
};

function isCategoryReady(category) {
  if (!category || typeof category !== "object") return false;
  if (category.mode === "existing") return Boolean(category.id);
  return Boolean((category.name || "").trim());
}

function isOutcomeReady(outcome) {
  if (!outcome || typeof outcome !== "object") return false;
  if (outcome.mode === "existing") return Boolean(outcome.id);
  return Boolean((outcome.title || "").trim());
}

function isHabitsReady(habits) {
  return Array.isArray(habits) && habits.length > 0 && habits.every((h) => h && h.title);
}

function isRhythmReady(draft) {
  const items = Array.isArray(draft?.rhythm?.items) ? draft.rhythm.items : [];
  if (!items.length) return false;
  return items.every((item) => {
    const days = Array.isArray(item.daysOfWeek) ? item.daysOfWeek : [];
    return Boolean(item.time) && Number.isFinite(item.durationMinutes) && item.durationMinutes > 0 && days.length > 0;
  });
}

function getNextStep(draft) {
  if (!isCategoryReady(draft.category)) return STEP_CATEGORY;
  if (!isOutcomeReady(draft.outcome)) return STEP_OUTCOME;
  if (!isHabitsReady(draft.habits)) return STEP_HABITS;
  if (!isRhythmReady(draft)) return STEP_RHYTHM;
  return STEP_REVIEW;
}

export default function CreateV2({ data, onBack, onOpenStep, onUseLegacyFlow }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const nextStep = getNextStep(draft);
  const nextIndex = CREATION_STEPS.indexOf(nextStep);

  const stepStatuses = {
    [STEP_CATEGORY]: isCategoryReady(draft.category),
    [STEP_OUTCOME]: isOutcomeReady(draft.outcome),
    [STEP_HABITS]: isHabitsReady(draft.habits),
    [STEP_RHYTHM]: isRhythmReady(draft),
    [STEP_REVIEW]: isRhythmReady(draft),
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
          <div className="p18 col" style={{ gap: 12 }}>
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
                  rightSlot={<div className="small2">{stepStatuses[step] ? "✔" : "•"}</div>}
                >
                  <div className="small2">{STEP_LABELS[step]}</div>
                </AccentItem>
              ))}
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
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
