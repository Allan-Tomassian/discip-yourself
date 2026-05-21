import { resolveGoalType } from "../../domain/goalType";
import {
  appDowFromDate,
  fromLocalDateKey,
  normalizeLocalDateKey,
  normalizeStartTime,
  parseTimeToMinutes,
} from "../../utils/datetime";
import { OCCURRENCE_STATUS, normalizeOccurrenceStatus } from "../../logic/occurrenceStatus";

export const SYSTEM_ANALYSIS_RESULT_VERSION = Object.freeze({
  V1: 1,
  V2: 2,
});

export const SYSTEM_ANALYSIS_DRAFT_VERSION = Object.freeze({
  V1: 1,
  V2: 2,
});

export const SYSTEM_ANALYSIS_MODE = Object.freeze({
  INITIAL: "initial_analysis",
  HYBRID: "hybrid_analysis",
  BEHAVIORAL: "behavioral_analysis",
});

export const SYSTEM_ANALYSIS_CORRECTION_ACTION = Object.freeze({
  MOVE: "move",
  REDUCE_DURATION: "reduce_duration",
  POSTPONE: "postpone",
  SKIP_ONCE: "skip_once",
  PROTECT: "protect",
});

export const SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION = Object.freeze({
  ADD: "add",
  REMOVE: "remove",
  REPLACE: "replace",
  REDUCE: "reduce",
  MOVE: "move",
  PROTECT: "protect",
  PAUSE: "pause",
  CLARIFY: "clarify",
  MERGE: "merge",
  SPLIT: "split",
  KEEP: "keep",
  REBALANCE: "rebalance",
  LINK: "link",
});

export const SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE = Object.freeze({
  OCCURRENCE: "occurrence",
  OBJECTIVE: "objective",
  ACTION: "action",
  SCHEDULE: "schedule",
  SYSTEM: "system",
});

export const SYSTEM_ANALYSIS_SUPPORT_STATUS = Object.freeze({
  APPLICABLE: "applicable",
  NEEDS_REVIEW: "needs_review",
  UNSUPPORTED: "unsupported",
});

export const SYSTEM_ANALYSIS_CONFIRMATION_LEVEL = Object.freeze({
  STANDARD: "standard",
  STRONG: "strong",
  DESTRUCTIVE: "destructive",
});

export const SYSTEM_ANALYSIS_ISSUE_SEVERITY = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
});

const MAX_ARRAY_LENGTHS = Object.freeze({
  invisibleFriction: 8,
  systemWeaknesses: 8,
  strongestPatterns: 8,
  recommendedCorrections: 10,
  next7DaysFocus: 7,
  coachQuestions: 5,
  dataLimitations: 12,
  safetyNotes: 8,
});
const MAX_CORRECTION_ITEMS = 16;
const MAX_CORRECTION_ITEM_EVIDENCE = 8;
const MAX_STRING_LENGTH = 2400;
const ALLOWED_RESULT_VERSIONS = new Set(Object.values(SYSTEM_ANALYSIS_RESULT_VERSION));
const ALLOWED_DRAFT_VERSIONS = new Set(Object.values(SYSTEM_ANALYSIS_DRAFT_VERSION));
const ALLOWED_ANALYSIS_MODES = new Set(Object.values(SYSTEM_ANALYSIS_MODE));
const ALLOWED_OCCURRENCE_ACTIONS = new Set(Object.values(SYSTEM_ANALYSIS_CORRECTION_ACTION));
const ALLOWED_CORRECTION_ITEM_ACTIONS = new Set(Object.values(SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION));
const ALLOWED_CORRECTION_TARGET_TYPES = new Set(Object.values(SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE));
const ALLOWED_SUPPORT_STATUSES = new Set(Object.values(SYSTEM_ANALYSIS_SUPPORT_STATUS));
const ALLOWED_CONFIRMATION_LEVELS = new Set(Object.values(SYSTEM_ANALYSIS_CONFIRMATION_LEVEL));
const TARGET_ID_OPTIONAL_ACTIONS = new Set([SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.ADD]);
const APPLICABLE_OCCURRENCE_ACTIONS = new Set([
  SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.MOVE,
  SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REDUCE,
]);
const FINAL_REPAIR_STATUSES = new Set([
  OCCURRENCE_STATUS.DONE,
  OCCURRENCE_STATUS.MISSED,
  OCCURRENCE_STATUS.SKIPPED,
  OCCURRENCE_STATUS.CANCELED,
  OCCURRENCE_STATUS.RESCHEDULED,
]);
const DIRECT_PERSISTED_OBJECT_KEYS = new Set([
  "occurrence",
  "occurrences",
  "goal",
  "goals",
  "actionObject",
  "actionPayload",
  "persistedOccurrence",
  "persistedGoal",
]);
const DIRECT_OCCURRENCE_FIELD_KEYS = new Set([
  "status",
  "goalId",
  "scheduleRuleId",
  "doneAt",
  "repairV1",
  "startAt",
  "endAt",
]);
const MEDICAL_CLAIM_RE =
  /\b(diagnostique|diagnose|diagnosis|medical|m[eé]dical|clinique|d[eé]pression|depression|tdah|adhd|bipolaire|bipolar)\b/i;
