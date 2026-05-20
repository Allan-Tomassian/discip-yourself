import { resolveGoalType } from "../../domain/goalType";
import {
  normalizeLocalDateKey,
  normalizeStartTime,
} from "../../utils/datetime";
import { OCCURRENCE_STATUS, normalizeOccurrenceStatus } from "../../logic/occurrenceStatus";

export const SYSTEM_ANALYSIS_CORRECTION_ACTION = Object.freeze({
  MOVE: "move",
  REDUCE_DURATION: "reduce_duration",
  POSTPONE: "postpone",
  SKIP_ONCE: "skip_once",
  PROTECT: "protect",
});

export const SYSTEM_ANALYSIS_ISSUE_SEVERITY = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
});

const SYSTEM_ANALYSIS_RESULT_VERSION = 1;
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
const MAX_STRING_LENGTH = 2400;
const ALLOWED_OCCURRENCE_ACTIONS = new Set(Object.values(SYSTEM_ANALYSIS_CORRECTION_ACTION));
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

export function validateCorrectionDraft(correctionDraft, { snapshot, state } = {}) {
  void snapshot;
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

  return makeResult(issues, {
    ...source,
    occurrenceAdjustments,
    objectiveAdjustments,
    actionAdjustments,
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

  if (source.version !== SYSTEM_ANALYSIS_RESULT_VERSION) {
    pushIssue(issues, {
      code: "SYSTEM_ANALYSIS_VERSION_INVALID",
      path: "version",
      message: "System analysis result version is invalid.",
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

  validateEvidenceReferences(source, getStateMaps(state), issues);
  const draftResult = validateCorrectionDraft(source.correctionDraft, { snapshot, state });
  issues.push(...draftResult.issues.map((issue) => ({
    ...issue,
    path: issue.path ? `correctionDraft.${issue.path}` : "correctionDraft",
  })));

  return makeResult(issues, {
    ...source,
    confidence: Number.isFinite(confidence) ? confidence : source.confidence,
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
