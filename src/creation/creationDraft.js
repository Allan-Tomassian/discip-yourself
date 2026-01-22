import {
  CREATION_STEPS,
  STEP_HABITS,
  STEP_OUTCOME,
} from "./creationSchema";

export const CREATION_DRAFT_VERSION = 1;

export function createEmptyDraft() {
  return {
    version: CREATION_DRAFT_VERSION,
    step: STEP_OUTCOME,
    category: null,
    outcome: null,
    outcomes: [],
    activeOutcomeId: null,
    habits: [],
  };
}

export function normalizeCreationDraft(raw) {
  const draft = raw && typeof raw === "object" ? { ...raw } : createEmptyDraft();
  if (draft.version !== CREATION_DRAFT_VERSION) draft.version = CREATION_DRAFT_VERSION;
  if (!CREATION_STEPS.includes(draft.step)) draft.step = STEP_OUTCOME;
  if (!draft.category || typeof draft.category !== "object") draft.category = null;
  if (!draft.outcome || typeof draft.outcome !== "object") draft.outcome = null;
  if (!Array.isArray(draft.outcomes)) {
    if (draft.outcome) {
      const legacyId = draft.outcome.id || "outcome";
      draft.outcomes = [{ ...draft.outcome, id: legacyId }];
    } else {
      draft.outcomes = [];
    }
  }
  draft.outcomes = draft.outcomes
    .map((outcome, index) => {
      if (!outcome || typeof outcome !== "object") return null;
      if (!outcome.id) return { ...outcome, id: `outcome-${index + 1}` };
      return outcome;
    })
    .filter(Boolean);
  if (!draft.activeOutcomeId || !draft.outcomes.some((o) => o.id === draft.activeOutcomeId)) {
    draft.activeOutcomeId = draft.outcomes[0]?.id || null;
  }
  if (!Array.isArray(draft.habits)) draft.habits = [];
  draft.habits = draft.habits
    .map((habit) => {
      if (!habit || typeof habit !== "object") return null;
      if (!habit.outcomeId && draft.outcomes.length === 1) {
        return { ...habit, outcomeId: draft.outcomes[0].id };
      }
      return habit;
    })
    .filter(Boolean);
  return draft;
}

export function ensureDraftStep(draft, step) {
  const safe = normalizeCreationDraft(draft);
  if (CREATION_STEPS.includes(step)) safe.step = step;
  return safe;
}

export const DRAFT_SECTIONS = {
  outcome: STEP_OUTCOME,
  habits: STEP_HABITS,
};
