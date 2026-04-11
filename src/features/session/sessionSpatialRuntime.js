import { normalizeSessionRunbook } from "./sessionRunbook";

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(min, value, max) {
  return Math.min(Math.max(value, min), max);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeIndex(value, maxIndex) {
  if (!Number.isFinite(maxIndex) || maxIndex < 0) return 0;
  return clamp(0, Math.round(Number(value) || 0), maxIndex);
}

function normalizeElapsed(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function readTimedItemKinds() {
  return new Set(["activation", "warmup", "effort", "cooldown", "breath"]);
}

function inferProgressKind(protocolType, step) {
  if (protocolType === "sport") return "timed";
  const items = Array.isArray(step?.items) ? step.items : [];
  const timedItemKinds = readTimedItemKinds();

  if (protocolType === "routine") {
    const hasTimedPattern = items.some((item) => timedItemKinds.has(asString(item?.kind).toLowerCase()));
    return hasTimedPattern ? "timed" : "open";
  }

  const actionLikeKinds = new Set(["setup", "focus", "checkpoint", "process", "close", "task", "routine"]);
  const looksActionable = items.some((item) => actionLikeKinds.has(asString(item?.kind).toLowerCase()));
  return looksActionable ? "checklist" : "open";
}

function createStepExecution(step, progressKind, { enteredElapsedSec = null } = {}) {
  return {
    progressKind,
    checkedItemIds: [],
    enteredElapsedSec: Number.isFinite(enteredElapsedSec) ? normalizeElapsed(enteredElapsedSec) : null,
    completed: false,
  };
}

function createStepExecutionMap(runbook, { mode = "preview", elapsedSec = 0 } = {}) {
  return Object.fromEntries(
    (Array.isArray(runbook?.steps) ? runbook.steps : []).map((step, index) => {
      const progressKind = inferProgressKind(runbook?.protocolType, step);
      return [
        step.id,
        createStepExecution(step, progressKind, {
          enteredElapsedSec: mode === "active" && index === 0 ? normalizeElapsed(elapsedSec) : null,
        }),
      ];
    })
  );
}

function normalizeCheckedItemIds(rawValue, step) {
  const validIds = new Set((Array.isArray(step?.items) ? step.items : []).map((item) => item?.id).filter(Boolean));
  if (!Array.isArray(rawValue) || !validIds.size) return [];
  const next = [];
  rawValue.forEach((id) => {
    const value = asString(id);
    if (!value || !validIds.has(value) || next.includes(value)) return;
    next.push(value);
  });
  return next;
}

function normalizeExecutionEntry(rawValue, step, protocolType) {
  const source = isPlainObject(rawValue) ? rawValue : null;
  const progressKind = source?.progressKind === "timed" || source?.progressKind === "checklist" || source?.progressKind === "open"
    ? source.progressKind
    : inferProgressKind(protocolType, step);
  return {
    progressKind,
    checkedItemIds: normalizeCheckedItemIds(source?.checkedItemIds, step),
    enteredElapsedSec: Number.isFinite(source?.enteredElapsedSec) ? normalizeElapsed(source.enteredElapsedSec) : null,
    completed: source?.completed === true,
  };
}

function cloneExecutionMap(stepExecutionById = {}) {
  return Object.fromEntries(
    Object.entries(stepExecutionById).map(([stepId, entry]) => [
      stepId,
      {
        progressKind: entry?.progressKind || "open",
        checkedItemIds: Array.isArray(entry?.checkedItemIds) ? [...entry.checkedItemIds] : [],
        enteredElapsedSec: Number.isFinite(entry?.enteredElapsedSec) ? entry.enteredElapsedSec : null,
        completed: entry?.completed === true,
      },
    ])
  );
}

function areStringArraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

function areExecutionEntriesEqual(a, b) {
  return (
    (a?.progressKind || "open") === (b?.progressKind || "open") &&
    areStringArraysEqual(a?.checkedItemIds || [], b?.checkedItemIds || []) &&
    (Number.isFinite(a?.enteredElapsedSec) ? a.enteredElapsedSec : null) ===
      (Number.isFinite(b?.enteredElapsedSec) ? b.enteredElapsedSec : null) &&
    (a?.completed === true) === (b?.completed === true)
  );
}

export function createGuidedSpatialState({
  sessionRunbook = null,
  mode = "preview",
  elapsedSec = 0,
  nowMs = Date.now(),
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  if (!runbook) return null;
  const nextMode = mode === "active" ? "active" : "preview";
  const safeElapsedSec = normalizeElapsed(elapsedSec);
  const stepExecutionById = createStepExecutionMap(runbook, {
    mode: nextMode,
    elapsedSec: safeElapsedSec,
  });
  return {
    mode: nextMode,
    viewedStepIndex: 0,
    activeStepIndex: 0,
    activeStepEnteredElapsedSec: nextMode === "active" ? safeElapsedSec : null,
    stepExecutionById,
    lastPreparedAtMs: Number.isFinite(nowMs) ? Math.round(nowMs) : Date.now(),
    isRegenerating: false,
  };
}

export function normalizeGuidedSpatialState(rawValue, { sessionRunbook = null } = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  if (!runbook) return null;
  const steps = Array.isArray(runbook.steps) ? runbook.steps : [];
  const maxIndex = Math.max(steps.length - 1, 0);
  const source = isPlainObject(rawValue) ? rawValue : {};
  const mode = source.mode === "active" ? "active" : "preview";
  const stepExecutionById = Object.fromEntries(
    steps.map((step) => [
      step.id,
      normalizeExecutionEntry(source.stepExecutionById?.[step.id], step, runbook.protocolType),
    ])
  );

  const activeStepIndex = normalizeIndex(source.activeStepIndex, maxIndex);
  const viewedStepIndex = normalizeIndex(
    Number.isFinite(source.viewedStepIndex) ? source.viewedStepIndex : activeStepIndex,
    maxIndex
  );
  const activeStep = steps[activeStepIndex];
  const activeEntry = stepExecutionById[activeStep?.id];
  const activeStepEnteredElapsedSec =
    mode === "active"
      ? Number.isFinite(source.activeStepEnteredElapsedSec)
        ? normalizeElapsed(source.activeStepEnteredElapsedSec)
        : Number.isFinite(activeEntry?.enteredElapsedSec)
          ? normalizeElapsed(activeEntry.enteredElapsedSec)
          : null
      : null;

  if (mode === "active" && activeEntry && !Number.isFinite(activeEntry.enteredElapsedSec)) {
    activeEntry.enteredElapsedSec = activeStepEnteredElapsedSec;
  }

  return {
    mode,
    viewedStepIndex,
    activeStepIndex,
    activeStepEnteredElapsedSec,
    stepExecutionById,
    lastPreparedAtMs: Number.isFinite(source.lastPreparedAtMs) ? Math.round(source.lastPreparedAtMs) : Date.now(),
    isRegenerating: source.isRegenerating === true,
  };
}

export function areGuidedSpatialStatesEqual(a, b, { sessionRunbook = null } = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  const left = normalizeGuidedSpatialState(a, { sessionRunbook: runbook });
  const right = normalizeGuidedSpatialState(b, { sessionRunbook: runbook });
  if (!left || !right) return left === right;
  if (
    left.mode !== right.mode ||
    left.viewedStepIndex !== right.viewedStepIndex ||
    left.activeStepIndex !== right.activeStepIndex ||
    left.activeStepEnteredElapsedSec !== right.activeStepEnteredElapsedSec ||
    left.lastPreparedAtMs !== right.lastPreparedAtMs ||
    left.isRegenerating !== right.isRegenerating
  ) {
    return false;
  }

  const steps = Array.isArray(runbook?.steps) ? runbook.steps : [];
  return steps.every((step) =>
    areExecutionEntriesEqual(left.stepExecutionById?.[step.id], right.stepExecutionById?.[step.id])
  );
}

function resolveStepState(stepIndex, activeStepIndex, executionEntry) {
  if (executionEntry?.completed) return "done";
  if (stepIndex < activeStepIndex) return "done";
  if (stepIndex === activeStepIndex) return "current";
  return "upcoming";
}

function deriveTimedItemProgress(step, stepElapsedSec) {
  const items = Array.isArray(step?.items) ? step.items : [];
  if (!items.length) {
    return {
      currentItem: null,
      currentItemIndex: 0,
      currentItemProgress01: 0,
      nextItem: null,
      stepElapsedSec: 0,
      stepRemainingSec: 0,
    };
  }

  const safeElapsedSec = normalizeElapsed(stepElapsedSec);
  let threshold = 0;
  let currentItemIndex = items.length - 1;
  for (let index = 0; index < items.length; index += 1) {
    threshold += Math.max(60, Math.round((items[index]?.minutes || 1) * 60));
    if (safeElapsedSec < threshold) {
      currentItemIndex = index;
      break;
    }
  }

  const currentItem = items[currentItemIndex] || null;
  const previousThreshold = items
    .slice(0, currentItemIndex)
    .reduce((sum, item) => sum + Math.max(60, Math.round((item?.minutes || 1) * 60)), 0);
  const currentItemDurationSec = Math.max(60, Math.round((currentItem?.minutes || 1) * 60));
  const elapsedWithinItemSec = clamp(0, safeElapsedSec - previousThreshold, currentItemDurationSec);
  return {
    currentItem,
    currentItemIndex,
    currentItemProgress01: currentItemDurationSec > 0 ? elapsedWithinItemSec / currentItemDurationSec : 0,
    nextItem: items[currentItemIndex + 1] || null,
  };
}

function enrichStep({
  step,
  stepIndex,
  activeStepIndex,
  viewedStepIndex,
  executionEntry,
  elapsedSec,
}) {
  const progressKind = executionEntry.progressKind;
  const isActive = stepIndex === activeStepIndex;
  const isViewed = stepIndex === viewedStepIndex;
  const state = resolveStepState(stepIndex, activeStepIndex, executionEntry);
  const items = Array.isArray(step.items) ? step.items : [];
  const totalItems = items.length;
  const checkedIds = executionEntry.checkedItemIds || [];

  let progress01 = executionEntry.completed ? 1 : 0;
  let progressLabel = "";
  let stepElapsedSec = 0;
  let stepRemainingSec = Math.max(0, Math.round((step.minutes || 0) * 60));
  let currentItem = items[0] || null;
  let currentItemIndex = 0;
  let currentItemProgress01 = 0;
  let nextItem = items[1] || null;

  if (progressKind === "timed") {
    if (isActive) {
      const enteredElapsedSec = Number.isFinite(executionEntry.enteredElapsedSec) ? executionEntry.enteredElapsedSec : 0;
      const stepDurationSec = Math.max(60, Math.round((step.minutes || 1) * 60));
      stepElapsedSec = clamp(0, elapsedSec - enteredElapsedSec, stepDurationSec);
      stepRemainingSec = Math.max(stepDurationSec - stepElapsedSec, 0);
      progress01 = stepDurationSec > 0 ? stepElapsedSec / stepDurationSec : 0;
      const timedState = deriveTimedItemProgress(step, stepElapsedSec);
      currentItem = timedState.currentItem;
      currentItemIndex = timedState.currentItemIndex;
      currentItemProgress01 = timedState.currentItemProgress01;
      nextItem = timedState.nextItem
        ? {
            ...timedState.nextItem,
            stepLabel: step.label,
            stepIndex,
          }
        : null;
    } else if (executionEntry.completed || state === "done") {
      progress01 = 1;
      stepElapsedSec = Math.max(0, Math.round((step.minutes || 0) * 60));
      stepRemainingSec = 0;
      currentItem = items[items.length - 1] || null;
      currentItemIndex = Math.max(items.length - 1, 0);
      currentItemProgress01 = 1;
      nextItem = null;
    }
    progressLabel = stepRemainingSec > 0 ? `${Math.ceil(stepRemainingSec / 60)} min` : "Terminé";
  } else if (progressKind === "checklist") {
    const checkedCount = checkedIds.length;
    progress01 = totalItems > 0 ? checkedCount / totalItems : 0;
    progressLabel = `${checkedCount}/${Math.max(totalItems, 1)} cochés`;
    const uncheckedItems = items.filter((item) => !checkedIds.includes(item.id));
    currentItem = uncheckedItems[0] || items[items.length - 1] || null;
    currentItemIndex = currentItem ? items.findIndex((item) => item.id === currentItem.id) : 0;
    currentItemProgress01 = checkedIds.includes(currentItem?.id) ? 1 : 0;
    nextItem = uncheckedItems[1] || null;
  } else {
    progress01 = executionEntry.completed ? 1 : isActive ? 0.45 : 0;
    progressLabel = executionEntry.completed ? "Terminé" : isActive ? "En cours" : "À venir";
    currentItem = items[0] || null;
    currentItemIndex = 0;
    nextItem = items[1] || null;
  }

  return {
    ...step,
    progressKind,
    isActive,
    isViewed,
    state,
    checkedCount: checkedIds.length,
    totalItems,
    progress01: clamp(0, progress01, 1),
    progressLabel,
    stepElapsedSec,
    stepRemainingSec,
    currentItem,
    currentItemIndex: Math.max(0, currentItemIndex),
    currentItemProgress01: clamp(0, currentItemProgress01, 1),
    nextItem,
    items: items.map((item) => ({
      ...item,
      checked: checkedIds.includes(item.id),
    })),
  };
}

export function deriveGuidedSpatialPlan({
  sessionRunbook = null,
  guidedSpatialState = null,
  elapsedSec = 0,
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  if (!runbook) return null;
  const spatialState = normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: runbook });
  if (!spatialState) return null;

  const safeElapsedSec = normalizeElapsed(elapsedSec);
  const steps = runbook.steps.map((step, stepIndex) =>
    enrichStep({
      step,
      stepIndex,
      activeStepIndex: spatialState.activeStepIndex,
      viewedStepIndex: spatialState.viewedStepIndex,
      executionEntry: spatialState.stepExecutionById[step.id],
      elapsedSec: safeElapsedSec,
    })
  );

  const activeStep = steps[spatialState.activeStepIndex] || steps[0] || null;
  const viewedStep = steps[spatialState.viewedStepIndex] || activeStep;

  return {
    mode: spatialState.mode,
    title: runbook.title,
    totalSteps: steps.length,
    totalItems: steps.reduce((count, step) => count + step.items.length, 0),
    activeStepIndex: spatialState.activeStepIndex,
    viewedStepIndex: spatialState.viewedStepIndex,
    activeStep,
    viewedStep,
    currentStepIndex: spatialState.activeStepIndex,
    currentStep: activeStep,
    currentItemIndex: activeStep?.currentItemIndex || 0,
    currentItem: activeStep?.currentItem || null,
    currentItemProgress01: activeStep?.currentItemProgress01 || 0,
    nextItem: activeStep?.nextItem || null,
    steps,
    isViewedStepActive: spatialState.viewedStepIndex === spatialState.activeStepIndex,
    canReturnToActiveStep: spatialState.viewedStepIndex !== spatialState.activeStepIndex,
    canAdvanceStep:
      spatialState.mode === "active" &&
      activeStep &&
      activeStep.progressKind !== "timed" &&
      activeStep.state !== "done",
  };
}

function withActiveStepEntry(state, runbook, elapsedSec) {
  const activeStep = runbook.steps[state.activeStepIndex] || runbook.steps[0];
  if (!activeStep) return state;
  const currentEntry = state.stepExecutionById[activeStep.id];
  if (Number.isFinite(currentEntry?.enteredElapsedSec)) return state;
  const stepExecutionById = cloneExecutionMap(state.stepExecutionById);
  stepExecutionById[activeStep.id] = {
    ...currentEntry,
    enteredElapsedSec: normalizeElapsed(elapsedSec),
  };
  return {
    ...state,
    activeStepEnteredElapsedSec: normalizeElapsed(elapsedSec),
    stepExecutionById,
  };
}

export function activateGuidedSpatialState({
  guidedSpatialState = null,
  sessionRunbook = null,
  elapsedSec = 0,
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  const state = normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: runbook });
  if (!runbook || !state) return null;
  const safeElapsedSec = normalizeElapsed(elapsedSec);
  const stepExecutionById = cloneExecutionMap(state.stepExecutionById);
  const activeStep = runbook.steps[state.activeStepIndex] || runbook.steps[0];
  if (activeStep) {
    stepExecutionById[activeStep.id] = {
      ...stepExecutionById[activeStep.id],
      enteredElapsedSec: safeElapsedSec,
    };
  }
  return {
    ...state,
    mode: "active",
    viewedStepIndex: state.activeStepIndex,
    activeStepEnteredElapsedSec: safeElapsedSec,
    stepExecutionById,
  };
}

export function setGuidedSpatialViewedStep({
  guidedSpatialState = null,
  sessionRunbook = null,
  stepIndex = 0,
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  const state = normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: runbook });
  if (!runbook || !state) return null;
  const viewedStepIndex = normalizeIndex(stepIndex, runbook.steps.length - 1);
  if (viewedStepIndex === state.viewedStepIndex) return state;
  return {
    ...state,
    viewedStepIndex,
  };
}