const GUILT_LANGUAGE_RE =
  /\b(tu as [eé]chou[eé]|tu es paresseux|paresseuse|faible|manque de volont[eé]|aucune discipline|c'est ta faute)\b/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeIssue(issue) {
  return {
    code: safeString(issue?.code),
    severity: issue?.severity || SYSTEM_ANALYSIS_ISSUE_SEVERITY.ERROR,
    path: safeString(issue?.path),
    message: safeString(issue?.message),
    entityType: safeString(issue?.entityType) || null,
    entityId: safeString(issue?.entityId) || null,
    relatedIds: safeArray(issue?.relatedIds).map(safeString).filter(Boolean),
  };
}

function pushIssue(issues, issue) {
  issues.push(normalizeIssue(issue));
}

function makeResult(issues, normalized) {
  const normalizedIssues = issues.map(normalizeIssue);
  return {
    ok: normalizedIssues.every((issue) => issue.severity !== SYSTEM_ANALYSIS_ISSUE_SEVERITY.ERROR),
    issues: normalizedIssues,
    normalized,
  };
}

function getStateMaps(state) {
  const goals = safeArray(state?.goals);
  const occurrences = safeArray(state?.occurrences);
  return {
    goals,
    occurrences,
    goalIds: new Set(goals.map((goal) => safeString(goal?.id)).filter(Boolean)),
    actionIds: new Set(
      goals
        .filter((goal) => safeString(goal?.id) && resolveGoalType(goal) === "PROCESS")
        .map((goal) => safeString(goal.id))
    ),
    objectiveIds: new Set(
      goals
        .filter((goal) => safeString(goal?.id) && resolveGoalType(goal) === "OUTCOME")
        .map((goal) => safeString(goal.id))
    ),
    occurrenceIds: new Set(occurrences.map((occurrence) => safeString(occurrence?.id)).filter(Boolean)),
    occurrencesById: new Map(occurrences.map((occurrence) => [safeString(occurrence?.id), occurrence]).filter(([id]) => Boolean(id))),
  };
}

function periodsMatch(resultPeriod, snapshotPeriod) {
  if (!snapshotPeriod) return true;
  return (
    normalizeLocalDateKey(resultPeriod?.startDateKey) === normalizeLocalDateKey(snapshotPeriod?.startDateKey) &&
    normalizeLocalDateKey(resultPeriod?.endDateKey) === normalizeLocalDateKey(snapshotPeriod?.endDateKey)
  );
}

function scanText(value, visitor, path = "") {
  if (typeof value === "string") {
    visitor(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanText(entry, visitor, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, entry]) => scanText(entry, visitor, path ? `${path}.${key}` : key));
  }
}

function scanObjects(value, visitor, path = "") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanObjects(entry, visitor, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  visitor(value, path);
  Object.entries(value).forEach(([key, entry]) => scanObjects(entry, visitor, path ? `${path}.${key}` : key));
}

function validateNoUnsafeText(value, issues) {
  scanText(value, (text, path) => {
    if (text.length > MAX_STRING_LENGTH) {
      pushIssue(issues, {
        code: "STRING_TOO_LONG",
        path,
        message: "System analysis result contains an oversized string.",
        severity: SYSTEM_ANALYSIS_ISSUE_SEVERITY.ERROR,
      });
    }
    if (MEDICAL_CLAIM_RE.test(text)) {
      pushIssue(issues, {
        code: "UNSUPPORTED_MEDICAL_CLAIM",
        path,
        message: "System analysis result contains unsupported medical or clinical language.",
        severity: SYSTEM_ANALYSIS_ISSUE_SEVERITY.ERROR,
      });
    }
    if (GUILT_LANGUAGE_RE.test(text)) {
      pushIssue(issues, {
        code: "GUILT_LANGUAGE_DETECTED",
        path,
        message: "System analysis result contains guilt-oriented language.",
        severity: SYSTEM_ANALYSIS_ISSUE_SEVERITY.WARNING,
      });
    }
  });
}

function validateNoDirectPersistedObjects(value, issues, rootPath = "") {
  scanObjects(value, (object, path) => {
    for (const key of Object.keys(object)) {
      if (DIRECT_PERSISTED_OBJECT_KEYS.has(key)) {
        pushIssue(issues, {
          code: "DIRECT_PERSISTED_OBJECT_FROM_AI",
          path: path ? `${path}.${key}` : key,
          message: "AI output must not include direct persisted source-of-truth objects.",
          severity: SYSTEM_ANALYSIS_ISSUE_SEVERITY.ERROR,
        });
      }
    }
    if (rootPath === "correctionDraft.occurrenceAdjustments" || path.includes("occurrenceAdjustments")) {
      for (const key of Object.keys(object)) {
        if (DIRECT_OCCURRENCE_FIELD_KEYS.has(key)) {
          pushIssue(issues, {
            code: "DIRECT_OCCURRENCE_FIELD_FROM_AI",
            path: path ? `${path}.${key}` : key,
            message: "Occurrence adjustments must use correction fields, not persisted occurrence fields.",
            severity: SYSTEM_ANALYSIS_ISSUE_SEVERITY.ERROR,
          });
        }
      }
    }
  });
}

