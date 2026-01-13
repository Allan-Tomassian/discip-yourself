import {
  CREATION_STEPS,
  STEP_CATEGORY,
  STEP_HABITS,
  STEP_OUTCOME,
  STEP_REVIEW,
  STEP_RHYTHM,
} from "./creationSchema";

export const CREATION_DRAFT_VERSION = 1;

export function createEmptyDraft() {
  return {
    version: CREATION_DRAFT_VERSION,
    step: STEP_CATEGORY,
    category: null,
    outcome: null,
    habits: [],
    rhythm: {
      items: [],
    },
    review: {
      confirmed: false,
    },
  };
}

export function normalizeCreationDraft(raw) {
  const draft = raw && typeof raw === "object" ? { ...raw } : createEmptyDraft();
  if (draft.version !== CREATION_DRAFT_VERSION) draft.version = CREATION_DRAFT_VERSION;
  if (!CREATION_STEPS.includes(draft.step)) draft.step = STEP_CATEGORY;
  if (!draft.category || typeof draft.category !== "object") draft.category = null;
  if (!draft.outcome || typeof draft.outcome !== "object") draft.outcome = null;
  if (!Array.isArray(draft.habits)) draft.habits = [];
  if (!draft.rhythm || typeof draft.rhythm !== "object") draft.rhythm = { items: [] };
  if (!Array.isArray(draft.rhythm.items)) draft.rhythm.items = [];
  if (!draft.review || typeof draft.review !== "object") draft.review = { confirmed: false };
  if (typeof draft.review.confirmed !== "boolean") draft.review.confirmed = false;
  return draft;
}

export function ensureDraftStep(draft, step) {
  const safe = normalizeCreationDraft(draft);
  if (CREATION_STEPS.includes(step)) safe.step = step;
  return safe;
}

export const DRAFT_SECTIONS = {
  category: STEP_CATEGORY,
  outcome: STEP_OUTCOME,
  habits: STEP_HABITS,
  rhythm: STEP_RHYTHM,
  review: STEP_REVIEW,
};