export function returnGuidedSpatialToActive({
  guidedSpatialState = null,
  sessionRunbook = null,
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  const state = normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: runbook });
  if (!runbook || !state) return null;
  if (state.viewedStepIndex === state.activeStepIndex) return state;
  return {
    ...state,
    viewedStepIndex: state.activeStepIndex,
  };
}

export function syncGuidedSpatialStateWithElapsed({
  sessionRunbook = null,
  guidedSpatialState = null,
  elapsedSec = 0,
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  const inputState = isPlainObject(guidedSpatialState) ? guidedSpatialState : null;
  let state = normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: runbook });
  if (!runbook || !state || state.mode !== "active") {
    return inputState && areGuidedSpatialStatesEqual(inputState, state, { sessionRunbook: runbook })
      ? inputState
      : state;
  }
  const initialState = state;
  state = withActiveStepEntry(state, runbook, elapsedSec);

  const safeElapsedSec = normalizeElapsed(elapsedSec);
  let nextState = state;
  while (true) {
    const activeStep = runbook.steps[nextState.activeStepIndex];
    if (!activeStep) break;
    const entry = nextState.stepExecutionById[activeStep.id];
    if (entry?.progressKind !== "timed") break;
    const enteredElapsedSec = Number.isFinite(entry.enteredElapsedSec)
      ? entry.enteredElapsedSec
      : Number.isFinite(nextState.activeStepEnteredElapsedSec)
        ? nextState.activeStepEnteredElapsedSec
        : 0;
    const stepDurationSec = Math.max(60, Math.round((activeStep.minutes || 1) * 60));
    if (safeElapsedSec - enteredElapsedSec < stepDurationSec) break;
    if (nextState.activeStepIndex >= runbook.steps.length - 1) {
      const stepExecutionById = cloneExecutionMap(nextState.stepExecutionById);
      stepExecutionById[activeStep.id] = {
        ...stepExecutionById[activeStep.id],
        completed: true,
      };
      nextState = {
        ...nextState,
        stepExecutionById,
      };
      break;
    }

    const nextIndex = nextState.activeStepIndex + 1;
    const nextStep = runbook.steps[nextIndex];
    const nextEnteredElapsedSec = enteredElapsedSec + stepDurationSec;
    const stepExecutionById = cloneExecutionMap(nextState.stepExecutionById);
    stepExecutionById[activeStep.id] = {
      ...stepExecutionById[activeStep.id],
      completed: true,
    };
    stepExecutionById[nextStep.id] = {
      ...stepExecutionById[nextStep.id],
      enteredElapsedSec: Number.isFinite(stepExecutionById[nextStep.id]?.enteredElapsedSec)
        ? stepExecutionById[nextStep.id].enteredElapsedSec
        : nextEnteredElapsedSec,
    };
    nextState = {
      ...nextState,
      activeStepIndex: nextIndex,
      activeStepEnteredElapsedSec: nextEnteredElapsedSec,
      viewedStepIndex: nextState.viewedStepIndex === nextState.activeStepIndex ? nextIndex : nextState.viewedStepIndex,
      stepExecutionById,
    };
  }

  if (areGuidedSpatialStatesEqual(nextState, initialState, { sessionRunbook: runbook })) {
    return inputState && areGuidedSpatialStatesEqual(inputState, initialState, { sessionRunbook: runbook })
      ? inputState
      : initialState;
  }

  return nextState;
}