function validateArrayBounds(result, issues) {
  for (const [key, maxLength] of Object.entries(MAX_ARRAY_LENGTHS)) {
    if (result?.[key] === undefined) continue;
    if (!Array.isArray(result[key])) {
      pushIssue(issues, {
        code: "EXPECTED_ARRAY",
        path: key,
        message: `${key} must be an array.`,
      });
      continue;
    }
    if (result[key].length > maxLength) {
      pushIssue(issues, {
        code: "ARRAY_TOO_LONG",
        path: key,
        message: `${key} exceeds the bounded output contract.`,
      });
    }
  }
}

function validateEvidenceReferences(value, maps, issues) {
  scanObjects(value, (object, path) => {
    if (path.includes("correctionDraft")) return;
    const occurrenceId = safeString(object.occurrenceId);
    if (occurrenceId && !maps.occurrenceIds.has(occurrenceId)) {
      pushIssue(issues, {
        code: "UNKNOWN_EVIDENCE_OCCURRENCE",
        path: path ? `${path}.occurrenceId` : "occurrenceId",
        message: "System analysis result references a missing occurrence.",
        entityType: "occurrence",
        entityId: occurrenceId,
      });
    }
    const actionId = safeString(object.actionId);
    if (actionId && !maps.goalIds.has(actionId)) {
      pushIssue(issues, {
        code: "UNKNOWN_EVIDENCE_ACTION",
        path: path ? `${path}.actionId` : "actionId",
        message: "System analysis result references a missing action.",
        entityType: "goal",
        entityId: actionId,
      });
    }
    const goalId = safeString(object.goalId);
    if (goalId && !maps.goalIds.has(goalId)) {
      pushIssue(issues, {
        code: "UNKNOWN_EVIDENCE_GOAL",
        path: path ? `${path}.goalId` : "goalId",
        message: "System analysis result references a missing goal.",
        entityType: "goal",
        entityId: goalId,
      });
    }
    const objectiveId = safeString(object.objectiveId);
    if (objectiveId && !maps.goalIds.has(objectiveId)) {
      pushIssue(issues, {
        code: "UNKNOWN_EVIDENCE_OBJECTIVE",
        path: path ? `${path}.objectiveId` : "objectiveId",
        message: "System analysis result references a missing objective.",
        entityType: "goal",
        entityId: objectiveId,
      });
    }
  });
}

function pushUnknownReferenceIssue(issues, {
  code,
  path,
  message,
  entityType,
  entityId,
}) {
  pushIssue(issues, {
    code,
    path,
    message,
    entityType,
    entityId: entityId || null,
  });
}

function validateKnownReference({ id, kind, path, maps, issues }) {
  const safeId = safeString(id);
  if (!safeId) return false;
  if (kind === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE) {
    if (!maps.occurrenceIds.has(safeId)) {
      pushUnknownReferenceIssue(issues, {
        code: "UNKNOWN_EVIDENCE_OCCURRENCE",
        path,
        message: "Correction item references a missing occurrence.",
        entityType: "occurrence",
        entityId: safeId,
      });
      return false;
    }
    return true;
  }
  if (kind === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.ACTION) {
    const validAction = maps.actionIds.size ? maps.actionIds.has(safeId) : maps.goalIds.has(safeId);
    if (!validAction) {
      pushUnknownReferenceIssue(issues, {
        code: "UNKNOWN_EVIDENCE_ACTION",
        path,
        message: "Correction item references a missing action.",
        entityType: "goal",
        entityId: safeId,
      });
      return false;
    }
    return true;
  }
  if (kind === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OBJECTIVE) {
    const validObjective = maps.objectiveIds.size ? maps.objectiveIds.has(safeId) : maps.goalIds.has(safeId);
    if (!validObjective) {
      pushUnknownReferenceIssue(issues, {
        code: "UNKNOWN_EVIDENCE_OBJECTIVE",
        path,
        message: "Correction item references a missing objective.",
        entityType: "goal",
        entityId: safeId,
      });
      return false;
    }
    return true;
  }
  return true;
}

function validateCorrectionItemEvidence(evidence, path, maps, issues) {
  if (!Array.isArray(evidence)) {
    pushIssue(issues, {
      code: "CORRECTION_ITEM_EVIDENCE_INVALID",
      path,
      message: "Correction item evidence must be an array.",
    });
    return [];
  }
  if (evidence.length > MAX_CORRECTION_ITEM_EVIDENCE) {
    pushIssue(issues, {
      code: "CORRECTION_ITEM_EVIDENCE_TOO_LONG",
      path,
      message: "Correction item evidence exceeds the bounded output contract.",
    });
  }
  evidence.slice(0, MAX_CORRECTION_ITEM_EVIDENCE).forEach((entry, index) => {
    if (!isPlainObject(entry)) return;
    const evidencePath = `${path}[${index}]`;
    if (safeString(entry.occurrenceId)) {
      validateKnownReference({
        id: entry.occurrenceId,
        kind: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE,
        path: `${evidencePath}.occurrenceId`,
        maps,
        issues,
      });
    }
    if (safeString(entry.actionId)) {
      validateKnownReference({
        id: entry.actionId,
        kind: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.ACTION,
        path: `${evidencePath}.actionId`,
        maps,
        issues,
      });
    }
    if (safeString(entry.objectiveId)) {
      validateKnownReference({
        id: entry.objectiveId,
        kind: SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OBJECTIVE,
        path: `${evidencePath}.objectiveId`,
        maps,
        issues,
      });
    }
    if (safeString(entry.goalId)) {
      validateKnownReference({
        id: entry.goalId,
        kind: maps.objectiveIds.has(safeString(entry.goalId))
          ? SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OBJECTIVE
          : SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.ACTION,
        path: `${evidencePath}.goalId`,
        maps,
        issues,
      });
    }
  });
  return evidence;
}

