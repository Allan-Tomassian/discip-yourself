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

function isOutcomeReady(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return false;
  return outcomes.every((outcome) => {
    if (!outcome || typeof outcome !== "object") return false;
    if (outcome.mode === "existing") return Boolean(outcome.id);
    return Boolean((outcome.title || "").trim());
  });
}

function isHabitsReady(habits, outcomes) {
  if (!Array.isArray(habits) || habits.length === 0) return false;
  const outcomeIds = new Set((outcomes || []).map((o) => o && o.id).filter(Boolean));
  return habits.every((habit) => habit && habit.title && habit.outcomeId && outcomeIds.has(habit.outcomeId));
}

function isRhythmReady(draft) {
  const items = Array.isArray(draft?.rhythm?.items) ? draft.rhythm.items : [];
  if (!items.length) return false;
  if (draft?.rhythm?.hasConflicts) return false;
  const outcomes = Array.isArray(draft?.outcomes) ? draft.outcomes : [];
  const habits = Array.isArray(draft?.habits) ? draft.habits : [];
  const outcomeItems = new Map(items.filter((item) => item.type === "outcome").map((item) => [item.id, item]));
  for (const outcome of outcomes) {
    const item = outcomeItems.get(outcome.id);
    const days = Array.isArray(item?.daysOfWeek) ? item.daysOfWeek : [];
    if (!item || !days.length) return false;
  }
  const habitItems = new Map(items.filter((item) => item.type === "habit").map((item) => [item.id, item]));
  for (const habit of habits) {
    const item = habitItems.get(habit.id);
    if (!item) return false;
    const hasTime = Boolean(item.time);
    const hasDuration = Number.isFinite(item.durationMinutes) && item.durationMinutes > 0;
    const outcomeItem = outcomeItems.get(habit.outcomeId);
    const days = Array.isArray(outcomeItem?.daysOfWeek) ? outcomeItem.daysOfWeek : [];
    if (!hasTime || !hasDuration || !days.length) return false;
  }
  return true;
}

function getNextStep(draft) {
  if (!isCategoryReady(draft.category)) return STEP_CATEGORY;
  if (!isOutcomeReady(draft.outcomes)) return STEP_OUTCOME;
  if (!isHabitsReady(draft.habits, draft.outcomes)) return STEP_HABITS;
  if (!isRhythmReady(draft)) return STEP_RHYTHM;
  return STEP_REVIEW;
}

export default function CreateV2({ data, onBack, onOpenStep, onUseLegacyFlow }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const nextStep = getNextStep(draft);
  const nextIndex = CREATION_STEPS.indexOf(nextStep);
  const outcomesCount = Array.isArray(draft.outcomes) ? draft.outcomes.length : 0;
  const habitsCount = Array.isArray(draft.habits) ? draft.habits.length : 0;
  const rhythmOk = isRhythmReady(draft);

  const stepStatuses = {
    [STEP_CATEGORY]: isCategoryReady(draft.category),
    [STEP_OUTCOME]: isOutcomeReady(draft.outcomes),
    [STEP_HABITS]: isHabitsReady(draft.habits, draft.outcomes),
    [STEP_RHYTHM]: isRhythmReady(draft),
    [STEP_REVIEW]: isRhythmReady(draft),
  };

  const stepRightLabels = {
    [STEP_OUTCOME]: `${outcomesCount} objectif${outcomesCount > 1 ? "s" : ""}`,
    [STEP_HABITS]: `${habitsCount} habitude${habitsCount > 1 ? "s" : ""}`,
    [STEP_RHYTHM]: rhythmOk ? "OK" : "À faire",
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
