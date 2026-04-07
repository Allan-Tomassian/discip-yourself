import { uid } from "../../utils/helpers";
import { LABELS } from "../../ui/labels";
import { normalizeLocalDateKey, normalizeStartTime, todayLocalKey, toLocalDateKey } from "../../utils/datetime";
import {
  getFirstVisibleCategoryId,
  getVisibleCategories,
  resolveVisibleCategoryId,
} from "../../domain/categoryVisibility";
import { resolveGoalType } from "../../domain/goalType";
import { createActionModel } from "../../domain/actionModel";
import { createGoal } from "../../logic/goals";
import { ensureWindowFromScheduleRules } from "../../logic/occurrencePlanner";
import { canCreateCategory } from "../../logic/entitlements";
import { createDefaultGoalSchedule } from "../../logic/state";
import {
  normalizeDays,
  normalizeDurationMinutes,
  normalizeQuantityPeriod,
  normalizeQuantityUnit,
  normalizeQuantityValue,
  normalizeRepeat,
  updateRemindersForGoal,
} from "../edit-item/editItemShared";
import { normalizeActionDraft, normalizeOutcomeDraft } from "../../creation/createItemDraft";
import {
  buildMinDeadlineKey,
  ensureSuggestedCategory,
  normalizeReminderTimes,
  resolveSuggestedCategories,
} from "./createItemShared";

function buildActionCandidateFromDraft(actionDraft, { actionId, categoryId, resolvedOutcomeId = null }) {
  const repeat = normalizeRepeat(actionDraft.repeat);
  const startTime = normalizeStartTime(actionDraft.timeMode === "FIXED" ? actionDraft.startTime : "");
  const durationMinutes = normalizeDurationMinutes(actionDraft.durationMinutes);
  const normalizedDays = repeat === "weekly" ? normalizeDays(actionDraft.daysOfWeek) : [];
  const reminderTimes = normalizeReminderTimes(actionDraft.reminderTimes);
  const schedule =
    repeat === "none"
      ? null
      : {
          ...createDefaultGoalSchedule(),
          daysOfWeek: repeat === "daily" ? [1, 2, 3, 4, 5, 6, 7] : normalizedDays,
          timeSlots: startTime ? [startTime] : [],
          durationMinutes,
          windowStart: normalizeStartTime(actionDraft.windowStart),
          windowEnd: normalizeStartTime(actionDraft.windowEnd),
          remindersEnabled: reminderTimes.length > 0,
        };

  const oneOffDate = repeat === "none" ? normalizeLocalDateKey(actionDraft.oneOffDate) || todayLocalKey() : undefined;
  const startAt = repeat === "none" && startTime ? `${oneOffDate}T${startTime}` : null;

  return createActionModel(
    {
      id: actionId,
      categoryId,
      title: actionDraft.title,
      type: "PROCESS",
      planType: repeat === "none" ? "ONE_OFF" : "ACTION",
      parentId: resolvedOutcomeId || actionDraft.outcomeId || null,
      priority: actionDraft.priority || "secondaire",
      repeat,
      daysOfWeek: repeat === "weekly" ? normalizedDays : [],
      oneOffDate,
      startAt,
      timeMode: actionDraft.timeMode === "FIXED" && startTime ? "FIXED" : "NONE",
      timeSlots: startTime ? [startTime] : [],
      startTime,
      durationMinutes,
      cadence: repeat === "daily" ? "DAILY" : repeat === "weekly" ? "WEEKLY" : undefined,
      target: repeat === "none" ? undefined : 1,
      freqCount: repeat === "none" ? undefined : 1,
      freqUnit: repeat === "daily" ? "DAY" : repeat === "weekly" ? "WEEK" : undefined,
      schedule,
      quantityValue: normalizeQuantityValue(actionDraft.quantityValue),
      quantityUnit: normalizeQuantityUnit(actionDraft.quantityUnit),
      quantityPeriod: normalizeQuantityPeriod(actionDraft.quantityPeriod),
      reminderTime: reminderTimes[0] || "",
      reminderWindowStart: normalizeStartTime(actionDraft.windowStart),
      reminderWindowEnd: normalizeStartTime(actionDraft.windowEnd),
      habitNotes: actionDraft.notes || "",
      status: "queued",
    },
    { categories: [{ id: categoryId }] }
  );
}

