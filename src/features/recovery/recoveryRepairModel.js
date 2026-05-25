import {
  PLANNING_REPAIR_TYPE,
  applyOccurrenceRecoveryRepair,
} from "../../logic/planningRepairModel";
import {
  SYSTEM_INVARIANT_SEVERITY,
  validateSystemInvariants,
} from "../../logic/systemInvariants";
import { RECOVERY_OPTION_TYPE } from "./recoveryTypes";

const MUTATING_OPTION_TYPES = new Set([
  RECOVERY_OPTION_TYPE.REDUCE_DURATION,
  RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY,
  RECOVERY_OPTION_TYPE.MOVE_TOMORROW,
  RECOVERY_OPTION_TYPE.CHOOSE_TIME,
  RECOVERY_OPTION_TYPE.SKIP_ONCE,
]);

const NON_MUTATING_OPTION_TYPES = new Set([
  RECOVERY_OPTION_TYPE.OPEN_COACH_FOR_HELP,
  RECOVERY_OPTION_TYPE.OPEN_PLANNING_DETAIL,
]);

const OPTION_TO_REPAIR_TYPE = Object.freeze({
  [RECOVERY_OPTION_TYPE.REDUCE_DURATION]: PLANNING_REPAIR_TYPE.REDUCE_DURATION,
  [RECOVERY_OPTION_TYPE.MOVE_LATER_TODAY]: PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
  [RECOVERY_OPTION_TYPE.MOVE_TOMORROW]: PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
  [RECOVERY_OPTION_TYPE.CHOOSE_TIME]: PLANNING_REPAIR_TYPE.CHOOSE_TIME,
  [RECOVERY_OPTION_TYPE.SKIP_ONCE]: PLANNING_REPAIR_TYPE.SKIP_ONCE,
});

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOption(option) {
  return option && typeof option === "object" ? option : {};
}

function buildApplyResult({
  ok,
  state,
  nextState,
  appliedOption = null,
  changedOccurrenceIds = [],
  warnings = [],
  invariantIssues = [],
  errorCode = "",
  summary = "",
}) {
  return {
    ok: Boolean(ok),
    nextState: nextState || state || null,
    appliedOption,
    changedOccurrenceIds: Array.from(new Set(safeArray(changedOccurrenceIds).filter(Boolean))),
    warnings: safeArray(warnings).filter(Boolean),
    invariantIssues: safeArray(invariantIssues),
    errorCode: safeString(errorCode),
    summary: safeString(summary),
  };
}

function buildRepairFromOption(option, occurrenceId) {
  const previewRepair = option?.preview?.repair;
  if (previewRepair && typeof previewRepair === "object") {
    return {
      ...previewRepair,
      occurrenceId: safeString(previewRepair.occurrenceId) || occurrenceId,
      type: safeString(previewRepair.type) || OPTION_TO_REPAIR_TYPE[option.type],
    };
  }
  const repairType = OPTION_TO_REPAIR_TYPE[option.type];
  if (!repairType) return null;
  return {
    type: repairType,
    occurrenceId,
    reason: safeString(option.reason),
  };
}

function getInvariantErrors(invariantResult) {
  return safeArray(invariantResult?.issues).filter(
    (issue) => issue?.severity === SYSTEM_INVARIANT_SEVERITY.ERROR
  );
}

export function applyRecoveryOption({ state, occurrenceId, option, now } = {}) {
  const normalizedOption = normalizeOption(option);
  const optionType = safeString(normalizedOption.type);
  const targetOccurrenceId =
    safeString(occurrenceId) ||
    safeString(normalizedOption.occurrenceId) ||
    safeString(normalizedOption.preview?.occurrenceId);

  if (!optionType) {
    return buildApplyResult({
      ok: false,
      state,
      errorCode: "option_missing",
      summary: "Aucune option de récupération valide.",
    });
  }

  if (NON_MUTATING_OPTION_TYPES.has(optionType)) {
    return buildApplyResult({
      ok: true,
      state,
      nextState: state,
      appliedOption: normalizedOption,
      summary: safeString(normalizedOption.preview?.summary) || safeString(normalizedOption.label),
    });
  }

  if (!MUTATING_OPTION_TYPES.has(optionType)) {
    return buildApplyResult({
      ok: false,
      state,
      appliedOption: normalizedOption,
      errorCode: "option_type_unsupported",
      summary: "Option de récupération non prise en charge.",
    });
  }

  const repair = buildRepairFromOption(normalizedOption, targetOccurrenceId);
  if (!repair || !targetOccurrenceId) {
    return buildApplyResult({
      ok: false,
      state,
      appliedOption: normalizedOption,
      errorCode: "repair_missing",
      summary: "Réparation indisponible pour ce bloc.",
    });
  }

  const repairResult = applyOccurrenceRecoveryRepair({
    state,
    occurrenceId: targetOccurrenceId,
    repair,
    now,
  });

  if (!repairResult.ok) {
    return buildApplyResult({
      ok: false,
      state,
      appliedOption: normalizedOption,
      warnings: repairResult.warnings,
      errorCode: repairResult.warnings?.[0] || "repair_failed",
      summary: "Le bloc n’a pas été modifié.",
    });
  }

  const invariantResult = validateSystemInvariants(repairResult.nextState);
  const invariantErrors = getInvariantErrors(invariantResult);
  if (invariantErrors.length) {
    return buildApplyResult({
      ok: false,
      state,
      appliedOption: normalizedOption,
      warnings: repairResult.warnings,
      invariantIssues: invariantResult.issues,
      errorCode: "invariant_failed",
      summary: "Le changement a été bloqué pour protéger le système.",
    });
  }

  return buildApplyResult({
    ok: true,
    state,
    nextState: repairResult.nextState,
    appliedOption: normalizedOption,
    changedOccurrenceIds: repairResult.changedOccurrenceIds,
    warnings: repairResult.warnings,
    invariantIssues: invariantResult.issues,
    summary:
      safeString(normalizedOption.preview?.summary) ||
      safeString(repairResult.repairSummary) ||
      "Bloc récupéré.",
  });
}
