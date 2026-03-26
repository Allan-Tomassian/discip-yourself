import { normalizeCreationDraft } from "./creationDraft";
import {
  STEP_HABITS,
  STEP_HABIT_TYPE,
  STEP_LINK_OUTCOME,
  STEP_OUTCOME,
  STEP_OUTCOME_NEXT_ACTION,
  STEP_PICK_CATEGORY,
} from "./creationSchema";

export const CREATE_FLOW_MODE_ACTION = "action";
export const CREATE_FLOW_MODE_GUIDED = "guided";
export const CREATE_FLOW_MODE_PROJECT = "project";

const CREATE_FLOW_MODES = new Set([
  CREATE_FLOW_MODE_ACTION,
  CREATE_FLOW_MODE_GUIDED,
  CREATE_FLOW_MODE_PROJECT,
]);

export function normalizeCreateFlowMode(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return CREATE_FLOW_MODES.has(raw) ? raw : CREATE_FLOW_MODE_ACTION;
}

export function getDefaultCreationStepForMode(mode) {
  const normalizedMode = normalizeCreateFlowMode(mode);
  if (normalizedMode === CREATE_FLOW_MODE_PROJECT || normalizedMode === CREATE_FLOW_MODE_GUIDED) {
    return STEP_OUTCOME;
  }
  return STEP_HABIT_TYPE;
}

export function derivePendingCreationFields(rawDraft) {
  const draft = normalizeCreationDraft(rawDraft);
  const pending = [];
  if (draft?.category?.mode !== "existing" || !draft?.category?.id) pending.push("categoryId");
  const mode = normalizeCreateFlowMode(draft.mode);
  if (mode === CREATE_FLOW_MODE_ACTION || mode === CREATE_FLOW_MODE_GUIDED) {
    if (!draft.habitType) pending.push("habitType");
  }
  if ((mode === CREATE_FLOW_MODE_PROJECT || mode === CREATE_FLOW_MODE_GUIDED) && !draft.createdOutcomeId) {
    const firstOutcomeTitle = typeof draft.outcomes?.[0]?.title === "string" ? draft.outcomes[0].title.trim() : "";
    if (!firstOutcomeTitle) pending.push("outcomeTitle");
  }
  if ((draft.step === STEP_HABITS || draft.createdActionIds?.length) && !draft.createdActionIds?.length) {
    const firstHabitTitle = typeof draft.habits?.[0]?.title === "string" ? draft.habits[0].title.trim() : "";
    if (!firstHabitTitle) pending.push("actionTitle");
  }
  return [...new Set(pending)];
}

export function applyCreateFlowDraftMeta(rawDraft, { mode, source, status } = {}) {
  const draft = normalizeCreationDraft(rawDraft);
  const nextMode = normalizeCreateFlowMode(mode || draft.mode);
  const nextStatus = typeof status === "string" && status.trim() ? status.trim() : draft.status || "draft";
  return {
    ...draft,
    mode: nextMode,
    status: nextStatus,
    sourceContext:
      source || draft?.sourceContext?.source
        ? {
            source: typeof source === "string" ? source : draft?.sourceContext?.source || null,
            trigger: draft?.sourceContext?.trigger || null,
          }
        : { source: null, trigger: null },
    pendingFields: derivePendingCreationFields({
      ...draft,
      mode: nextMode,
    }),
  };
}

function resolveHabitPresentation(habitType) {
  const normalizedHabitType = typeof habitType === "string" ? habitType.trim().toUpperCase() : "";
  if (normalizedHabitType === "ONE_OFF") return "habit-oneoff";
  if (normalizedHabitType === "ANYTIME") return "habit-anytime";
  return "habit-recurring";
}

export function resolveCreateFlowPresentation({ draft: rawDraft, requestedStep, requestedMode } = {}) {
  const draft = normalizeCreationDraft(rawDraft);
  const effectiveStep = requestedStep || draft.step || getDefaultCreationStepForMode(requestedMode || draft.mode);
  const choice = normalizeCreateFlowMode(requestedMode || draft.mode);

  if (effectiveStep === STEP_OUTCOME) return { step: "outcome", choice };
  if (effectiveStep === STEP_OUTCOME_NEXT_ACTION) return { step: "outcome-next-action", choice };
  if (effectiveStep === STEP_HABIT_TYPE) return { step: "habit-type", choice: CREATE_FLOW_MODE_ACTION };
  if (effectiveStep === STEP_HABITS) {
    return {
      step: resolveHabitPresentation(draft.habitType),
      choice: CREATE_FLOW_MODE_ACTION,
    };
  }
  if (effectiveStep === STEP_LINK_OUTCOME) return { step: "link-outcome", choice: CREATE_FLOW_MODE_ACTION };
  if (effectiveStep === STEP_PICK_CATEGORY) return { step: "pick-category", choice: CREATE_FLOW_MODE_ACTION };
  return {
    step: choice === CREATE_FLOW_MODE_PROJECT || choice === CREATE_FLOW_MODE_GUIDED ? "outcome" : "habit-type",
    choice,
  };
}

export function resolveLegacyCreateRouteIntent(tab) {
  switch (tab) {
    case "create-goal":
      return {
        baseTab: "library",
        source: "legacy-create-route",
        mode: CREATE_FLOW_MODE_PROJECT,
        step: STEP_OUTCOME,
      };
    case "create-outcome-next":
      return {
        baseTab: "library",
        source: "legacy-create-route",
        mode: CREATE_FLOW_MODE_PROJECT,
        step: STEP_OUTCOME_NEXT_ACTION,
      };
    case "create-habit-type":
      return {
        baseTab: "library",
        source: "legacy-create-route",
        mode: CREATE_FLOW_MODE_ACTION,
        step: STEP_HABIT_TYPE,
      };
    case "create-habit-oneoff":
      return {
        baseTab: "library",
        source: "legacy-create-route",
        mode: CREATE_FLOW_MODE_ACTION,
        step: STEP_HABITS,
        habitType: "ONE_OFF",
      };
    case "create-habit-recurring":
      return {
        baseTab: "library",
        source: "legacy-create-route",
        mode: CREATE_FLOW_MODE_ACTION,
        step: STEP_HABITS,
        habitType: "RECURRING",
      };
    case "create-habit-anytime":
      return {
        baseTab: "library",
        source: "legacy-create-route",
        mode: CREATE_FLOW_MODE_ACTION,
        step: STEP_HABITS,
        habitType: "ANYTIME",
      };
    case "create-link-outcome":
      return {
        baseTab: "library",
        source: "legacy-create-route",
        mode: CREATE_FLOW_MODE_ACTION,
        step: STEP_LINK_OUTCOME,
      };
    case "create-pick-category":
      return {
        baseTab: "library",
        source: "legacy-create-route",
        mode: CREATE_FLOW_MODE_ACTION,
        step: STEP_PICK_CATEGORY,
      };
    default:
      return null;
  }
}
