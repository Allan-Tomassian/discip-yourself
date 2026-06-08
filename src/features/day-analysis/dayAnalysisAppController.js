import {
  DAY_ANALYSIS_ACTION_TYPE,
  DAY_ANALYSIS_DETERMINISTIC_KIND,
  DAY_ANALYSIS_SUPPORT_STATUS,
  DAY_ANALYSIS_TARGET_TYPE,
} from "./dayAnalysisTypes";
import { buildDayAnalysisSnapshot } from "./dayAnalysisSnapshot";
import { PLANNING_REPAIR_TYPE, applyOccurrenceRepair } from "../../logic/planningRepairModel";
import { validateSystemInvariants } from "../../logic/systemInvariants";

const SUPPORTED_DIRECT_REPAIR_TYPES = new Set([
  PLANNING_REPAIR_TYPE.REDUCE_DURATION,
  PLANNING_REPAIR_TYPE.MOVE_LATER_TODAY,
  PLANNING_REPAIR_TYPE.MOVE_TOMORROW,
]);

const SUPPORTED_DIRECT_ACTION_TYPES = new Set([
  DAY_ANALYSIS_ACTION_TYPE.REDUCE_DURATION,
  DAY_ANALYSIS_ACTION_TYPE.MOVE_LATER_TODAY,
  DAY_ANALYSIS_ACTION_TYPE.MOVE_TOMORROW,
  DAY_ANALYSIS_ACTION_TYPE.SIMPLIFY_NEXT_ACTION,
]);

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSupportStatus(action) {
  return safeString(action?.supportStatus);
}

function normalizeActionType(action) {
  return safeString(action?.type);
}

function normalizeTargetType(action) {
  return safeString(action?.targetType);
}