function getDraftVersion(source, resultVersion) {
  const explicitVersion = Number(source?.version);
  if (explicitVersion === SYSTEM_ANALYSIS_DRAFT_VERSION.V1 || explicitVersion === SYSTEM_ANALYSIS_DRAFT_VERSION.V2) {
    return explicitVersion;
  }
  if (resultVersion === SYSTEM_ANALYSIS_RESULT_VERSION.V2 || source?.correctionItems !== undefined) {
    return SYSTEM_ANALYSIS_DRAFT_VERSION.V2;
  }
  return SYSTEM_ANALYSIS_DRAFT_VERSION.V1;
}

function getItemProposedDate(item) {
  return normalizeLocalDateKey(item?.proposedDateKey || item?.dateKey);
}

function getItemProposedStart(item) {
  return normalizeStartTime(item?.proposedStart || item?.start);
}

function getItemProposedDuration(item) {
  const duration = Number(item?.proposedDurationMinutes ?? item?.durationMinutes);
  return Number.isFinite(duration) ? Math.round(duration) : null;
}

function getItemProposedDailyLoad(item) {
  const proposedLoad = isPlainObject(item?.proposedLoad) ? item.proposedLoad : {};
  return safeNumber(
    item?.proposedMaxDailyMinutes ??
      item?.proposedDailyMinutes ??
      proposedLoad.maxDailyMinutes ??
      proposedLoad.dailyMinutes,
    null
  );
}

function getSnapshotCapacityMinutes(snapshot) {
  return safeNumber(snapshot?.plannedSystem?.capacity?.dailyMinutes, null);
}

function getDateDow(dateKey) {
  const normalized = normalizeLocalDateKey(dateKey);
  if (!normalized) return null;
  const date = fromLocalDateKey(normalized);
  const dow = appDowFromDate(date);
  return Number.isInteger(dow) ? dow : null;
}

function proposedTimeHitsUnavailableWindow({ dateKey, start, snapshot }) {
  const dow = getDateDow(dateKey);
  const startMinutes = parseTimeToMinutes(start);
  if (!dow || !Number.isFinite(startMinutes)) return false;
  return safeArray(snapshot?.plannedSystem?.unavailableWindows).some((windowValue) => {
    const days = safeArray(windowValue?.daysOfWeek).map((day) => Number(day)).filter(Number.isInteger);
    if (days.length && !days.includes(dow)) return false;
    const windowStart = parseTimeToMinutes(windowValue?.startTime);
    const windowEnd = parseTimeToMinutes(windowValue?.endTime);
    if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) return false;
    return startMinutes >= windowStart && startMinutes < windowEnd;
  });
}

function validateDiagnosisSummary(source, issues) {
  const summary = isPlainObject(source?.diagnosisSummary) ? source.diagnosisSummary : null;
  if (!summary) {
    pushIssue(issues, {
      code: "DIAGNOSIS_SUMMARY_REQUIRED",
      path: "diagnosisSummary",
      message: "System analysis v2 result requires a diagnosis summary.",
    });
    return null;
  }
  for (const key of ["primaryFinding", "risk", "opportunity"]) {
    if (!safeString(summary[key])) {
      pushIssue(issues, {
        code: "DIAGNOSIS_SUMMARY_FIELD_REQUIRED",
        path: `diagnosisSummary.${key}`,
        message: `Diagnosis summary requires ${key}.`,
      });
    }
  }
  if (!Array.isArray(summary.evidence)) {
    pushIssue(issues, {
      code: "DIAGNOSIS_SUMMARY_EVIDENCE_REQUIRED",
      path: "diagnosisSummary.evidence",
      message: "Diagnosis summary evidence must be an array.",
    });
  }
  const confidence = Number(summary.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    pushIssue(issues, {
      code: "DIAGNOSIS_SUMMARY_CONFIDENCE_INVALID",
      path: "diagnosisSummary.confidence",
      message: "Diagnosis summary confidence must be between 0 and 1.",
    });
  }
  return {
    ...summary,
    evidence: safeArray(summary.evidence),
    confidence: Number.isFinite(confidence) ? confidence : summary.confidence,
  };
}

function normalizeValidationRequirements(value) {
  return safeArray(value).map(safeString).filter(Boolean);
}

function getAdjustmentDate(adjustment) {
  return normalizeLocalDateKey(adjustment?.proposedDateKey || adjustment?.dateKey);
}

function getAdjustmentStart(adjustment) {
  return normalizeStartTime(adjustment?.proposedStart || adjustment?.start);
}

function getAdjustmentDuration(adjustment) {
  const duration = Number(adjustment?.proposedDurationMinutes ?? adjustment?.durationMinutes);
  return Number.isFinite(duration) ? Math.round(duration) : null;
}

