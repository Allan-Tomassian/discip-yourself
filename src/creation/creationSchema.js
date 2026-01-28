export const STEP_OUTCOME = "outcome";
export const STEP_OUTCOME_NEXT_ACTION = "outcome-next-action";
export const STEP_HABIT_TYPE = "habit-type";
export const STEP_HABITS = "habits";
export const STEP_LINK_OUTCOME = "link-outcome";
export const STEP_PICK_CATEGORY = "pick-category";

// HABIT UX steps (v2): we keep STEP_HABITS as the “details” screen for backward compatibility.
// New screens are inserted *before* STEP_HABITS.
export const STEP_HABIT_EXPECTATION = "habit-expectation"; // date or days expected
export const STEP_HABIT_PLANNING = "habit-planning"; // scheduling mode / time / slots (skipped for Anytime)

// Two distinct flows:
// - OUTCOME: create an objective, then optionally propose creating the first action
// - HABIT: create an action (type -> details -> link objective -> pick category)

// HABIT flow (legacy): type -> details -> link objective -> pick category
export const CREATION_FLOW_HABIT_LEGACY = [
  STEP_HABIT_TYPE,
  STEP_HABITS,
  STEP_LINK_OUTCOME,
  STEP_PICK_CATEGORY,
];

// HABIT flow (UX v2): type -> expectation -> planning -> details -> link objective -> pick category
// Note: planning is skipped for ANYTIME (no scheduling).
export const CREATION_FLOW_HABIT_UX_V2 = [
  STEP_HABIT_TYPE,
  STEP_HABIT_EXPECTATION,
  STEP_HABIT_PLANNING,
  STEP_HABITS,
  STEP_LINK_OUTCOME,
  STEP_PICK_CATEGORY,
];

// Default HABIT flow used when callers do not specify options.
// Keep legacy as default to avoid breaking existing navigation until UI pages are ready.
export const CREATION_FLOW_HABIT = CREATION_FLOW_HABIT_LEGACY;

export const CREATION_FLOW_OUTCOME = [STEP_OUTCOME, STEP_OUTCOME_NEXT_ACTION];

// Union list kept for compatibility and validation.
export const CREATION_STEPS = [
  ...CREATION_FLOW_OUTCOME,
  ...CREATION_FLOW_HABIT_LEGACY,
  ...CREATION_FLOW_HABIT_UX_V2,
];

export function isValidCreationStep(step) {
  return CREATION_STEPS.includes(step);
}

function inferFlowFromStep(step, fallbackFlow, options) {
  if (CREATION_FLOW_OUTCOME.includes(step)) return CREATION_FLOW_OUTCOME;

  // Any HABIT step (legacy or UX v2) maps to the HABIT flow computed from options.
  const isHabitStep =
    CREATION_FLOW_HABIT_LEGACY.includes(step) ||
    CREATION_FLOW_HABIT_UX_V2.includes(step);

  if (isHabitStep) return getHabitFlowFromOptions(options);

  return fallbackFlow || CREATION_FLOW_OUTCOME;
}

function getHabitFlowFromOptions(options) {
  const useUxV2 = options?.uxV2 === true;
  if (!useUxV2) return CREATION_FLOW_HABIT_LEGACY;

  // If habitType is ANYTIME, skip planning.
  const ht = (options?.habitType || "").toString().toUpperCase();
  if (ht === "ANYTIME") {
    return [
      STEP_HABIT_TYPE,
      STEP_HABIT_EXPECTATION,
      STEP_HABITS,
      STEP_LINK_OUTCOME,
      STEP_PICK_CATEGORY,
    ];
  }

  return CREATION_FLOW_HABIT_UX_V2;
}

// Backward compatible: callers can pass only `step`.
// Optional 2nd arg:
//   { flow: 'OUTCOME'|'HABIT', uxV2?: boolean, habitType?: 'ONE_OFF'|'RECURRING'|'ANYTIME' }
// - uxV2=true enables the HABIT UX flow (type -> expectation -> planning -> details -> ...).
// - habitType=ANYTIME skips the planning step (no scheduling).
export function getNextCreationStep(step, options = undefined) {
  const fallback =
    options?.flow === "HABIT" ? getHabitFlowFromOptions(options) : CREATION_FLOW_OUTCOME;
  const FLOW = inferFlowFromStep(step, fallback, options);

  const idx = FLOW.indexOf(step);
  if (idx < 0) {
    // If step is unknown, start of chosen flow.
    return FLOW[0];
  }
  return FLOW[Math.min(idx + 1, FLOW.length - 1)];
}

export function getPrevCreationStep(step, options = undefined) {
  const fallback =
    options?.flow === "HABIT" ? getHabitFlowFromOptions(options) : CREATION_FLOW_OUTCOME;
  const FLOW = inferFlowFromStep(step, fallback, options);

  const idx = FLOW.indexOf(step);
  if (idx < 0) {
    // If step is unknown, start of chosen flow.
    return FLOW[0];
  }
  return FLOW[Math.max(idx - 1, 0)];
}
