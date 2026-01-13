export const STEP_CATEGORY = "category";
export const STEP_OUTCOME = "outcome";
export const STEP_HABITS = "habits";
export const STEP_RHYTHM = "rhythm";
export const STEP_REVIEW = "review";

export const CREATION_STEPS = [
  STEP_CATEGORY,
  STEP_OUTCOME,
  STEP_HABITS,
  STEP_RHYTHM,
  STEP_REVIEW,
];

export function isValidCreationStep(step) {
  return CREATION_STEPS.includes(step);
}

export function getNextCreationStep(step) {
  const idx = CREATION_STEPS.indexOf(step);
  if (idx < 0) return STEP_CATEGORY;
  return CREATION_STEPS[Math.min(idx + 1, CREATION_STEPS.length - 1)];
}

export function getPrevCreationStep(step) {
  const idx = CREATION_STEPS.indexOf(step);
  if (idx < 0) return STEP_CATEGORY;
  return CREATION_STEPS[Math.max(idx - 1, 0)];
}