export function toggleGuidedSpatialChecklistItem({
  guidedSpatialState = null,
  sessionRunbook = null,
  stepId = "",
  itemId = "",
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  const state = normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: runbook });
  const nextStepId = asString(stepId);
  const nextItemId = asString(itemId);
  if (!runbook || !state || state.mode !== "active" || !nextStepId || !nextItemId) return state;
  const activeStep = runbook.steps[state.activeStepIndex];
  if (!activeStep || activeStep.id !== nextStepId) return state;
  const entry = state.stepExecutionById[nextStepId];
  if (!entry || entry.progressKind !== "checklist") return state;
  const checkedItemIds = entry.checkedItemIds.includes(nextItemId)
    ? entry.checkedItemIds.filter((id) => id !== nextItemId)
    : [...entry.checkedItemIds, nextItemId];
  if (areStringArraysEqual(checkedItemIds, entry.checkedItemIds)) return state;
  const stepExecutionById = cloneExecutionMap(state.stepExecutionById);
  stepExecutionById[nextStepId] = {
    ...stepExecutionById[nextStepId],
    checkedItemIds,
  };
  return {
    ...state,
    stepExecutionById,
  };
}

export function advanceGuidedSpatialStep({
  guidedSpatialState = null,
  sessionRunbook = null,
  elapsedSec = 0,
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  const state = normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: runbook });
  if (!runbook || !state || state.mode !== "active") return state;
  const activeStep = runbook.steps[state.activeStepIndex];
  if (!activeStep) return state;
  const stepExecutionById = cloneExecutionMap(state.stepExecutionById);
  stepExecutionById[activeStep.id] = {
    ...stepExecutionById[activeStep.id],
    completed: true,
  };
  if (state.activeStepIndex >= runbook.steps.length - 1) {
    return {
      ...state,
      stepExecutionById,
    };
  }

  const nextIndex = state.activeStepIndex + 1;
  const nextStep = runbook.steps[nextIndex];
  const safeElapsedSec = normalizeElapsed(elapsedSec);
  stepExecutionById[nextStep.id] = {
    ...stepExecutionById[nextStep.id],
    enteredElapsedSec: safeElapsedSec,
  };
  return {
    ...state,
    activeStepIndex: nextIndex,
    activeStepEnteredElapsedSec: safeElapsedSec,
    viewedStepIndex: state.viewedStepIndex === state.activeStepIndex ? nextIndex : state.viewedStepIndex,
    stepExecutionById,
  };
}

