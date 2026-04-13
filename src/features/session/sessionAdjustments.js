import { normalizeSessionRunbook, summarizeSessionRunbookPatch } from "./sessionRunbook";
import {
  activateGuidedSpatialState,
  createGuidedSpatialState,
  deriveGuidedSpatialPlan,
  normalizeGuidedSpatialState,
} from "./sessionSpatialRuntime";

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveMinutes(value, fallback = 1) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Math.max(1, Math.round(next));
}

function sumMinutes(list) {
  return (Array.isArray(list) ? list : []).reduce(
    (total, entry) => total + normalizePositiveMinutes(entry?.minutes, 0),
    0
  );
}

function scaleBuckets(values, targetMinutes) {
  const safeValues = (Array.isArray(values) ? values : []).map((value) => normalizePositiveMinutes(value, 1));
  if (!safeValues.length) return [];
  const safeTarget = Math.max(safeValues.length, normalizePositiveMinutes(targetMinutes, safeValues.length));
  const base = safeValues.reduce((sum, value) => sum + value, 0);
  let scaled = safeValues.map((value) => Math.max(1, Math.floor((value / base) * safeTarget)));
  let current = scaled.reduce((sum, value) => sum + value, 0);

  while (current < safeTarget) {
    let candidateIndex = 0;
    let bestRatio = -Infinity;
    scaled.forEach((value, index) => {
      const ratio = safeValues[index] / value;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        candidateIndex = index;
      }
    });
    scaled[candidateIndex] += 1;
    current += 1;
  }

  while (current > safeTarget) {
    let candidateIndex = -1;
    let bestMargin = -Infinity;
    scaled.forEach((value, index) => {
      if (value <= 1) return;
      const margin = value - safeValues[index] / base;
      if (margin > bestMargin) {
        bestMargin = margin;
        candidateIndex = index;
      }
    });
    if (candidateIndex === -1) break;
    scaled[candidateIndex] -= 1;
    current -= 1;
  }

  return scaled;
}

function minutesFromSeconds(seconds, fallback = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.max(0, Math.ceil(seconds / 60));
}

function cloneRunbook(runbook) {
  return {
    ...runbook,
    objective: runbook?.objective ? { ...runbook.objective } : null,
    steps: Array.isArray(runbook?.steps)
      ? runbook.steps.map((step) => ({
          ...step,
          items: Array.isArray(step?.items) ? step.items.map((item) => ({ ...item })) : [],
        }))
      : [],
  };
}

function softenGuidance(text, mode) {
  const base = asString(text);
  if (!base) return base;
  if (mode === "lighter") return `${base} Reste à une intensité modérée.`;
  if (mode === "shorter") return `${base} Garde seulement le coeur utile du segment.`;
  if (mode === "recenter") return `${base} Reste sur la plus petite version crédible.`;
  return base;
}

function summarizeAdjustment(label, summary, adjustedDurationMinutes, extra = {}) {
  return {
    kind: extra.kind || "adjustment",
    strategyId: extra.strategyId || "",
    cause: extra.cause || "",
    label,
    summary,
    adjustedDurationMinutes,
    protocolOverride: extra.protocolOverride || null,
    applyFrom: extra.applyFrom || null,
    runbookPatch: extra.runbookPatch || null,
    aiPreferred: extra.aiPreferred === true,
  };
}

function buildProtocolOverride(actionProtocol, overrides = {}) {
  const base = actionProtocol && typeof actionProtocol === "object" ? actionProtocol : null;
  return {
    why: asString(overrides.why) || base?.why || "",
    firstStep: asString(overrides.firstStep) || base?.firstStep || "",
    ifBlocked: asString(overrides.ifBlocked) || base?.ifBlocked || "",
    successDefinition: asString(overrides.successDefinition) || base?.successDefinition || "",
  };
}

