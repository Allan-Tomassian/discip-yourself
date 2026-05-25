import { RECOVERY_CONTEXT, RECOVERY_OPTION_TYPE } from "./recoveryTypes";

export const RECOVERY_SHEET_STATE = Object.freeze({
  CLOSED: "closed",
  READY: "ready",
  CONFIRMATION: "confirmation",
  APPLYING: "applying",
  SUCCESS: "success",
  ERROR: "error",
});

export const RECOVERY_OPTION_ACTION = Object.freeze({
  SELECT: "select",
  CONFIRM: "confirm",
  OPEN_COACH: "open_coach",
  OPEN_PLANNING: "open_planning",
  IGNORE: "ignore",
});

const MAX_VISIBLE_OPTIONS = 4;

const CONTEXT_COPY = Object.freeze({
  [RECOVERY_CONTEXT.MISSED]: {
    title: "Ce bloc n’a pas été lancé.",
    description: "Tu peux le récupérer sans refaire toute la journée.",
  },
  [RECOVERY_CONTEXT.LATE]: {
    title: "Ce bloc est en retard.",
    description: "Il est encore récupérable en version simple.",
  },
  [RECOVERY_CONTEXT.BLOCKED]: {
    title: "Ce bloc t’a bloqué.",
    description: "Réduis-le ou déplace-le pour reprendre.",
  },
  [RECOVERY_CONTEXT.REPORTED]: {
    title: "Ce bloc a été signalé.",
    description: "Choisis un créneau plus réaliste.",
  },
  [RECOVERY_CONTEXT.POSTPONED]: {
    title: "Ce bloc a été déplacé.",
    description: "Vérifie le créneau prévu ou choisis une option plus simple.",
  },
});

const SECONDARY_OPTION_TYPES = new Set([
  RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP,
  RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL,
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeRecoveryContext(recoveryContext) {
  if (isPlainObject(recoveryContext)) {
    return {
      context: safeString(recoveryContext.context),
      problem: isPlainObject(recoveryContext.problem) ? recoveryContext.problem : null,
      occurrence: isPlainObject(recoveryContext.occurrence) ? recoveryContext.occurrence : null,
      options: safeArray(recoveryContext.options),
    };
  }
  return {
    context: safeString(recoveryContext),
    problem: null,
    occurrence: null,
    options: [],
  };
}

function optionHasUsefulDisabledReason(option) {
  return Boolean(
    safeString(option?.reason) ||
    safeString(option?.description) ||
    safeString(option?.preview?.summary)
  );
}

export function getRecoveryProblemCopy({ recoveryContext, problem } = {}) {
  const normalized = normalizeRecoveryContext(recoveryContext);
  const source = isPlainObject(problem) ? problem : normalized.problem;
  const fallback = CONTEXT_COPY[normalized.context] || {
    title: "Bloc à récupérer.",
    description: "Choisis une correction simple.",
  };
  return {
    title: safeString(source?.title) || fallback.title,
    description: safeString(source?.description) || fallback.description,
    context: normalized.context,
    occurrenceId: safeString(source?.occurrenceId) || safeString(normalized.occurrence?.id),
    sourceOccurrenceId: safeString(source?.sourceOccurrenceId),
  };
}

export function getVisibleRecoveryOptions({ recoveryContext, options } = {}) {
  const normalized = normalizeRecoveryContext(recoveryContext);
  const sourceOptions = safeArray(options).length ? options : normalized.options;
  return sourceOptions
    .filter((option) => isPlainObject(option))
    .filter((option) => !option.disabled || optionHasUsefulDisabledReason(option))
    .slice(0, MAX_VISIBLE_OPTIONS);
}

export function shouldConfirmRecoveryOption(option) {
  return Boolean(option?.confirmationRequired || option?.destructive);
}

export function getRecoveryOptionTone(option) {
  if (option?.destructive) return "critical";
  if (option?.type === RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP) return "ai";
  if (option?.type === RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL) return "neutral";
  if (shouldConfirmRecoveryOption(option)) return "attention";
  return "execution";
}

export function getRecoveryOptionKind(option) {
  return SECONDARY_OPTION_TYPES.has(option?.type) ? "secondary" : "primary";
}

export function getRecoveryOptionSelectionAction(option) {
  if (!option || option.disabled) return RECOVERY_OPTION_ACTION.IGNORE;
  if (option.type === RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP) return RECOVERY_OPTION_ACTION.OPEN_COACH;
  if (option.type === RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL) return RECOVERY_OPTION_ACTION.OPEN_PLANNING;
  if (shouldConfirmRecoveryOption(option)) return RECOVERY_OPTION_ACTION.CONFIRM;
  return RECOVERY_OPTION_ACTION.SELECT;
}

function findOptionById(options, optionId) {
  const id = safeString(optionId);
  if (!id) return null;
  return safeArray(options).find((option) => option?.id === id) || null;
}

function resolveResultSummary(result) {
  return (
    safeString(result?.summary) ||
    safeString(result?.appliedOption?.preview?.summary) ||
    safeString(result?.appliedOption?.label) ||
    "Le bloc a été récupéré."
  );
}

function hasError(error, result) {
  if (error) return true;
  return Boolean(result && result.ok === false);
}

function getErrorCode(error, result) {
  if (isPlainObject(error)) return safeString(error.code) || safeString(error.errorCode);
  return safeString(result?.errorCode);
}

export function buildRecoverySheetViewModel({
  open = false,
  recoveryContext = null,
  problem = null,
  options = [],
  pending = false,
  result = null,
  error = null,
  confirmingOptionId = "",
} = {}) {
  const visibleOptions = getVisibleRecoveryOptions({ recoveryContext, options });
  const problemCopy = getRecoveryProblemCopy({ recoveryContext, problem });
  const hasContext = Boolean(problemCopy.context || visibleOptions.length || result || error);

  if (!open || !hasContext) {
    return {
      state: RECOVERY_SHEET_STATE.CLOSED,
      problem: problemCopy,
      options: [],
      confirmingOption: null,
      summary: "",
      errorCode: "",
    };
  }

  if (pending) {
    return {
      state: RECOVERY_SHEET_STATE.APPLYING,
      problem: problemCopy,
      options: visibleOptions,
      confirmingOption: findOptionById(visibleOptions, confirmingOptionId),
      summary: "Application de l’ajustement.",
      errorCode: "",
    };
  }

  if (hasError(error, result)) {
    return {
      state: RECOVERY_SHEET_STATE.ERROR,
      problem: problemCopy,
      options: visibleOptions,
      confirmingOption: null,
      summary: "Aucun changement n’a été appliqué.",
      errorCode: getErrorCode(error, result),
    };
  }

  if (result?.ok) {
    return {
      state: RECOVERY_SHEET_STATE.SUCCESS,
      problem: problemCopy,
      options: visibleOptions,
      confirmingOption: null,
      summary: resolveResultSummary(result),
      errorCode: "",
    };
  }

  const confirmingOption = findOptionById(visibleOptions, confirmingOptionId);
  if (confirmingOption) {
    return {
      state: RECOVERY_SHEET_STATE.CONFIRMATION,
      problem: problemCopy,
      options: visibleOptions,
      confirmingOption,
      summary: safeString(confirmingOption.preview?.summary) || safeString(confirmingOption.description),
      errorCode: "",
    };
  }

  return {
    state: RECOVERY_SHEET_STATE.READY,
    problem: problemCopy,
    options: visibleOptions,
    confirmingOption: null,
    summary: "",
    errorCode: "",
  };
}