function validateOccurrenceAdjustment(adjustment, index, maps, requirements, issues) {
  const path = `occurrenceAdjustments[${index}]`;
  if (!isPlainObject(adjustment)) {
    pushIssue(issues, { code: "INVALID_OCCURRENCE_ADJUSTMENT", path, message: "Occurrence adjustment must be an object." });
    return null;
  }

  const occurrenceId = safeString(adjustment.occurrenceId);
  const action = safeString(adjustment.action);
  if (!occurrenceId || !maps.occurrenceIds.has(occurrenceId)) {
    pushIssue(issues, {
      code: "CORRECTION_OCCURRENCE_MISSING",
      path: `${path}.occurrenceId`,
      message: "Occurrence adjustment references a missing occurrence.",
      entityType: "occurrence",
      entityId: occurrenceId || null,
    });
  }
  if (!ALLOWED_OCCURRENCE_ACTIONS.has(action)) {
    pushIssue(issues, {
      code: "CORRECTION_ACTION_INVALID",
      path: `${path}.action`,
      message: "Occurrence adjustment uses an unsupported action.",
      entityType: "occurrence",
      entityId: occurrenceId || null,
    });
  }

  const dateKey = getAdjustmentDate(adjustment);
  const start = getAdjustmentStart(adjustment);
  const duration = getAdjustmentDuration(adjustment);
  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.MOVE) {
    if (!dateKey) pushIssue(issues, { code: "CORRECTION_DATE_INVALID", path: `${path}.proposedDateKey`, message: "Move correction requires a valid date." });
    if (!start) pushIssue(issues, { code: "CORRECTION_TIME_INVALID", path: `${path}.proposedStart`, message: "Move correction requires a valid start time." });
  }
  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.POSTPONE && !dateKey) {
    pushIssue(issues, { code: "CORRECTION_DATE_INVALID", path: `${path}.proposedDateKey`, message: "Postpone correction requires a valid date." });
  }
  if (
    action === SYSTEM_ANALYSIS_CORRECTION_ACTION.REDUCE_DURATION &&
    (!Number.isFinite(duration) || duration <= 0)
  ) {
    pushIssue(issues, {
      code: "CORRECTION_DURATION_INVALID",
      path: `${path}.proposedDurationMinutes`,
      message: "Reduce duration correction requires a positive duration.",
    });
  }
  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.SKIP_ONCE && !requirements.includes("destructive_confirmation")) {
    pushIssue(issues, {
      code: "DESTRUCTIVE_CORRECTION_REQUIRES_VALIDATION",
      path,
      message: "Skip-once corrections require an explicit destructive validation requirement.",
    });
  }

  const occurrence = maps.occurrencesById.get(occurrenceId);
  const status = normalizeOccurrenceStatus(occurrence?.status);
  if (
    occurrence &&
    FINAL_REPAIR_STATUSES.has(status) &&
    [
      SYSTEM_ANALYSIS_CORRECTION_ACTION.MOVE,
      SYSTEM_ANALYSIS_CORRECTION_ACTION.POSTPONE,
      SYSTEM_ANALYSIS_CORRECTION_ACTION.REDUCE_DURATION,
      SYSTEM_ANALYSIS_CORRECTION_ACTION.SKIP_ONCE,
    ].includes(action)
  ) {
    pushIssue(issues, {
      code: "CORRECTION_NOT_PLANNING_REPAIR_COMPATIBLE",
      severity: SYSTEM_ANALYSIS_ISSUE_SEVERITY.WARNING,
      path,
      message: "This correction targets a final occurrence and may need future repair validation.",
      entityType: "occurrence",
      entityId: occurrenceId,
    });
  }
  if (action === SYSTEM_ANALYSIS_CORRECTION_ACTION.PROTECT) {
    pushIssue(issues, {
      code: "PROTECT_CORRECTION_REQUIRES_FUTURE_HELPER",
      severity: SYSTEM_ANALYSIS_ISSUE_SEVERITY.WARNING,
      path,
      message: "Protect corrections are accepted as proposals but have no v1 application helper.",
      entityType: "occurrence",
      entityId: occurrenceId,
    });
  }

  return {
    ...adjustment,
    occurrenceId,
    action,
    proposedDateKey: dateKey || adjustment.proposedDateKey || null,
    proposedStart: start || adjustment.proposedStart || null,
    proposedDurationMinutes: duration,
  };
}

function validateGoalAdjustments({ adjustments, key, idKey, allowedIds, maps, issues }) {
  return safeArray(adjustments).map((adjustment, index) => {
    const path = `${key}[${index}]`;
    if (!isPlainObject(adjustment)) {
      pushIssue(issues, { code: "INVALID_GOAL_ADJUSTMENT", path, message: `${key} entry must be an object.` });
      return adjustment;
    }
    const id = safeString(adjustment[idKey] || adjustment.goalId);
    if (!id || !maps.goalIds.has(id)) {
      pushIssue(issues, {
        code: "CORRECTION_GOAL_MISSING",
        path: `${path}.${idKey}`,
        message: `${key} references a missing goal.`,
        entityType: "goal",
        entityId: id || null,
      });
    } else if (allowedIds && !allowedIds.has(id)) {
      pushIssue(issues, {
        code: "CORRECTION_GOAL_TYPE_MISMATCH",
        path: `${path}.${idKey}`,
        message: `${key} references the wrong goal type.`,
        entityType: "goal",
        entityId: id,
      });
    }
    return { ...adjustment, [idKey]: id };
  });
}

