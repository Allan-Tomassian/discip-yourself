export const STEP_OUTCOME = "outcome";
export const STEP_HABITS = "habits";
export const STEP_LINK_OUTCOME = "link-outcome";
export const STEP_PICK_CATEGORY = "pick-category";

export const CREATION_STEPS = [
  STEP_OUTCOME,
  STEP_HABITS,
  STEP_LINK_OUTCOME,
  STEP_PICK_CATEGORY,
];

export function isValidCreationStep(step) {
  return CREATION_STEPS.includes(step);
}

export function getNextCreationStep(step) {
  const idx = CREATION_STEPS.indexOf(step);
  if (idx < 0) return STEP_OUTCOME;
  return CREATION_STEPS[Math.min(idx + 1, CREATION_STEPS.length - 1)];
}

export function getPrevCreationStep(step) {
  const idx = CREATION_STEPS.indexOf(step);
  if (idx < 0) return STEP_OUTCOME;
  return CREATION_STEPS[Math.max(idx - 1, 0)];
}