export const SESSION_ADJUST_CAUSES = Object.freeze([
  { id: "less_time", label: "Moins de temps" },
  { id: "less_energy", label: "Moins d’énergie" },
  { id: "running_late", label: "Je suis en retard" },
  { id: "blocked", label: "Je bloque" },
]);

export function buildStandardAdjustmentOptions({
  cause = "",
  plannedMinutes = 20,
  remainingMinutes = plannedMinutes,
  actionProtocol = null,
} = {}) {
  const safePlanned = normalizePositiveMinutes(plannedMinutes, 20);
  const safeRemaining = normalizePositiveMinutes(remainingMinutes, safePlanned);

  if (cause === "less_time") {
    return [
      summarizeAdjustment(
        "Version courte",
        "Garde seulement le coeur utile de la séance.",
        Math.max(5, Math.round(safeRemaining * 0.6)),
        {
          cause,
          strategyId: "short",
          protocolOverride: buildProtocolOverride(actionProtocol, {
            firstStep: "attaque directement le coeur du bloc",
            ifBlocked: "tiens un passage court mais net",
            successDefinition: "noyau du bloc tenu proprement",
          }),
        }
      ),
      summarizeAdjustment(
        "Version condensée",
        "Compresse la séance depuis maintenant sans changer de sujet.",
        Math.max(8, Math.round(safeRemaining * 0.75)),
        {
          cause,
          strategyId: "condensed",
          protocolOverride: buildProtocolOverride(actionProtocol, {
            firstStep: "reprends au point utile le plus proche",
            ifBlocked: "supprime le reste non essentiel",
            successDefinition: "progression visible malgré le temps réduit",
          }),
        }
      ),
    ];
  }

  if (cause === "less_energy") {
    return [
      summarizeAdjustment(
        "Version allégée",
        "Conserve l’objectif avec un rythme plus doux.",
        Math.max(5, Math.round(safeRemaining * 0.8)),
        {
          cause,
          strategyId: "lighter",
          protocolOverride: buildProtocolOverride(actionProtocol, {
            firstStep: "lance une version plus douce du bloc",
            ifBlocked: "garde seulement la version minimale utile",
            successDefinition: "bloc tenu sans forcer",
          }),
        }
      ),
    ];
  }

  if (cause === "running_late") {
    return [
      summarizeAdjustment(
        "Version condensée",
        "Recolle au timing en supprimant le non essentiel.",
        Math.max(5, Math.round(safeRemaining * 0.7)),
        {
          cause,
          strategyId: "catch_up",
          protocolOverride: buildProtocolOverride(actionProtocol, {
            firstStep: "reprends directement là où le bloc devient utile",
            ifBlocked: "tiens une séquence courte et propre",
            successDefinition: "séance relancée malgré le retard",
          }),
        }
      ),
    ];
  }

  if (cause === "blocked") {
    return [
      summarizeAdjustment(
        "Relance concrète",
        "Repars sur le plus petit pas crédible.",
        safeRemaining,
        {
          cause,
          strategyId: "restart",
          protocolOverride: buildProtocolOverride(actionProtocol, {
            firstStep: "reprends par une action de 2 minutes maximum",
            ifBlocked: "reste sur ce seul pas jusqu’à relance",
            successDefinition: "élan relancé sans repartir de zéro",
          }),
        }
      ),
    ];
  }

  return [];
}

export function applyStandardAdjustmentLocally({
  cause = "",
  strategyId = "",
  plannedMinutes = 20,
  remainingMinutes = plannedMinutes,
  actionProtocol = null,
} = {}) {
  const option = buildStandardAdjustmentOptions({
    cause,
    plannedMinutes,
    remainingMinutes,
    actionProtocol,
  }).find((entry) => entry.strategyId === strategyId);

  if (!option) return null;
  return {
    ...option,
    kind: "standard",
  };
}