export function buildCreationViewTarget({ createdCategoryId = null, createdActionIds = [], createdOutcomeId = null } = {}) {
  return {
    type: "library-focus",
    categoryId: createdCategoryId || null,
    section: createdActionIds.length ? "actions" : createdOutcomeId ? "objectives" : "actions",
    outcomeId: createdOutcomeId || null,
    actionIds: Array.isArray(createdActionIds) ? createdActionIds.filter(Boolean).slice(0, 6) : [],
  };
}

export function prepareCreateCommit({
  state,
  kind = "action",
  actionDraft = null,
  outcomeDraft = null,
  additionalActionDrafts = [],
  canCreateAction = true,
  canCreateOutcome = true,
  isPremiumPlan = false,
  planLimits = null,
}) {
  const safeState = state && typeof state === "object" ? state : {};
  const categories = getVisibleCategories(safeState.categories);
  const goals = Array.isArray(safeState.goals) ? safeState.goals : [];
  const existingActionCount = goals.filter((goal) => resolveGoalType(goal) === "PROCESS").length;
  const existingOutcomeCount = goals.filter((goal) => resolveGoalType(goal) === "OUTCOME").length;
  const normalizedActionDraft = actionDraft ? normalizeActionDraft(actionDraft) : null;
  const normalizedOutcomeDraft = outcomeDraft ? normalizeOutcomeDraft(outcomeDraft) : null;
  const normalizedAdditionalActionDrafts = (Array.isArray(additionalActionDrafts) ? additionalActionDrafts : [])
    .map((entry) => normalizeActionDraft(entry))
    .filter((entry) => entry?.title);
  const normalizedKind =
    kind === "assistant"
      ? normalizedOutcomeDraft?.title
        ? "guided"
        : "action"
      : kind;

  const requiresOutcome = normalizedKind === "outcome" || normalizedKind === "guided";
  const requiresAction = normalizedKind !== "outcome";

  if (requiresOutcome && !normalizedOutcomeDraft?.title) {
    return { ok: false, kind: "validation", message: `Le titre de l’${LABELS.goalLower} est requis.` };
  }
  if (requiresAction && !normalizedActionDraft?.title && !normalizedAdditionalActionDrafts.length) {
    return { ok: false, kind: "validation", message: "Le titre de l’action est requis." };
  }

  const actionsToCreate = [
    ...(normalizedActionDraft?.title ? [normalizedActionDraft] : []),
    ...normalizedAdditionalActionDrafts,
  ];
  const outcomeCountToCreate = normalizedOutcomeDraft?.title ? 1 : 0;
  const actionCountToCreate = actionsToCreate.length;

  const actionLimit = Number(planLimits?.actions) || 0;
  const outcomeLimit = Number(planLimits?.outcomes) || 0;
  if (
    actionCountToCreate &&
    (!canCreateAction || (!isPremiumPlan && actionLimit > 0 && existingActionCount + actionCountToCreate > actionLimit))
  ) {
    return { ok: false, kind: "paywall", message: "Limite d’actions atteinte." };
  }
  if (
    outcomeCountToCreate &&
    (!canCreateOutcome || (!isPremiumPlan && outcomeLimit > 0 && existingOutcomeCount + outcomeCountToCreate > outcomeLimit))
  ) {
    return { ok: false, kind: "paywall", message: `Limite de ${LABELS.goalsLower} atteinte.` };
  }

  const primaryCategoryId =
    resolveVisibleCategoryId(
      normalizedOutcomeDraft?.categoryId || normalizedActionDraft?.categoryId,
      categories
    ) || getFirstVisibleCategoryId(categories);
  if (!primaryCategoryId) {
    return { ok: false, kind: "validation", message: "Choisis une catégorie valide." };
  }

  const suggestedCategories = resolveSuggestedCategories(categories);
  const chosenSuggestion =
    suggestedCategories.find(
      (category) => category.id === (normalizedOutcomeDraft?.categoryId || normalizedActionDraft?.categoryId)
    ) || null;
  if (chosenSuggestion && !canCreateCategory(safeState)) {
    return { ok: false, kind: "paywall", message: "Limite de catégories atteinte." };
  }

  return {
    ok: true,
    plan: {
      kind: normalizedKind,
      createdCategoryId: primaryCategoryId,
      chosenSuggestion,
      pendingOutcome: normalizedOutcomeDraft?.title
        ? {
            ...normalizedOutcomeDraft,
            startDate: normalizedOutcomeDraft.startDate || todayLocalKey(),
            deadline: normalizedOutcomeDraft.deadline || buildMinDeadlineKey(normalizedOutcomeDraft.startDate || todayLocalKey()),
          }
        : null,
      actionsToCreate,
    },
  };
}

