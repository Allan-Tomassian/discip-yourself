export const STEP_OUTCOME = "outcome";
export const STEP_OUTCOME_NEXT_ACTION = "outcome-next-action";
export const STEP_HABIT_TYPE = "habit-type";
export const STEP_HABITS = "habits";
export const STEP_LINK_OUTCOME = "link-outcome";
export const STEP_PICK_CATEGORY = "pick-category";

// Two distinct flows:
// - OUTCOME: create an objective, then optionally propose creating the first action
// - HABIT: create an action (type -> details -> link objective -> pick category)
export const CREATION_FLOW_OUTCOME = [STEP_OUTCOME, STEP_OUTCOME_NEXT_ACTION];
export const CREATION_FLOW_HABIT = [
  STEP_HABIT_TYPE,
  STEP_HABITS,
  STEP_LINK_OUTCOME,
  STEP_PICK_CATEGORY,
];

// Union list kept for compatibility and validation.
export const CREATION_STEPS = [...CREATION_FLOW_OUTCOME, ...CREATION_FLOW_HABIT];

export function isValidCreationStep(step) {
  return CREATION_STEPS.includes(step);
}

function inferFlowFromStep(step, fallbackFlow) {
  if (CREATION_FLOW_OUTCOME.includes(step)) return CREATION_FLOW_OUTCOME;
  if (CREATION_FLOW_HABIT.includes(step)) return CREATION_FLOW_HABIT;
  return fallbackFlow || CREATION_FLOW_OUTCOME;
}

// Backward compatible: callers can pass only `step`.
// Optional 2nd arg: { flow: 'OUTCOME'|'HABIT' } to disambiguate when `step` is invalid/empty.
export function getNextCreationStep(step, options = undefined) {
  const fallback = options?.flow === "HABIT" ? CREATION_FLOW_HABIT : CREATION_FLOW_OUTCOME;
  const FLOW = inferFlowFromStep(step, fallback);

  const idx = FLOW.indexOf(step);
  if (idx < 0) {
    // If step is unknown, start of chosen flow.
    return FLOW[0];
  }
  return FLOW[Math.min(idx + 1, FLOW.length - 1)];
}

export function getPrevCreationStep(step, options = undefined) {
  const fallback = options?.flow === "HABIT" ? CREATION_FLOW_HABIT : CREATION_FLOW_OUTCOME;
  const FLOW = inferFlowFromStep(step, fallback);

  const idx = FLOW.indexOf(step);
  if (idx < 0) {
    // If step is unknown, start of chosen flow.
    return FLOW[0];
  }
  return FLOW[Math.max(idx - 1, 0)];
}