function validateCorrectionItemTarget({ item, path, maps, issues }) {
  const targetType = safeString(item?.targetType);
  const targetId = safeString(item?.targetId);
  const action = safeString(item?.action);
  if (!ALLOWED_CORRECTION_TARGET_TYPES.has(targetType)) {
    pushIssue(issues, {
      code: "CORRECTION_ITEM_TARGET_TYPE_INVALID",
      path: `${path}.targetType`,
      message: "Correction item target type is unsupported.",
    });
    return false;
  }
  if (TARGET_ID_OPTIONAL_ACTIONS.has(action) || targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.SYSTEM) {
    return true;
  }
  if (!targetId && targetType !== SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.SCHEDULE) {
    pushIssue(issues, {
      code: "CORRECTION_ITEM_TARGET_MISSING",
      path: `${path}.targetId`,
      message: "Correction item target ID is required unless it is an add proposal.",
      entityType: targetType,
      entityId: null,
    });
    return false;
  }
  if (
    targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE ||
    targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OBJECTIVE ||
    targetType === SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.ACTION
  ) {
    return validateKnownReference({
      id: targetId,
      kind: targetType,
      path: `${path}.targetId`,
      maps,
      issues,
    });
  }
  return true;
}

function validateCorrectionItemApplicability({ item, path, snapshot, issues }) {
  const targetType = safeString(item?.targetType);
  const action = safeString(item?.action);
  const supportStatus = safeString(item?.supportStatus);
  const destructive = item?.destructive === true;
  const proposedDateKey = getItemProposedDate(item);
  const proposedStart = getItemProposedStart(item);
  const proposedDurationMinutes = getItemProposedDuration(item);

  if (action === SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REMOVE) {
    if (destructive !== true || safeString(item?.confirmationLevel) !== SYSTEM_ANALYSIS_CONFIRMATION_LEVEL.DESTRUCTIVE) {
      pushIssue(issues, {
        code: "DESTRUCTIVE_REMOVE_REQUIRES_CONFIRMATION",
        path,
        message: "Remove proposals must be explicitly destructive and require destructive confirmation.",
      });
    }
  }
  if (destructive && supportStatus === SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE) {
    pushIssue(issues, {
      code: "DESTRUCTIVE_CORRECTION_ITEM_CANNOT_BE_APPLICABLE",
      path: `${path}.supportStatus`,
      message: "Destructive correction items cannot be directly applicable in v2 foundation.",
    });
  }
  if (
    destructive &&
    targetType !== SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE &&
    supportStatus === SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE
  ) {
    pushIssue(issues, {
      code: "DESTRUCTIVE_NON_OCCURRENCE_ITEM_CANNOT_BE_APPLICABLE",
      path: `${path}.supportStatus`,
      message: "Objective, action, schedule, and system destructive proposals require future review helpers.",
    });
  }
  if (supportStatus === SYSTEM_ANALYSIS_SUPPORT_STATUS.APPLICABLE) {
    if (targetType !== SYSTEM_ANALYSIS_CORRECTION_TARGET_TYPE.OCCURRENCE) {
      pushIssue(issues, {
        code: "CORRECTION_ITEM_APPLICABLE_TARGET_UNSUPPORTED",
        path: `${path}.supportStatus`,
        message: "Only occurrence correction items can be applicable in the v2 foundation.",
      });
    }
    if (!APPLICABLE_OCCURRENCE_ACTIONS.has(action)) {
      pushIssue(issues, {
        code: "CORRECTION_ITEM_APPLICABLE_ACTION_UNSUPPORTED",
        path: `${path}.action`,
        message: "Only occurrence move and reduce correction items can be applicable in the v2 foundation.",
      });
    }
    if (action === SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.MOVE) {
      if (!proposedDateKey) {
        pushIssue(issues, {
          code: "CORRECTION_ITEM_DATE_INVALID",
          path: `${path}.proposedDateKey`,
          message: "Applicable move correction item requires a valid date.",
        });
      }
      if (!proposedStart) {
        pushIssue(issues, {
          code: "CORRECTION_ITEM_TIME_INVALID",
          path: `${path}.proposedStart`,
          message: "Applicable move correction item requires a valid start time.",
        });
      }
    }
    if (
      action === SYSTEM_ANALYSIS_CORRECTION_ITEM_ACTION.REDUCE &&
      (!Number.isFinite(proposedDurationMinutes) || proposedDurationMinutes <= 0)
    ) {
      pushIssue(issues, {
        code: "CORRECTION_ITEM_DURATION_INVALID",
        path: `${path}.proposedDurationMinutes`,
        message: "Applicable reduce correction item requires a positive duration.",
      });
    }
  }

  if (
    proposedDateKey &&
    proposedStart &&
    proposedTimeHitsUnavailableWindow({ dateKey: proposedDateKey, start: proposedStart, snapshot })
  ) {
    pushIssue(issues, {
      code: "CORRECTION_ITEM_UNAVAILABLE_WINDOW_CONFLICT",
      path: `${path}.proposedStart`,
      message: "Correction item proposed time contradicts an unavailable window.",
    });
  }

  const proposedDailyLoad = getItemProposedDailyLoad(item);
  const capacityMinutes = getSnapshotCapacityMinutes(snapshot);
  if (
    Number.isFinite(proposedDailyLoad) &&
    Number.isFinite(capacityMinutes) &&
    proposedDailyLoad > capacityMinutes
  ) {
    pushIssue(issues, {
      code: "CORRECTION_ITEM_LOAD_EXCEEDS_CAPACITY",
      path: `${path}.proposedLoad`,
      message: "Correction item proposed load exceeds declared capacity.",
    });
  }
}