function getTargetOccurrenceId(action) {
  if (!action) return "";
  if (normalizeTargetType(action) === DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE) {
    return safeString(action.targetId);
  }
  return safeString(action?.deterministicAction?.occurrenceId);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneRepair(repair) {
  return isPlainObject(repair) ? JSON.parse(JSON.stringify(repair)) : null;
}

function getDirectRepair(action) {
  const deterministicAction = isPlainObject(action?.deterministicAction) ? action.deterministicAction : null;
  const repair = cloneRepair(deterministicAction?.repair);
  if (!repair) return null;
  repair.type = safeString(repair.type);
  repair.occurrenceId = safeString(repair.occurrenceId) || getTargetOccurrenceId(action);
  return repair;
}

function hasSafePreview(action) {
  const preview = action?.preview;
  if (!isPlainObject(preview)) return false;
  return Boolean(
    safeString(preview.summary) ||
      safeString(preview.targetTitle) ||
      safeString(preview.occurrenceTitle) ||
      safeString(preview.actionTitle) ||
      isPlainObject(preview.before) ||
      isPlainObject(preview.after) ||
      Number.isFinite(Number(preview.durationMinutes))
  );
}

function sameRepair(left, right) {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

export function isDayAnalysisActionDirectlyApplicable(action) {
  if (!action) return false;
  if (normalizeSupportStatus(action) !== DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE) return false;
  if (normalizeTargetType(action) !== DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE) return false;
  if (!SUPPORTED_DIRECT_ACTION_TYPES.has(normalizeActionType(action))) return false;
  if (safeString(action?.deterministicAction?.kind) !== DAY_ANALYSIS_DETERMINISTIC_KIND.PLANNING_REPAIR) {
    return false;
  }

  const repair = getDirectRepair(action);
  if (!repair?.occurrenceId || !SUPPORTED_DIRECT_REPAIR_TYPES.has(repair.type)) return false;
  return hasSafePreview(action);
}

export function resolveDayAnalysisActionHandoff(action) {
  if (!action) return { kind: "none" };

  const type = normalizeActionType(action);
  const supportStatus = normalizeSupportStatus(action);
  const targetType = normalizeTargetType(action);
  const deterministicKind = safeString(action?.deterministicAction?.kind);

  if (type === DAY_ANALYSIS_ACTION_TYPE.NO_CHANGE || supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.NO_CHANGE) {
    return { kind: "close" };
  }

  if (
    type === DAY_ANALYSIS_ACTION_TYPE.OPEN_COACH ||
    targetType === DAY_ANALYSIS_TARGET_TYPE.COACH
  ) {
    return { kind: "coach" };
  }

  if (
    type === DAY_ANALYSIS_ACTION_TYPE.OPEN_PLANNING ||
    targetType === DAY_ANALYSIS_TARGET_TYPE.PLANNING
  ) {
    return { kind: "planning" };
  }

  if (
    type === DAY_ANALYSIS_ACTION_TYPE.RECOVER_BLOCK ||
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.RECOVERY_SHEET ||
    deterministicKind === DAY_ANALYSIS_DETERMINISTIC_KIND.RECOVERY
  ) {
    const occurrenceId = getTargetOccurrenceId(action);
    if (!occurrenceId) return { kind: "planning" };
    return {
      kind: "recovery",
      occurrenceId,
      context: safeString(action?.deterministicAction?.context),
    };
  }

  if (
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.REVIEW_ONLY ||
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.UNAVAILABLE
  ) {
    return { kind: "planning" };
  }

  if (isDayAnalysisActionDirectlyApplicable(action)) {
    return { kind: "direct_apply" };
  }

  if (
    supportStatus === DAY_ANALYSIS_SUPPORT_STATUS.APPLICABLE &&
    targetType === DAY_ANALYSIS_TARGET_TYPE.OCCURRENCE
  ) {
    return { kind: "planning" };
  }

  return { kind: "planning" };
}

export function buildDayAnalysisRecoveryRequest({
  action,
  selectedDateKey = "",
  source = "day_analysis",
} = {}) {
  const handoff = resolveDayAnalysisActionHandoff(action);
  if (handoff.kind !== "recovery" || !handoff.occurrenceId) return null;

  return {
    occurrenceId: handoff.occurrenceId,
    context: handoff.context,
    source,
    selectedDateKey,
    originTab: "today",
    successTab: "today",
  };
}

function findCurrentCandidate({ state, todayData, selectedDateKey, now, action }) {
  const snapshot = buildDayAnalysisSnapshot({
    state,
    todayData,
    selectedDateKey,
    now,
  });
  const candidates = safeArray(snapshot.deterministicActions);
  const actionId = safeString(action?.id);
  return {
    snapshot,
    candidate: candidates.find((candidate) => safeString(candidate?.id) === actionId) || null,
  };
}

function summarizeAppliedRepair({ action, repairResult }) {
  const preview = isPlainObject(action?.preview) ? action.preview : {};
  const label = safeString(action?.label);
  const previewSummary = safeString(preview.summary);
  const repairSummary = safeString(repairResult?.repairSummary);
  if (previewSummary) return previewSummary;
  if (repairSummary) return repairSummary;
  if (label) return label;
  return "Ajustement appliqué.";
}

export function applyDayAnalysisDeterministicAction({
  state,
  todayData = null,
  selectedDateKey = "",
  action,
  now,
} = {}) {
  const currentState = state && typeof state === "object" ? state : {};
  const date = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();

  if (!isDayAnalysisActionDirectlyApplicable(action)) {
    return {
      ok: false,
      nextState: null,
      appliedAction: null,
      changedOccurrenceIds: [],
      warnings: ["day_analysis_action_not_applicable"],
      invariantIssues: [],
      errorCode: "DAY_ANALYSIS_ACTION_UNSUPPORTED",
      summary: "",
    };
  }

  const repair = getDirectRepair(action);
  const occurrenceId = repair?.occurrenceId || getTargetOccurrenceId(action);
  const occurrence = safeArray(currentState.occurrences).find((entry) => safeString(entry?.id) === occurrenceId) || null;
  if (!occurrence) {
    return {
      ok: false,
      nextState: null,
      appliedAction: null,
      changedOccurrenceIds: [],
      warnings: ["occurrence_missing"],
      invariantIssues: [],
      errorCode: "DAY_ANALYSIS_STALE_TARGET",
      summary: "",
    };
  }

  let currentCandidate;
  try {
    currentCandidate = findCurrentCandidate({
      state: currentState,
      todayData,
      selectedDateKey,
      now: date,
      action,
    }).candidate;
  } catch {
    currentCandidate = null;
  }

  if (!currentCandidate || !isDayAnalysisActionDirectlyApplicable(currentCandidate)) {
    return {
      ok: false,
      nextState: null,
      appliedAction: null,
      changedOccurrenceIds: [],
      warnings: ["day_analysis_candidate_stale"],
      invariantIssues: [],
      errorCode: "DAY_ANALYSIS_STALE_CANDIDATE",
      summary: "",
    };
  }

  const currentRepair = getDirectRepair(currentCandidate);
  if (!sameRepair(repair, currentRepair)) {
    return {
      ok: false,
      nextState: null,
      appliedAction: null,
      changedOccurrenceIds: [],
      warnings: ["day_analysis_candidate_changed"],
      invariantIssues: [],
      errorCode: "DAY_ANALYSIS_STALE_CANDIDATE",
      summary: "",
    };
  }

  const repairResult = applyOccurrenceRepair({
    state: currentState,
    occurrenceId,
    repair: {
      ...currentRepair,
      reason: safeString(currentRepair.reason) || "day_analysis_apply",
    },
    now: date,
  });

  if (!repairResult?.ok || !repairResult.nextState) {
    return {
      ok: false,
      nextState: null,
      appliedAction: null,
      changedOccurrenceIds: safeArray(repairResult?.changedOccurrenceIds),
      warnings: safeArray(repairResult?.warnings),
      invariantIssues: [],
      errorCode: "DAY_ANALYSIS_APPLY_FAILED",
      summary: "",
    };
  }

  const invariants = validateSystemInvariants(repairResult.nextState, {
    now: date,
    todayKey: selectedDateKey,
  });
  if (!invariants.ok) {
    return {
      ok: false,
      nextState: null,
      appliedAction: null,
      changedOccurrenceIds: safeArray(repairResult.changedOccurrenceIds),
      warnings: safeArray(repairResult.warnings),
      invariantIssues: safeArray(invariants.issues),
      errorCode: "DAY_ANALYSIS_INVARIANT_FAILED",
      summary: "",
    };
  }

  return {
    ok: true,
    nextState: repairResult.nextState,
    appliedAction: action,
    changedOccurrenceIds: safeArray(repairResult.changedOccurrenceIds),
    warnings: safeArray(repairResult.warnings),
    invariantIssues: [],
    errorCode: "",
    summary: summarizeAppliedRepair({ action, repairResult }),
  };
}