function buildGuidedAdjustmentOptionsForCause(cause, runbook, elapsedSec, guidedSpatialState = null) {
  const currentState = deriveGuidedAdjustmentContext({
    sessionRunbook: runbook,
    guidedSpatialState,
    elapsedSec,
  });
  if (!currentState) return [];
  const remainingMinutes = Math.max(
    1,
    normalizePositiveMinutes(runbook.durationMinutes, 20) - minutesFromSeconds(elapsedSec, 0)
  );

  if (cause === "less_time") {
    return [
      summarizeAdjustment("Raccourcir en gardant le coeur", "Réduit la suite en conservant les segments qui comptent.", Math.max(4, Math.round(remainingMinutes * 0.6)), {
        cause,
        strategyId: "shorten_keep_core",
        applyFrom: currentState.currentItem?.id || null,
      }),
      summarizeAdjustment("Compresser depuis maintenant", "Resserre les segments restants sans casser l’ordre du plan.", Math.max(4, Math.round(remainingMinutes * 0.75)), {
        cause,
        strategyId: "compress_from_now",
        applyFrom: currentState.currentItem?.id || null,
      }),
    ];
  }

  if (cause === "less_energy") {
    return [
      summarizeAdjustment("Baisser l’intensité", "Conserve le but du bloc avec une exécution plus douce.", Math.max(4, Math.round(remainingMinutes * 0.85)), {
        cause,
        strategyId: "lower_intensity_keep_goal",
        applyFrom: currentState.currentItem?.id || null,
      }),
    ];
  }

  if (cause === "running_late") {
    return [
      summarizeAdjustment("Compresser depuis maintenant", "Recolle au timing sans changer le cap de la séance.", Math.max(4, Math.round(remainingMinutes * 0.7)), {
        cause,
        strategyId: "compress_from_now",
        applyFrom: currentState.currentItem?.id || null,
      }),
      summarizeAdjustment("Raccourcir en gardant le coeur", "Conserve le segment central et ferme plus vite.", Math.max(4, Math.round(remainingMinutes * 0.55)), {
        cause,
        strategyId: "shorten_keep_core",
        applyFrom: currentState.currentItem?.id || null,
      }),
    ];
  }

  if (cause === "blocked") {
    return [
      summarizeAdjustment("Relancer sur un sous-segment concret", "Réécrit la suite autour de la prochaine action la plus faisable.", Math.max(4, remainingMinutes), {
        cause,
        strategyId: "recenter_on_subsegment",
        applyFrom: currentState.currentItem?.id || null,
        aiPreferred: true,
      }),
    ];
  }

  return [];
}

function selectCoreItems(runbook, currentStepIndex, currentItemIndex) {
  return runbook.steps.map((step, stepIndex) => {
    const items = step.items.filter((item, itemIndex) => {
      if (stepIndex < currentStepIndex) return false;
      if (stepIndex === currentStepIndex && itemIndex < currentItemIndex) return false;
      if (stepIndex === currentStepIndex && itemIndex === currentItemIndex) return true;
      if (itemIndex === 0) return true;
      if (itemIndex === step.items.length - 1 && stepIndex === runbook.steps.length - 1) return true;
      return false;
    });
    return { ...step, items: items.length ? items : step.items.slice(0, 1) };
  });
}