function validateCorrectionItem(item, index, { snapshot, maps, issues }) {
  const path = `correctionItems[${index}]`;
  if (!isPlainObject(item)) {
    pushIssue(issues, {
      code: "INVALID_CORRECTION_ITEM",
      path,
      message: "Correction item must be an object.",
    });
    return null;
  }

  const id = safeString(item.id);
  const type = safeString(item.type);
  const action = safeString(item.action);
  const targetType = safeString(item.targetType);
  const targetId = safeString(item.targetId);
  const supportStatus = safeString(item.supportStatus);
  const confirmationLevel = safeString(item.confirmationLevel);
  const confidence = Number(item.confidence);
  const validationRequirements = normalizeValidationRequirements(item.validationRequirements);

  if (!id) pushIssue(issues, { code: "CORRECTION_ITEM_ID_REQUIRED", path: `${path}.id`, message: "Correction item requires an id." });
  if (!type) pushIssue(issues, { code: "CORRECTION_ITEM_TYPE_REQUIRED", path: `${path}.type`, message: "Correction item requires a type." });
  if (!ALLOWED_CORRECTION_ITEM_ACTIONS.has(action)) {
    pushIssue(issues, { code: "CORRECTION_ITEM_ACTION_INVALID", path: `${path}.action`, message: "Correction item action is unsupported." });
  }
  if (!ALLOWED_SUPPORT_STATUSES.has(supportStatus)) {
    pushIssue(issues, { code: "CORRECTION_ITEM_SUPPORT_STATUS_INVALID", path: `${path}.supportStatus`, message: "Correction item support status is unsupported." });
  }
  if (!ALLOWED_CONFIRMATION_LEVELS.has(confirmationLevel)) {
    pushIssue(issues, { code: "CORRECTION_ITEM_CONFIRMATION_LEVEL_INVALID", path: `${path}.confirmationLevel`, message: "Correction item confirmation level is unsupported." });
  }
  if (typeof item.destructive !== "boolean") {
    pushIssue(issues, { code: "CORRECTION_ITEM_DESTRUCTIVE_INVALID", path: `${path}.destructive`, message: "Correction item destructive flag must be boolean." });
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    pushIssue(issues, { code: "CORRECTION_ITEM_CONFIDENCE_INVALID", path: `${path}.confidence`, message: "Correction item confidence must be between 0 and 1." });
  }
  for (const key of ["title", "whatChanges", "why", "expectedImpact", "risk"]) {
    if (!safeString(item[key])) {
      pushIssue(issues, {
        code: "CORRECTION_ITEM_FIELD_REQUIRED",
        path: `${path}.${key}`,
        message: `Correction item requires ${key}.`,
      });
    }
  }

  validateCorrectionItemTarget({ item: { ...item, targetType, targetId, action }, path, maps, issues });
  validateCorrectionItemEvidence(item.evidence, `${path}.evidence`, maps, issues);
  validateCorrectionItemApplicability({ item: { ...item, targetType, action, supportStatus }, path, snapshot, issues });

  return {
    ...item,
    id,
    type,
    targetType,
    targetId: targetId || null,
    action,
    supportStatus,
    destructive: item.destructive === true,
    confirmationLevel,
    confidence: Number.isFinite(confidence) ? confidence : item.confidence,
    evidence: safeArray(item.evidence),
    validationRequirements,
    proposedDateKey: getItemProposedDate(item) || item.proposedDateKey || null,
    proposedStart: getItemProposedStart(item) || item.proposedStart || null,
    proposedDurationMinutes: getItemProposedDuration(item),
  };
}