function findStepIndex(runbook, stepCandidate, fallbackIndex = 0) {
  if (!runbook || !Array.isArray(runbook.steps) || !runbook.steps.length) return 0;
  if (stepCandidate?.id) {
    const byId = runbook.steps.findIndex((step) => step.id === stepCandidate.id);
    if (byId >= 0) return byId;
  }
  if (stepCandidate?.label) {
    const byLabel = runbook.steps.findIndex((step) => step.label === stepCandidate.label);
    if (byLabel >= 0) return byLabel;
  }
  return normalizeIndex(fallbackIndex, runbook.steps.length - 1);
}

export function rebaseGuidedSpatialState({
  guidedSpatialState = null,
  previousRunbook = null,
  nextRunbook = null,
  mode = "active",
  elapsedSec = 0,
} = {}) {
  const previous = normalizeSessionRunbook(previousRunbook);
  const next = normalizeSessionRunbook(nextRunbook);
  const currentState = normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: previous });
  if (!next) return null;

  const base = createGuidedSpatialState({
    sessionRunbook: next,
    mode,
    elapsedSec,
  });
  if (!currentState || !previous) return base;

  const activeStepCandidate = previous.steps[currentState.activeStepIndex] || null;
  const viewedStepCandidate = previous.steps[currentState.viewedStepIndex] || activeStepCandidate;
  const activeStepIndex = findStepIndex(next, activeStepCandidate, currentState.activeStepIndex);
  const viewedStepIndex =
    mode === "active"
      ? findStepIndex(next, viewedStepCandidate, activeStepIndex)
      : findStepIndex(next, viewedStepCandidate, currentState.viewedStepIndex);

  const nextState = {
    ...base,
    activeStepIndex,
    viewedStepIndex,
  };

  if (mode === "active") {
    const activeStep = next.steps[activeStepIndex];
    if (activeStep) {
      nextState.stepExecutionById[activeStep.id] = {
        ...nextState.stepExecutionById[activeStep.id],
        enteredElapsedSec: normalizeElapsed(elapsedSec),
      };
    }
  }

  return nextState;
}