function deriveGuidedAdjustmentContext({
  sessionRunbook = null,
  guidedSpatialState = null,
  elapsedSec = 0,
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  if (!runbook) return null;
  const normalizedSpatialState =
    normalizeGuidedSpatialState(guidedSpatialState, { sessionRunbook: runbook }) ||
    activateGuidedSpatialState({
      guidedSpatialState: createGuidedSpatialState({
        sessionRunbook: runbook,
        mode: "preview",
      }),
      sessionRunbook: runbook,
      elapsedSec,
    });
  const plan = deriveGuidedSpatialPlan({
    sessionRunbook: runbook,
    guidedSpatialState: normalizedSpatialState,
    elapsedSec,
  });
  if (!plan?.activeStep) return null;
  return {
    guidedSpatialState: normalizedSpatialState,
    currentStepIndex: plan.activeStepIndex,
    currentStep: plan.activeStep,
    currentItemIndex: plan.currentItemIndex,
    currentItem: plan.currentItem,
  };
}

function scaleRunbookFuture(runbook, strategyId, elapsedSec, guidedSpatialState = null) {
  const currentState = deriveGuidedAdjustmentContext({
    sessionRunbook: runbook,
    guidedSpatialState,
    elapsedSec,
  });
  if (!currentState) return null;
  const currentStepIndex = currentState.currentStepIndex;
  const currentItemIndex = currentState.currentItemIndex;
  const nextRunbook = cloneRunbook(runbook);
  const remainingElapsedMinutes = minutesFromSeconds(elapsedSec, 0);
  const baseRemainingMinutes = Math.max(runbook.durationMinutes - remainingElapsedMinutes, 1);
  const scaleTarget =
    strategyId === "shorten_keep_core"
      ? Math.max(4, Math.round(baseRemainingMinutes * 0.6))
      : Math.max(4, Math.round(baseRemainingMinutes * 0.75));

  const stepSource =
    strategyId === "shorten_keep_core"
      ? selectCoreItems(nextRunbook, currentStepIndex, currentItemIndex)
      : nextRunbook.steps.map((step) => ({ ...step, items: step.items.map((item) => ({ ...item })) }));

  const remainingItems = [];
  stepSource.forEach((step, stepIndex) => {
    step.items.forEach((item, itemIndex) => {
      if (stepIndex < currentStepIndex) return;
      if (stepIndex === currentStepIndex && itemIndex < currentItemIndex) return;
      remainingItems.push({ stepIndex, itemIndex, minutes: item.minutes });
    });
  });

  const scaled = scaleBuckets(
    remainingItems.map((entry) => entry.minutes),
    scaleTarget
  );

  remainingItems.forEach((entry, index) => {
    stepSource[entry.stepIndex].items[entry.itemIndex].minutes = scaled[index];
    stepSource[entry.stepIndex].items[entry.itemIndex].guidance = softenGuidance(
      stepSource[entry.stepIndex].items[entry.itemIndex].guidance,
      strategyId === "shorten_keep_core" ? "shorter" : "recenter"
    );
  });

  nextRunbook.steps = stepSource.map((step) => ({
    ...step,
    minutes: sumMinutes(step.items),
  }));
  nextRunbook.durationMinutes = nextRunbook.steps.reduce((sum, step) => sum + step.minutes, 0);
  return nextRunbook;
}

function softenRunbookIntensity(runbook, elapsedSec, guidedSpatialState = null) {
  const currentState = deriveGuidedAdjustmentContext({
    sessionRunbook: runbook,
    guidedSpatialState,
    elapsedSec,
  });
  if (!currentState) return null;
  const nextRunbook = cloneRunbook(runbook);
  nextRunbook.steps = nextRunbook.steps.map((step, stepIndex) => ({
    ...step,
    purpose:
      stepIndex < currentState.currentStepIndex
        ? step.purpose
        : step.purpose
          ? `${step.purpose} en version plus douce`
          : "tenir le coeur du bloc avec moins d’intensité",
    items: step.items.map((item, itemIndex) => {
      if (stepIndex < currentState.currentStepIndex) return item;
      if (stepIndex === currentState.currentStepIndex && itemIndex < currentState.currentItemIndex) return item;
      return {
        ...item,
        guidance: softenGuidance(item.guidance, "lighter"),
        restSec: runbook.protocolType === "sport" ? Math.max(item.restSec || 0, 30) : item.restSec,
      };
    }),
  }));
  nextRunbook.durationMinutes = Math.max(
    4,
    Math.round(nextRunbook.steps.reduce((sum, step) => sum + step.minutes, 0) * 0.9)
  );
  return nextRunbook;
}

function recenterRunbook(runbook, elapsedSec, guidedSpatialState = null) {
  const currentState = deriveGuidedAdjustmentContext({
    sessionRunbook: runbook,
    guidedSpatialState,
    elapsedSec,
  });
  if (!currentState) return null;
  const nextRunbook = cloneRunbook(runbook);
  const lastStep = nextRunbook.steps[nextRunbook.steps.length - 1];
  const currentStep = nextRunbook.steps[currentState.currentStepIndex];
  const currentItem = currentStep.items[currentState.currentItemIndex];
  const retainedCurrentStepItems = currentStep.items
    .slice(currentState.currentItemIndex, currentState.currentItemIndex + 2)
    .map((item, index) => ({
      ...item,
      minutes: index === 0 ? item.minutes : Math.max(1, Math.round(item.minutes * 0.75)),
      guidance: softenGuidance(item.guidance, "recenter"),
    }));

  nextRunbook.steps = [
    {
      ...currentStep,
      label: "Relance",
      purpose: "reprendre le bloc par le point le plus faisable",
      successCue: "élan relancé proprement",
      items: retainedCurrentStepItems.length
        ? retainedCurrentStepItems
        : [
            {
              ...currentItem,
              guidance: softenGuidance(currentItem.guidance, "recenter"),
            },
          ],
      minutes: sumMinutes(retainedCurrentStepItems.length ? retainedCurrentStepItems : [currentItem]),
    },
    {
      ...lastStep,
      label: "Clôture",
      purpose: "sortir avec une suite claire",
      items: lastStep.items.slice(0, 1).map((item) => ({
        ...item,
        guidance: softenGuidance(item.guidance, "recenter"),
      })),
      minutes: sumMinutes(lastStep.items.slice(0, 1)),
    },
  ];
  nextRunbook.durationMinutes = nextRunbook.steps.reduce((sum, step) => sum + step.minutes, 0);
  return nextRunbook;
}

export function buildGuidedAdjustmentOptions({
  cause = "",
  sessionRunbook = null,
  guidedSpatialState = null,
  elapsedSec = 0,
} = {}) {
  const normalizedRunbook = normalizeSessionRunbook(sessionRunbook);
  if (!normalizedRunbook) return [];
  return buildGuidedAdjustmentOptionsForCause(cause, normalizedRunbook, elapsedSec, guidedSpatialState);
}

export function applyGuidedAdjustmentLocally({
  cause = "",
  strategyId = "",
  sessionRunbook = null,
  guidedSpatialState = null,
  elapsedSec = 0,
} = {}) {
  const normalizedRunbook = normalizeSessionRunbook(sessionRunbook);
  if (!normalizedRunbook) return null;
  const currentState = deriveGuidedAdjustmentContext({
    sessionRunbook: normalizedRunbook,
    guidedSpatialState,
    elapsedSec,
  });
  if (!currentState) return null;

  let patchedRunbook = null;
  if (strategyId === "shorten_keep_core" || strategyId === "compress_from_now") {
    patchedRunbook = scaleRunbookFuture(normalizedRunbook, strategyId, elapsedSec, guidedSpatialState);
  } else if (strategyId === "lower_intensity_keep_goal") {
    patchedRunbook = softenRunbookIntensity(normalizedRunbook, elapsedSec, guidedSpatialState);
  } else if (strategyId === "recenter_on_subsegment") {
    patchedRunbook = recenterRunbook(normalizedRunbook, elapsedSec, guidedSpatialState);
  }

  if (!patchedRunbook) return null;
  const option = buildGuidedAdjustmentOptionsForCause(cause, normalizedRunbook, elapsedSec, guidedSpatialState).find(
    (entry) => entry.strategyId === strategyId
  );
  if (!option) return null;

  return {
    adjustment: {
      ...option,
      kind: "guided",
      adjustedDurationMinutes: patchedRunbook.durationMinutes,
      runbookPatch: summarizeSessionRunbookPatch(patchedRunbook),
    },
    sessionRunbook: patchedRunbook,
    currentState,
  };
}
