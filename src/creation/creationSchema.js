export const STEP_OUTCOME = "outcome";
export const STEP_HABITS = "habits";

export const CREATION_STEPS = [
  STEP_OUTCOME,
  STEP_HABITS,
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
