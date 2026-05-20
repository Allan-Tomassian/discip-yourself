import { resolveGoalType } from "../domain/goalType";
import {
  OCCURRENCE_STATUS,
  FINAL_OCCURRENCE_STATUSES,
  normalizeOccurrenceStatus,
} from "./occurrenceStatus";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";

export const SYSTEM_INVARIANT_SEVERITY = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
});

const EXCLUDED_TODAY_PRIMARY_STATUSES = new Set([
  OCCURRENCE_STATUS.DONE,
  OCCURRENCE_STATUS.CANCELED,
  OCCURRENCE_STATUS.SKIPPED,
]);

const EXECUTABLE_FIRST_BLOCK_STATUSES = new Set([
  OCCURRENCE_STATUS.PLANNED,
  OCCURRENCE_STATUS.IN_PROGRESS,
]);

const DIAGNOSTIC_ENDED_REASONS = new Set(["blocked", "reported"]);
const INACTIVE_ACTION_STATUSES = new Set(["done", "archived", "invalid", "deleted"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDateKey(value) {
  return normalizeLocalDateKey(value) || "";
}

function resolveTodayKey(options = {}) {
  return (
    normalizeDateKey(options.todayKey) ||
    normalizeDateKey(options.now) ||
    todayLocalKey()
  );
}

function resolveActivationDateKey(commitV1 = {}, options = {}) {
  return (
    normalizeDateKey(commitV1?.appliedAt) ||
    normalizeDateKey(options.activationDateKey) ||
    resolveTodayKey(options)
  );
}

function normalizeIssue(issue) {
  return {
    code: safeString(issue?.code),
    severity: issue?.severity || SYSTEM_INVARIANT_SEVERITY.ERROR,
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

function makeResult(issues, summaryExtras = {}) {
  const normalizedIssues = safeArray(issues).map(normalizeIssue);
  const errorCount = normalizedIssues.filter((issue) => issue.severity === SYSTEM_INVARIANT_SEVERITY.ERROR).length;
  const warningCount = normalizedIssues.filter((issue) => issue.severity === SYSTEM_INVARIANT_SEVERITY.WARNING).length;
  const infoCount = normalizedIssues.filter((issue) => issue.severity === SYSTEM_INVARIANT_SEVERITY.INFO).length;
  return {
    ok: errorCount === 0,
    issues: normalizedIssues,
    summary: {
      totalCount: normalizedIssues.length,
      errorCount,
      warningCount,
      infoCount,
      ...summaryExtras,
    },
  };
}

function getGoalId(value) {
  return safeString(value?.goalId) || safeString(value?.actionId);
}

function isProcessAction(goal) {
  return Boolean(goal?.id) && resolveGoalType(goal) === "PROCESS";
}

function isOutcomeGoal(goal) {
  return Boolean(goal?.id) && resolveGoalType(goal) === "OUTCOME";
}

function isInactiveAction(action) {
  const status = safeString(action?.status).toLowerCase();
  return INACTIVE_ACTION_STATUSES.has(status);
}

function hasArrayItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasScheduleObjectData(schedule) {
  if (!isPlainObject(schedule)) return false;
  return Boolean(
    hasArrayItems(schedule.daysOfWeek) ||
      hasArrayItems(schedule.timeSlots) ||
      isPlainObject(schedule.weeklySlotsByDay) ||
      safeString(schedule.windowStart) ||
      safeString(schedule.windowEnd) ||
      safeString(schedule.startTime) ||
      safeString(schedule.scheduleMode)
  );
}

function hasEmbeddedScheduleSource(action) {
  const schedule = isPlainObject(action?.schedule) ? action.schedule : null;
  return Boolean(
    hasScheduleObjectData(schedule) ||
      hasArrayItems(action?.daysOfWeek) ||
      hasArrayItems(action?.timeSlots) ||
      isPlainObject(action?.weeklySlotsByDay) ||
      safeString(action?.startTime) ||
      safeString(action?.windowStart) ||
      safeString(action?.windowEnd) ||
      safeString(action?.reminderWindowStart) ||
      safeString(action?.reminderWindowEnd) ||
      ["daily", "weekly"].includes(safeString(action?.repeat).toLowerCase()) ||
      ["DAILY", "WEEKLY"].includes(safeString(action?.cadence).toUpperCase()) ||
      safeString(action?.scheduleMode)
  );
}

function isRecurringProcessAction(action) {
  if (!isProcessAction(action) || isInactiveAction(action)) return false;
  const planType = safeString(action?.planType).toUpperCase();
  const repeat = safeString(action?.repeat).toLowerCase();
  const cadence = safeString(action?.cadence).toUpperCase();
  if (planType === "ONE_OFF" || repeat === "none" || action?.oneOffDate) return false;
  return Boolean(
    planType === "ACTION" ||
      repeat === "daily" ||
      repeat === "weekly" ||
      cadence === "DAILY" ||
      cadence === "WEEKLY" ||
      hasArrayItems(action?.daysOfWeek) ||
      hasArrayItems(action?.timeSlots) ||
      isPlainObject(action?.weeklySlotsByDay) ||
      hasScheduleObjectData(action?.schedule)
  );
}

function buildStateMaps(state) {
  const categories = safeArray(state?.categories);
  const goals = safeArray(state?.goals);
  return {
    categories,
    goals,
    scheduleRules: safeArray(state?.scheduleRules),
    occurrences: safeArray(state?.occurrences),
    sessionHistory: safeArray(state?.sessionHistory),
    categoriesById: new Map(categories.filter((category) => safeString(category?.id)).map((category) => [safeString(category.id), category])),
    goalsById: new Map(goals.filter((goal) => safeString(goal?.id)).map((goal) => [safeString(goal.id), goal])),
  };
}

function addDuplicateWarnings({ issues, scheduleRules, occurrences, sessionHistory }) {
  const scheduleSeen = new Set();
  for (const rule of scheduleRules) {
    const actionId = safeString(rule?.actionId);
    const sourceKey = safeString(rule?.sourceKey);
    if (!actionId || !sourceKey) continue;
    const key = `${actionId}::${sourceKey}`;
    if (scheduleSeen.has(key)) {
      pushIssue(issues, {
        code: "DUPLICATE_SCHEDULE_RULE_SOURCE_KEY",
        severity: SYSTEM_INVARIANT_SEVERITY.WARNING,
        path: "scheduleRules",
        message: "Duplicate schedule rule source key for an action.",
        entityType: "scheduleRule",
        entityId: safeString(rule?.id),
        relatedIds: [actionId, sourceKey],
      });
    } else {
      scheduleSeen.add(key);
    }
  }

  const occurrenceSeen = new Set();
  for (const occurrence of occurrences) {
    const scheduleRuleId = safeString(occurrence?.scheduleRuleId);
    const date = normalizeDateKey(occurrence?.date);
    const goalId = getGoalId(occurrence);
    const start = safeString(occurrence?.start) || safeString(occurrence?.slotKey);
    const key = scheduleRuleId && date ? `${scheduleRuleId}::${date}` : goalId && date ? `${goalId}::${date}::${start}` : "";
    if (!key) continue;
    if (occurrenceSeen.has(key)) {
      pushIssue(issues, {
        code: "DUPLICATE_OCCURRENCE_KEY",
        severity: SYSTEM_INVARIANT_SEVERITY.WARNING,
        path: "occurrences",
        message: "Duplicate occurrence key detected.",
        entityType: "occurrence",
        entityId: safeString(occurrence?.id),
        relatedIds: [key],
      });
    } else {
      occurrenceSeen.add(key);
    }
  }

  const sessionSeen = new Set();
  for (const session of sessionHistory) {
    const occurrenceId = safeString(session?.occurrenceId);
    if (!occurrenceId) continue;
    if (sessionSeen.has(occurrenceId)) {
      pushIssue(issues, {
        code: "DUPLICATE_SESSION_HISTORY_OCCURRENCE_ID",
        severity: SYSTEM_INVARIANT_SEVERITY.WARNING,
        path: "sessionHistory",
        message: "Duplicate session history record for one occurrence.",
        entityType: "sessionHistory",
        entityId: safeString(session?.id),
        relatedIds: [occurrenceId],
      });
    } else {
      sessionSeen.add(occurrenceId);
    }
  }
}

function addFirstRunStateIssues({ issues, state, goalsById, options }) {
  const firstRun = state?.ui?.firstRunV1;
  if (!isPlainObject(firstRun) || firstRun.status !== "done") return;

  const commitV1 = isPlainObject(firstRun.commitV1) ? firstRun.commitV1 : null;
  if (commitV1?.status !== "applied") {
    if (options.allowLegacyFirstRunDoneWithoutCommit === true && !commitV1) return;
    pushIssue(issues, {
      code: "FIRST_RUN_DONE_WITHOUT_APPLIED_COMMIT",
      severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
      path: "ui.firstRunV1.commitV1.status",
      message: "First-run cannot be done unless commitV1.status is applied.",
      entityType: "firstRunV1",
      entityId: safeString(firstRun.inputHash),
    });
    return;
  }

  const activationDateKey = resolveActivationDateKey(commitV1, options);
  const actionIds = new Set(
    safeArray(commitV1.createdActionIds)
      .map(safeString)
      .filter(Boolean)
  );
  const hasActivationOccurrence = safeArray(state?.occurrences).some((occurrence) => {
    const occurrenceDate = normalizeDateKey(occurrence?.date);
    if (!occurrenceDate || occurrenceDate !== activationDateKey) return false;
    const status = normalizeOccurrenceStatus(occurrence?.status);
    if (!EXECUTABLE_FIRST_BLOCK_STATUSES.has(status)) return false;
    const actionId = getGoalId(occurrence);
    if (actionIds.size && !actionIds.has(actionId)) return false;
    return isProcessAction(goalsById.get(actionId));
  });

  if (!hasActivationOccurrence) {
    pushIssue(issues, {
      code: "FIRST_RUN_APPLIED_WITHOUT_INITIAL_TODAY_BLOCK",
      severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
      path: "occurrences",
      message: "Applied first-run state must have an executable occurrence on the activation date.",
      entityType: "firstRunV1",
      entityId: safeString(firstRun.inputHash),
      relatedIds: [activationDateKey, ...actionIds],
    });
  }
}

function addActionIssues({ issues, goals, categoriesById, activeRulesByActionId }) {
  for (const goal of goals) {
    if (!isProcessAction(goal)) continue;
    const actionId = safeString(goal.id);
    const categoryId = safeString(goal.categoryId);
    if (!categoryId || !categoriesById.has(categoryId)) {
      pushIssue(issues, {
        code: "PROCESS_ACTION_MISSING_CATEGORY",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: `goals.${actionId}.categoryId`,
        message: "Every process action must reference an existing category.",
        entityType: "processAction",
        entityId: actionId,
        relatedIds: [categoryId],
      });
    }

    if (!isRecurringProcessAction(goal)) continue;
    const activeRules = activeRulesByActionId.get(actionId) || [];
    if (activeRules.length) continue;
    if (hasEmbeddedScheduleSource(goal)) {
      pushIssue(issues, {
        code: "RECURRING_ACTION_HAS_EMBEDDED_SCHEDULE_WITHOUT_ACTIVE_RULE",
        severity: SYSTEM_INVARIANT_SEVERITY.WARNING,
        path: `scheduleRules.${actionId}`,
        message: "Recurring action has embedded schedule data but no active schedule rule.",
        entityType: "processAction",
        entityId: actionId,
      });
    } else {
      pushIssue(issues, {
        code: "RECURRING_ACTION_MISSING_SCHEDULE_SOURCE",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: `goals.${actionId}.schedule`,
        message: "Recurring process action needs schedule data or an active schedule rule.",
        entityType: "processAction",
        entityId: actionId,
      });
    }
  }
}

function addOccurrenceIssues({ issues, occurrences, goalsById }) {
  for (const occurrence of occurrences) {
    const occurrenceId = safeString(occurrence?.id);
    const actionId = getGoalId(occurrence);
    const action = goalsById.get(actionId) || null;
    const status = normalizeOccurrenceStatus(occurrence?.status);
    const isPostponed = status === OCCURRENCE_STATUS.RESCHEDULED;

    if (isPostponed && (!normalizeDateKey(occurrence?.date) || !actionId)) {
      pushIssue(issues, {
        code: "POSTPONED_OCCURRENCE_MISSING_DIAGNOSTIC_DATA",
        severity: SYSTEM_INVARIANT_SEVERITY.WARNING,
        path: `occurrences.${occurrenceId || actionId}`,
        message: "Rescheduled/postponed occurrence needs an action and date for diagnostics.",
        entityType: "occurrence",
        entityId: occurrenceId,
        relatedIds: [actionId],
      });
    }

    if (!action) {
      pushIssue(issues, {
        code: "OCCURRENCE_MISSING_PROCESS_ACTION",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: `occurrences.${occurrenceId || actionId}.goalId`,
        message: "Every occurrence must reference an existing process action.",
        entityType: "occurrence",
        entityId: occurrenceId,
        relatedIds: [actionId],
      });
      continue;
    }

    if (isOutcomeGoal(action)) {
      pushIssue(issues, {
        code: "OCCURRENCE_REFERENCES_OUTCOME",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: `occurrences.${occurrenceId || actionId}.goalId`,
        message: "Occurrences must reference process actions, not outcome goals.",
        entityType: "occurrence",
        entityId: occurrenceId,
        relatedIds: [actionId],
      });
    }
  }
}

function addSessionIssues({ issues, state, occurrences, goalsById }) {
  const occurrencesById = new Map(occurrences.filter((occurrence) => safeString(occurrence?.id)).map((occurrence) => [safeString(occurrence.id), occurrence]));
  const activeSession = isPlainObject(state?.ui?.activeSession) ? state.ui.activeSession : null;

  if (activeSession) {
    const activeOccurrenceId = safeString(activeSession.occurrenceId);
    const occurrence = occurrencesById.get(activeOccurrenceId) || null;
    if (occurrence && FINAL_OCCURRENCE_STATUSES.has(normalizeOccurrenceStatus(occurrence.status))) {
      pushIssue(issues, {
        code: "ACTIVE_SESSION_REFERENCES_FINAL_OCCURRENCE",
        severity: SYSTEM_INVARIANT_SEVERITY.WARNING,
        path: "ui.activeSession.occurrenceId",
        message: "Active session references an occurrence that is already final.",
        entityType: "activeSession",
        entityId: safeString(activeSession.id),
        relatedIds: [activeOccurrenceId],
      });
    }
  }

  for (const session of safeArray(state?.sessionHistory)) {
    const occurrenceId = safeString(session?.occurrenceId);
    const endedReason = safeString(session?.endedReason);
    const sessionState = safeString(session?.state);
    const occurrence = occurrencesById.get(occurrenceId) || null;
    const actionId = safeString(session?.actionId) || getGoalId(occurrence);
    const dateKey = normalizeDateKey(session?.dateKey) || normalizeDateKey(occurrence?.date);

    if (sessionState === "ended" && endedReason === "done") {
      const occurrenceStatus = normalizeOccurrenceStatus(occurrence?.status);
      if (!occurrence || occurrenceStatus !== OCCURRENCE_STATUS.DONE) {
        pushIssue(issues, {
          code: "SESSION_DONE_HISTORY_WITHOUT_DONE_OCCURRENCE",
          severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
          path: `sessionHistory.${occurrenceId || safeString(session?.id)}.endedReason`,
          message: "A done session history record requires the linked occurrence to be done.",
          entityType: "sessionHistory",
          entityId: safeString(session?.id),
          relatedIds: [occurrenceId],
        });
      }
    }

    if (sessionState === "ended" && DIAGNOSTIC_ENDED_REASONS.has(endedReason)) {
      const action = goalsById.get(actionId) || null;
      if (!occurrenceId || !action || !dateKey) {
        pushIssue(issues, {
          code: "BLOCK_REPORT_SESSION_LACKS_DIAGNOSTIC_METADATA",
          severity: SYSTEM_INVARIANT_SEVERITY.WARNING,
          path: `sessionHistory.${occurrenceId || safeString(session?.id)}`,
          message: "Blocked/reported sessions need occurrence, action, and date metadata for diagnostics.",
          entityType: "sessionHistory",
          entityId: safeString(session?.id),
          relatedIds: [occurrenceId, actionId, dateKey],
        });
      }
    }
  }
}

export function validateSystemInvariants(state, options = {}) {
  const safeState = isPlainObject(state) ? state : {};
  const issues = [];
  const {
    categoriesById,
    goalsById,
    goals,
    scheduleRules,
    occurrences,
    sessionHistory,
  } = buildStateMaps(safeState);

  const activeRulesByActionId = new Map();
  for (const rule of scheduleRules) {
    if (!rule || rule.isActive === false) continue;
    const actionId = safeString(rule.actionId);
    if (!actionId) continue;
    if (!activeRulesByActionId.has(actionId)) activeRulesByActionId.set(actionId, []);
    activeRulesByActionId.get(actionId).push(rule);
  }

  addDuplicateWarnings({ issues, scheduleRules, occurrences, sessionHistory });
  addFirstRunStateIssues({ issues, state: safeState, goalsById, options });
  addActionIssues({ issues, goals, categoriesById, activeRulesByActionId });
  addOccurrenceIssues({ issues, occurrences, goalsById });
  addSessionIssues({ issues, state: safeState, occurrences, goalsById });

  const diagnosticSessionCount = sessionHistory.filter(
    (session) => safeString(session?.state) === "ended" && DIAGNOSTIC_ENDED_REASONS.has(safeString(session?.endedReason))
  ).length;
  const postponedOccurrenceCount = occurrences.filter(
    (occurrence) => normalizeOccurrenceStatus(occurrence?.status) === OCCURRENCE_STATUS.RESCHEDULED
  ).length;

  return makeResult(issues, {
    diagnosticSessionCount,
    postponedOccurrenceCount,
  });
}

function buildCommitDraftMaps(commitDraft) {
  const categories = safeArray(commitDraft?.categories);
  const goals = safeArray(commitDraft?.goals);
  const actions = safeArray(commitDraft?.actions);
  const occurrences = safeArray(commitDraft?.occurrences);
  return {
    categories,
    goals,
    actions,
    occurrences,
    categoryIds: new Set(categories.map((entry) => safeString(entry?.id)).filter(Boolean)),
    goalIds: new Set(goals.map((entry) => safeString(entry?.id)).filter(Boolean)),
    actionIds: new Set(actions.map((entry) => safeString(entry?.id)).filter(Boolean)),
  };
}

function hasFirstExecutableCommitDraftBlock({ occurrences, actionIds, referenceDateKey }) {
  return occurrences.some((occurrence) => {
    const actionId = safeString(occurrence?.actionId) || safeString(occurrence?.goalId);
    if (!actionId || !actionIds.has(actionId)) return false;
    if (referenceDateKey && normalizeDateKey(occurrence?.date) !== referenceDateKey) return false;
    return EXECUTABLE_FIRST_BLOCK_STATUSES.has(normalizeOccurrenceStatus(occurrence?.status));
  });
}

export function validateCommitDraftInvariants(commitDraft, options = {}) {
  const issues = [];
  if (!isPlainObject(commitDraft)) {
    pushIssue(issues, {
      code: "FIRST_RUN_PLAN_INVALID_COMMIT_DRAFT",
      severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
      path: "commitDraft",
      message: "Generated first-run plan is missing a valid commitDraft.",
      entityType: "commitDraft",
    });
    return makeResult(issues);
  }

  const { categories, goals, actions, occurrences, categoryIds, goalIds, actionIds } = buildCommitDraftMaps(commitDraft);
  if (!categories.length || !goals.length || !actions.length || !occurrences.length) {
    pushIssue(issues, {
      code: "FIRST_RUN_PLAN_INVALID_COMMIT_DRAFT",
      severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
      path: "commitDraft",
      message: "Generated first-run commitDraft must include categories, goals, actions, and occurrences.",
      entityType: "commitDraft",
    });
  }

  actions.forEach((action, index) => {
    const actionId = safeString(action?.id);
    const categoryId = safeString(action?.categoryId);
    const parentGoalId = safeString(action?.parentGoalId) || safeString(action?.outcomeId) || safeString(action?.parentId);
    if (!actionId || !categoryId || !categoryIds.has(categoryId)) {
      pushIssue(issues, {
        code: "FIRST_RUN_PLAN_INVALID_COMMIT_DRAFT",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: `commitDraft.actions.${index}`,
        message: "Commit draft action must have an id and valid categoryId.",
        entityType: "commitDraftAction",
        entityId: actionId,
        relatedIds: [categoryId],
      });
    }
    if (parentGoalId && !goalIds.has(parentGoalId)) {
      pushIssue(issues, {
        code: "FIRST_RUN_PLAN_INVALID_COMMIT_DRAFT",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: `commitDraft.actions.${index}.parentGoalId`,
        message: "Commit draft action parent goal must exist in the same commitDraft.",
        entityType: "commitDraftAction",
        entityId: actionId,
        relatedIds: [parentGoalId],
      });
    }
  });

  occurrences.forEach((occurrence, index) => {
    const actionId = safeString(occurrence?.actionId) || safeString(occurrence?.goalId);
    if (!actionId || !actionIds.has(actionId)) {
      pushIssue(issues, {
        code: "FIRST_RUN_PLAN_INVALID_COMMIT_DRAFT",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: `commitDraft.occurrences.${index}.actionId`,
        message: "Commit draft occurrence must reference an action in the same commitDraft.",
        entityType: "commitDraftOccurrence",
        entityId: safeString(occurrence?.id),
        relatedIds: [actionId],
      });
    }
    if (!normalizeDateKey(occurrence?.date)) {
      pushIssue(issues, {
        code: "FIRST_RUN_PLAN_INVALID_COMMIT_DRAFT",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: `commitDraft.occurrences.${index}.date`,
        message: "Commit draft occurrence must have a valid date.",
        entityType: "commitDraftOccurrence",
        entityId: safeString(occurrence?.id),
      });
    }
  });

  const referenceDateKey =
    normalizeDateKey(options.referenceDateKey) ||
    normalizeDateKey(options.todayKey) ||
    normalizeDateKey(options.activationDateKey) ||
    normalizeDateKey(occurrences[0]?.date);
  if (options.requireFirstExecutableBlock !== false) {
    const hasFirstBlock = hasFirstExecutableCommitDraftBlock({
      occurrences,
      actionIds,
      referenceDateKey,
    });
    if (!hasFirstBlock) {
      pushIssue(issues, {
        code: "FIRST_RUN_PLAN_MISSING_FIRST_EXECUTABLE_BLOCK",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: "commitDraft.occurrences",
        message: "Generated first-run plan must include a first executable block.",
        entityType: "commitDraft",
        relatedIds: [referenceDateKey],
      });
    }
  }

  return makeResult(issues);
}

export function validateGeneratedFirstRunPlans(firstRun, options = {}) {
  const source = isPlainObject(firstRun?.generatedPlans) ? firstRun.generatedPlans : firstRun;
  const plans = safeArray(source?.plans);
  const issues = [];

  if (!plans.length) {
    pushIssue(issues, {
      code: "FIRST_RUN_PLAN_INVALID_COMMIT_DRAFT",
      severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
      path: "generatedPlans.plans",
      message: "Generated first-run plans must include at least one plan.",
      entityType: "generatedPlans",
    });
    return makeResult(issues, { planCount: 0 });
  }

  plans.forEach((plan, index) => {
    const result = validateCommitDraftInvariants(plan?.commitDraft, options);
    result.issues.forEach((issue) => {
      pushIssue(issues, {
        ...issue,
        path: `generatedPlans.plans.${index}.${issue.path}`,
        relatedIds: [safeString(plan?.id), ...safeArray(issue.relatedIds)],
      });
    });
  });

  return makeResult(issues, { planCount: plans.length });
}

export function validateTodayAdapterInvariants({ state, todayData } = {}) {
  const issues = [];
  const occurrences = safeArray(state?.occurrences);
  const occurrencesById = new Map(occurrences.filter((occurrence) => safeString(occurrence?.id)).map((occurrence) => [safeString(occurrence.id), occurrence]));
  const occurrenceId = safeString(todayData?.primaryAction?.occurrenceId);
  if (occurrenceId) {
    const occurrence = occurrencesById.get(occurrenceId) || null;
    const status = normalizeOccurrenceStatus(occurrence?.status);
    if (occurrence && EXCLUDED_TODAY_PRIMARY_STATUSES.has(status)) {
      pushIssue(issues, {
        code: "TODAY_PRIMARY_USES_EXCLUDED_OCCURRENCE",
        severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
        path: "todayData.primaryAction.occurrenceId",
        message: "Today primary action must not select done, canceled, or skipped occurrences.",
        entityType: "occurrence",
        entityId: occurrenceId,
        relatedIds: [status],
      });
    }
  }
  return makeResult(issues);
}

export function validateCoachProposalInvariants(proposal, options = {}) {
  const issues = [];
  const source = isPlainObject(proposal) ? proposal : {};
  const unresolvedQuestions = safeArray(source.unresolvedQuestions)
    .map(safeString)
    .filter(Boolean);
  if (unresolvedQuestions.length) {
    pushIssue(issues, {
      code: "COACH_UNRESOLVED_PROPOSAL_NOT_COMMITTABLE",
      severity: SYSTEM_INVARIANT_SEVERITY.ERROR,
      path: "proposal.unresolvedQuestions",
      message: "Coach proposal with unresolved questions cannot be committed.",
      entityType: "coachProposal",
      entityId: safeString(options.proposalId),
      relatedIds: unresolvedQuestions,
    });
  }
  return makeResult(issues, { unresolvedQuestionCount: unresolvedQuestions.length });
}

function isInvariantResult(value) {
  return isPlainObject(value) && Array.isArray(value.issues) && isPlainObject(value.summary);
}

export function assertNoSystemInvariantErrors(resultOrState, options = {}) {
  const result = isInvariantResult(resultOrState)
    ? resultOrState
    : validateSystemInvariants(resultOrState, options);
  const errors = result.issues.filter((issue) => issue.severity === SYSTEM_INVARIANT_SEVERITY.ERROR);
  if (errors.length) {
    const error = new Error(`System invariant errors: ${errors.map((issue) => issue.code).join(", ")}`);
    error.issues = errors;
    error.result = result;
    throw error;
  }
  return result;
}