export function commitPreparedCreatePlan(
  state,
  preparedPlan,
  { generationWindowDays = null, isPremiumPlan = false } = {}
) {
  const safeState = state && typeof state === "object" ? state : {};
  const safePlan = preparedPlan && typeof preparedPlan === "object" ? preparedPlan : null;
  if (!safePlan) {
    return {
      state: safeState,
      createdCategoryId: null,
      createdOutcomeId: null,
      createdActionIds: [],
      viewTarget: buildCreationViewTarget({}),
    };
  }

  let nextState = safeState;
  let createdOutcomeId = null;
  const createdActionIds = [];
  let createdCategoryId = safePlan.createdCategoryId || null;

  if (safePlan.chosenSuggestion) {
    nextState = ensureSuggestedCategory(nextState, safePlan.chosenSuggestion);
    createdCategoryId = safePlan.chosenSuggestion.id;
  }

  let availableCategories = getVisibleCategories(nextState.categories);
  createdCategoryId =
    resolveVisibleCategoryId(createdCategoryId, availableCategories) || getFirstVisibleCategoryId(availableCategories) || createdCategoryId;

  if (safePlan.pendingOutcome?.title) {
    createdOutcomeId = uid();
    nextState = createGoal(nextState, {
      id: createdOutcomeId,
      categoryId:
        resolveVisibleCategoryId(safePlan.pendingOutcome.categoryId || createdCategoryId, availableCategories) || createdCategoryId,
      title: safePlan.pendingOutcome.title,
      type: "OUTCOME",
      planType: "STATE",
      startDate: safePlan.pendingOutcome.startDate || todayLocalKey(),
      deadline: safePlan.pendingOutcome.deadline || buildMinDeadlineKey(safePlan.pendingOutcome.startDate || todayLocalKey()),
      priority: safePlan.pendingOutcome.priority || "secondaire",
      measureType: safePlan.pendingOutcome.measureType || null,
      targetValue: safePlan.pendingOutcome.targetValue || null,
      notes: safePlan.pendingOutcome.notes || "",
    });
  }

  availableCategories = getVisibleCategories(nextState.categories);
  for (const actionDraft of safePlan.actionsToCreate || []) {
    if (!actionDraft?.title) continue;
    const resolvedCategoryId =
      resolveVisibleCategoryId(actionDraft.categoryId || createdCategoryId, availableCategories) || createdCategoryId;
    const actionId = uid();
    const candidate = buildActionCandidateFromDraft(actionDraft, {
      actionId,
      categoryId: resolvedCategoryId,
      resolvedOutcomeId: createdOutcomeId || actionDraft.outcomeId || null,
    });
    if (!candidate.ok || !candidate.value) continue;
    nextState = createGoal(nextState, candidate.value);
    nextState = {
      ...nextState,
      reminders: updateRemindersForGoal(
        nextState,
        actionId,
        {
          enabled: Boolean(actionDraft.remindersEnabled),
          times: normalizeReminderTimes(actionDraft.reminderTimes),
          channel: actionDraft.reminderChannel,
          windowStart: actionDraft.windowStart,
          windowEnd: actionDraft.windowEnd,
          label: actionDraft.title,
        },
        actionDraft.title
      ),
    };
    createdActionIds.push(actionId);
  }

  if (createdActionIds.length) {
    const days =
      Number.isFinite(generationWindowDays) && generationWindowDays > 0
        ? Math.floor(generationWindowDays)
        : isPremiumPlan
          ? 90
          : 14;
    const fromKey = todayLocalKey();
    const baseDate = new Date(`${fromKey}T12:00:00`);
    const toKey = Number.isNaN(baseDate.getTime())
      ? fromKey
      : toLocalDateKey(new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + Math.max(0, days - 1)));
    nextState = ensureWindowFromScheduleRules(nextState, fromKey, toKey, createdActionIds);
  }

  return {
    state: nextState,
    createdCategoryId,
    createdOutcomeId,
    createdActionIds,
    viewTarget: buildCreationViewTarget({
      createdCategoryId,
      createdActionIds,
      createdOutcomeId,
    }),
  };
}