export function validateCorrectionDraft(correctionDraft, { snapshot, state, resultVersion } = {}) {
  const issues = [];
  const maps = getStateMaps(state);
  const source = isPlainObject(correctionDraft) ? correctionDraft : null;
  if (!source) {
    pushIssue(issues, {
      code: "CORRECTION_DRAFT_MISSING",
      path: "correctionDraft",
      message: "Correction draft is required.",
    });
    return makeResult(issues, null);
  }

  if (source.userConfirmationRequired !== true) {
    pushIssue(issues, {
      code: "USER_CONFIRMATION_REQUIRED_MISSING",
      path: "userConfirmationRequired",
      message: "Correction draft must require user confirmation.",
    });
  }

  validateNoUnsafeText(source, issues);
  validateNoDirectPersistedObjects(source, issues, "correctionDraft");

  const draftVersion = getDraftVersion(source, resultVersion);
  const isV2Draft = draftVersion === SYSTEM_ANALYSIS_DRAFT_VERSION.V2;
  if (isV2Draft && source.version !== SYSTEM_ANALYSIS_DRAFT_VERSION.V2) {
    pushIssue(issues, {
      code: "CORRECTION_DRAFT_VERSION_INVALID",
      path: "version",
      message: "System analysis v2 correction draft must declare version 2.",
    });
  } else if (source.version !== undefined && !ALLOWED_DRAFT_VERSIONS.has(Number(source.version))) {
    pushIssue(issues, {
      code: "CORRECTION_DRAFT_VERSION_INVALID",
      path: "version",
      message: "Correction draft version is unsupported.",
    });
  }

  const validationRequirements = normalizeValidationRequirements(source.validationRequirements);
  const occurrenceAdjustments = safeArray(source.occurrenceAdjustments).map((adjustment, index) =>
    validateOccurrenceAdjustment(adjustment, index, maps, validationRequirements, issues)
  );
  const objectiveAdjustments = validateGoalAdjustments({
    adjustments: source.objectiveAdjustments,
    key: "objectiveAdjustments",
    idKey: "goalId",
    allowedIds: maps.objectiveIds.size ? maps.objectiveIds : null,
    maps,
    issues,
  });
  const actionAdjustments = validateGoalAdjustments({
    adjustments: source.actionAdjustments,
    key: "actionAdjustments",
    idKey: "actionId",
    allowedIds: maps.actionIds.size ? maps.actionIds : null,
    maps,
    issues,
  });
  let correctionItems = source.correctionItems;
  if (isV2Draft) {
    if (!Array.isArray(source.correctionItems)) {
      pushIssue(issues, {
        code: "CORRECTION_ITEMS_REQUIRED",
        path: "correctionItems",
        message: "System analysis v2 correction draft requires correctionItems.",
      });
      correctionItems = [];
    } else {
      if (source.correctionItems.length > MAX_CORRECTION_ITEMS) {
        pushIssue(issues, {
          code: "CORRECTION_ITEMS_TOO_LONG",
          path: "correctionItems",
          message: "Correction items exceed the bounded output contract.",
        });
      }
      correctionItems = source.correctionItems
        .slice(0, MAX_CORRECTION_ITEMS)
        .map((item, index) => validateCorrectionItem(item, index, { snapshot, maps, issues }));
    }
  }

  return makeResult(issues, {
    ...source,
    version: isV2Draft ? SYSTEM_ANALYSIS_DRAFT_VERSION.V2 : source.version,
    occurrenceAdjustments,
    objectiveAdjustments,
    actionAdjustments,
    correctionItems,
    validationRequirements,
    userConfirmationRequired: source.userConfirmationRequired === true,
  });
}

export function validateSystemAnalysisResult(result, { snapshot, state } = {}) {
  const issues = [];
  const source = isPlainObject(result) ? result : null;
  if (!source) {
    pushIssue(issues, {
      code: "SYSTEM_ANALYSIS_RESULT_MISSING",
      path: "result",
      message: "System analysis result must be an object.",
    });
    return makeResult(issues, null);
  }

  if (!ALLOWED_RESULT_VERSIONS.has(source.version)) {
    pushIssue(issues, {
      code: "SYSTEM_ANALYSIS_VERSION_INVALID",
      path: "version",
      message: "System analysis result version is unsupported.",
    });
  }
  if (!periodsMatch(source.period, snapshot?.period)) {
    pushIssue(issues, {
      code: "SYSTEM_ANALYSIS_PERIOD_MISMATCH",
      path: "period",
      message: "System analysis result period must match the snapshot period.",
    });
  }
  validateArrayBounds(source, issues);
  validateNoUnsafeText(source, issues);
  validateNoDirectPersistedObjects(source, issues);

  const confidence = Number(source.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    pushIssue(issues, {
      code: "CONFIDENCE_INVALID",
      path: "confidence",
      message: "System analysis confidence must be between 0 and 1.",
    });
  }
  if (!Array.isArray(source.dataLimitations)) {
    pushIssue(issues, {
      code: "DATA_LIMITATIONS_REQUIRED",
      path: "dataLimitations",
      message: "System analysis result must include data limitations.",
    });
  }

  const isV2Result = source.version === SYSTEM_ANALYSIS_RESULT_VERSION.V2;
  let diagnosisSummary = source.diagnosisSummary;
  if (isV2Result) {
    if (!ALLOWED_ANALYSIS_MODES.has(safeString(source.analysisMode))) {
      pushIssue(issues, {
        code: "ANALYSIS_MODE_INVALID",
        path: "analysisMode",
        message: "System analysis v2 result requires a valid analysis mode.",
      });
    }
    diagnosisSummary = validateDiagnosisSummary(source, issues);
  }

  validateEvidenceReferences(source, getStateMaps(state), issues);
  const draftResult = validateCorrectionDraft(source.correctionDraft, { snapshot, state, resultVersion: source.version });
  issues.push(...draftResult.issues.map((issue) => ({
    ...issue,
    path: issue.path ? `correctionDraft.${issue.path}` : "correctionDraft",
  })));

  return makeResult(issues, {
    ...source,
    confidence: Number.isFinite(confidence) ? confidence : source.confidence,
    analysisMode: isV2Result ? safeString(source.analysisMode) : source.analysisMode,
    diagnosisSummary,
    correctionDraft: draftResult.normalized,
  });
}

export function assertValidSystemAnalysisResult(result, options = {}) {
  const validation = validateSystemAnalysisResult(result, options);
  if (!validation.ok) {
    throw new Error(`SystemAnalysisResult invariant failed: ${validation.issues.map((issue) => issue.code).join(", ")}`);
  }
  return validation;
}

export function assertValidCorrectionDraft(correctionDraft, options = {}) {
  const validation = validateCorrectionDraft(correctionDraft, options);
  if (!validation.ok) {
    throw new Error(`CorrectionDraft invariant failed: ${validation.issues.map((issue) => issue.code).join(", ")}`);
  }
  return validation;
}
