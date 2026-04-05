import React, { useEffect, useMemo, useState } from "react";
import { normalizeRouteOrigin } from "../app/routeOrigin";
import { safeConfirm } from "../utils/dialogs";
import { uid } from "../utils/helpers";
import { AppScreen, StatusBadge } from "../shared/ui/app";
import {
  createActionModel,
} from "../domain/actionModel";
import {
  getFirstVisibleCategoryId,
  getVisibleCategories,
  resolveVisibleCategoryId,
} from "../domain/categoryVisibility";
import { resolveGoalType } from "../domain/goalType";
import { createGoal } from "../logic/goals";
import { ensureWindowFromScheduleRules } from "../logic/occurrencePlanner";
import { canCreateCategory } from "../logic/entitlements";
import { createDefaultGoalSchedule, normalizeCategory } from "../logic/state";
import { LABELS } from "../ui/labels";
import {
  appendCoachConversationMessages,
  buildCoachConversationMessage,
} from "../features/coach/coachStorage";
import {
  buildCreationViewTarget,
  commitPreparedCreatePlan,
  prepareCreateCommit,
} from "../features/create-item/createItemCommit";
import {
  DEFAULT_CONFLICT_DURATION,
  normalizeDays,
  normalizeDurationMinutes,
  normalizeQuantityPeriod,
  normalizeQuantityUnit,
  normalizeQuantityValue,
  normalizeRepeat,
  updateRemindersForGoal,
} from "../features/edit-item/editItemShared";
import {
  ActionCreateScreen,
  AssistantCreateScreen,
  GuidedCreateScreen,
  OutcomeCreateScreen,
} from "../features/create-item/CreateItemScreens";
import {
  createEmptyCreateItemDraft,
  normalizeActionDraft,
  normalizeCreateItemDraft,
  normalizeOutcomeDraft,
} from "../creation/createItemDraft";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import {
  fromLocalDateKey,
  normalizeLocalDateKey,
  normalizeStartTime,
  parseTimeToMinutes,
  toLocalDateKey,
  todayLocalKey,
} from "../utils/datetime";

function formatRepeatSummary(draft) {
  if (!draft) return "Aucun cadre";
  if (draft.repeat === "none") {
    return draft.oneOffDate ? `Une fois · ${draft.oneOffDate}` : "Une fois";
  }
  if (draft.repeat === "daily") return "Quotidien";
  if (draft.repeat === "weekly") {
    return draft.daysOfWeek?.length ? `Hebdomadaire · ${draft.daysOfWeek.join(" / ")}` : "Hebdomadaire";
  }
  return "Sans cadre";
}

function formatMomentSummary(draft) {
  if (!draft) return "Dans la journée";
  if (draft.timeMode === "FIXED" && draft.startTime) {
    return Number.isFinite(draft.durationMinutes)
      ? `${draft.startTime} · ${draft.durationMinutes} min`
      : draft.startTime;
  }
  if (Number.isFinite(draft.durationMinutes)) return `${draft.durationMinutes} min`;
  return "Dans la journée";
}

function buildMinDeadlineKey(startDate) {
  const normalized = normalizeLocalDateKey(startDate) || todayLocalKey();
  const base = fromLocalDateKey(normalized);
  base.setDate(base.getDate() + 1);
  return toLocalDateKey(base);
}

function resolveMainTabLabel(mainTab) {
  if (mainTab === "planning") return "Planning";
  if (mainTab === "library") return "Objectifs";
  if (mainTab === "pilotage") return "Analyses";
  return "Aujourd'hui";
}

function normalizeReminderTimes(value) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  return list
    .map((entry) => normalizeStartTime(entry))
    .filter((entry) => {
      if (!entry || seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
}

function ensureSuggestedCategory(state, selectedSuggestion) {
  if (!selectedSuggestion) return state;
  const prevCategories = Array.isArray(state.categories) ? state.categories : [];
  if (prevCategories.some((category) => category?.id === selectedSuggestion.id)) return state;
  const created = normalizeCategory(
    { id: selectedSuggestion.id, name: selectedSuggestion.name, color: selectedSuggestion.color },
    prevCategories.length
  );
  return { ...state, categories: [...prevCategories, created] };
}

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

function useActionDraftController({
  categories,
  outcomes,
  actionDraft,
  categoryOptions,
  suggestedCategories,
  onActivateSuggestedCategory,
  linkedOutcomeRequired = false,
}) {
  const initialDraft = useMemo(() => normalizeActionDraft(actionDraft), [actionDraft]);
  const [title, setTitle] = useState(initialDraft.title || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialDraft.categoryId || "");
  const [priority, setPriority] = useState(initialDraft.priority || "secondaire");
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(initialDraft.outcomeId || "");
  const [repeat, setRepeat] = useState(initialDraft.repeat || "none");
  const [oneOffDate, setOneOffDate] = useState(initialDraft.oneOffDate || todayLocalKey());
  const [oneOffTime, setOneOffTime] = useState(initialDraft.startTime || "");
  const [startTime, setStartTime] = useState(initialDraft.startTime || "");
  const [timeMode, setTimeMode] = useState(initialDraft.timeMode || "NONE");
  const [sessionMinutes, setSessionMinutes] = useState(
    Number.isFinite(initialDraft.durationMinutes) ? String(initialDraft.durationMinutes) : ""
  );
  const [daysOfWeek, setDaysOfWeek] = useState(
    Array.isArray(initialDraft.daysOfWeek) && initialDraft.daysOfWeek.length ? initialDraft.daysOfWeek : [1, 2, 3, 4, 5]
  );
  const [remindersEnabled, setRemindersEnabled] = useState(Boolean(initialDraft.remindersEnabled));
  const [reminderTimes, setReminderTimes] = useState(
    normalizeReminderTimes(initialDraft.reminderTimes).length ? normalizeReminderTimes(initialDraft.reminderTimes) : ["09:00"]
  );
  const [reminderChannel, setReminderChannel] = useState(initialDraft.reminderChannel || "IN_APP");
  const [windowStart, setWindowStart] = useState(initialDraft.windowStart || "");
  const [windowEnd, setWindowEnd] = useState(initialDraft.windowEnd || "");
  const [quantityValue, setQuantityValue] = useState(
    initialDraft.quantityValue != null ? String(initialDraft.quantityValue) : ""
  );
  const [quantityUnit, setQuantityUnit] = useState(initialDraft.quantityUnit || "");
  const [quantityPeriod, setQuantityPeriod] = useState(initialDraft.quantityPeriod || "DAY");
  const [notes, setNotes] = useState(initialDraft.notes || "");

  useEffect(() => {
    if (linkedOutcomeRequired) setSelectedOutcomeId("");
  }, [linkedOutcomeRequired]);

  const hasMultipleSlots = false;
  const timeSlots = startTime ? [startTime] : [];
  const canUseReminders =
    (repeat === "none" && timeMode === "FIXED" && Boolean(normalizeStartTime(oneOffTime))) ||
    (repeat !== "none" && timeMode === "FIXED" && Boolean(normalizeStartTime(startTime)));
  const effectiveSelectedOutcomeId =
    !linkedOutcomeRequired && selectedOutcomeId && outcomes.some((outcome) => outcome.id === selectedOutcomeId)
      ? selectedOutcomeId
      : "";
  const selectedSuggestion = suggestedCategories.find((category) => category.id === selectedCategoryId) || null;
  const showFixedTimeHint =
    timeMode === "FIXED" && !normalizeStartTime(repeat === "none" ? oneOffTime : startTime);

  const controller = {
    title,
    setTitle,
    selectedCategoryId,
    setSelectedCategoryId,
    priority,
    setPriority,
    effectiveSelectedOutcomeId,
    setSelectedOutcomeId,
    outcomes,
    categoryOptions,
    repeat,
    setRepeat,
    oneOffDate,
    setOneOffDate,
    oneOffTime,
    setOneOffTime,
    startTime,
    setStartTime,
    timeMode,
    setTimeMode,
    sessionMinutes,
    setSessionMinutes,
    daysOfWeek,
    toggleDay: (value) =>
      setDaysOfWeek((previous) =>
        previous.includes(value) ? previous.filter((entry) => entry !== value) : [...previous, value].sort()
      ),
    remindersEnabled,
    setRemindersEnabled,
    reminderTimes,
    addReminderTime: () => setReminderTimes((previous) => [...previous, "09:00"]),
    removeReminderTime: (index) =>
      setReminderTimes((previous) => previous.filter((_, previousIndex) => previousIndex !== index)),
    updateReminderTime: (index, value) =>
      setReminderTimes((previous) => previous.map((entry, previousIndex) => (previousIndex === index ? value : entry))),
    reminderChannel,
    setReminderChannel,
    windowStart,
    setWindowStart,
    windowEnd,
    setWindowEnd,
    quantityValue,
    setQuantityValue,
    quantityUnit,
    setQuantityUnit,
    quantityPeriod,
    setQuantityPeriod,
    notes,
    setNotes,
    canUseReminders,
    hasMultipleSlots,
    timeSlots,
    handleOneOffTimeModeChange: (value) => {
      const normalized = value === "FIXED" ? "FIXED" : "NONE";
      setTimeMode(normalized);
      if (normalized !== "FIXED") setOneOffTime("");
    },
    handleRecurringTimeModeChange: (value) => {
      const normalized = value === "FIXED" ? "FIXED" : "NONE";
      setTimeMode(normalized);
      if (normalized !== "FIXED") setStartTime("");
    },
    selectedSuggestion,
    activateSuggestedCategory: onActivateSuggestedCategory,
    showFixedTimeHint,
  };

  const draftValue = normalizeActionDraft({
    title,
    categoryId: selectedCategoryId,
    priority,
    outcomeId: linkedOutcomeRequired ? null : effectiveSelectedOutcomeId,
    repeat,
    oneOffDate,
    daysOfWeek,
    timeMode,
    startTime: repeat === "none" ? oneOffTime : startTime,
    durationMinutes: normalizeDurationMinutes(sessionMinutes),
    remindersEnabled: remindersEnabled && canUseReminders,
    reminderTimes: remindersEnabled && canUseReminders ? reminderTimes : [],
    reminderChannel,
    windowStart,
    windowEnd,
    quantityValue: normalizeQuantityValue(quantityValue),
    quantityUnit,
    quantityPeriod,
    notes,
  });

  const categoryName = categories.find((category) => category.id === selectedCategoryId)?.name || "Catégorie à confirmer";
  const linkedOutcomeTitle = outcomes.find((outcome) => outcome.id === effectiveSelectedOutcomeId)?.title || "";

  controller.reviewCards = [
    { title: "Catégorie", text: categoryName },
    { title: "Cadence", text: formatRepeatSummary(draftValue) },
    { title: "Moment", text: formatMomentSummary(draftValue) },
    ...(linkedOutcomeTitle ? [{ title: LABELS.goal, text: linkedOutcomeTitle }] : []),
  ];
  controller.draftValue = draftValue;
  return controller;
}

function useOutcomeDraftController({ categories, outcomeDraft, categoryOptions, suggestedCategories, onActivateSuggestedCategory }) {
  const initialDraft = useMemo(() => normalizeOutcomeDraft(outcomeDraft), [outcomeDraft]);
  const [title, setTitle] = useState(initialDraft.title || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialDraft.categoryId || "");
  const [priority, setPriority] = useState(initialDraft.priority || "secondaire");
  const [startDate, setStartDate] = useState(initialDraft.startDate || todayLocalKey());
  const [deadline, setDeadline] = useState(initialDraft.deadline || buildMinDeadlineKey(initialDraft.startDate || todayLocalKey()));
  const [measureType, setMeasureType] = useState(initialDraft.measureType || "");
  const [targetValue, setTargetValue] = useState(
    initialDraft.targetValue != null ? String(initialDraft.targetValue) : ""
  );
  const [notes, setNotes] = useState(initialDraft.notes || "");
  const minDeadlineKey = useMemo(() => buildMinDeadlineKey(startDate), [startDate]);
  const selectedSuggestion = suggestedCategories.find((category) => category.id === selectedCategoryId) || null;

  const controller = {
    title,
    setTitle,
    selectedCategoryId,
    setSelectedCategoryId,
    priority,
    setPriority,
    startDate,
    deadline,
    setDeadline,
    measureType,
    setMeasureType,
    targetValue,
    setTargetValue,
    notes,
    setNotes,
    categoryOptions,
    selectedSuggestion,
    activateSuggestedCategory: onActivateSuggestedCategory,
    minDeadlineKey,
    handleOutcomeStartDateChange: (event) => {
      const nextValue = event?.target?.value || event || "";
      const normalized = normalizeLocalDateKey(nextValue) || todayLocalKey();
      setStartDate(normalized);
      setDeadline((previous) => {
        const current = normalizeLocalDateKey(previous);
        return current && current >= buildMinDeadlineKey(normalized) ? current : buildMinDeadlineKey(normalized);
      });
    },
    handleDeadlineChange: (event) => {
      const nextValue = event?.target?.value || event || "";
      setDeadline(normalizeLocalDateKey(nextValue) || "");
    },
  };

  const draftValue = normalizeOutcomeDraft({
    title,
    categoryId: selectedCategoryId,
    priority,
    startDate,
    deadline,
    measureType,
    targetValue: normalizeQuantityValue(targetValue),
    notes,
  });
  const categoryName = categories.find((category) => category.id === selectedCategoryId)?.name || "Catégorie à confirmer";
  controller.reviewCards = [
    { title: "Catégorie", text: categoryName },
    { title: "Horizon", text: [draftValue.startDate || "Aujourd’hui", draftValue.deadline || "Sans date cible"].join(" → ") },
    ...(draftValue.measureType && draftValue.targetValue
      ? [{ title: "Mesure", text: `${draftValue.measureType} · ${draftValue.targetValue}` }]
      : []),
  ];
  controller.draftValue = draftValue;
  return controller;
}

export default function CreateItem({
  data,
  setData,
  taskOrigin = null,
  onCloseTask,
  onOpenPaywall,
  canCreateAction = true,
  canCreateOutcome = true,
  isPremiumPlan = false,
  planLimits = null,
  generationWindowDays = null,
}) {
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const draft = useMemo(() => normalizeCreateItemDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const origin = useMemo(() => normalizeRouteOrigin(taskOrigin || draft.origin), [draft.origin, taskOrigin]);
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const outcomes = useMemo(() => goals.filter((goal) => resolveGoalType(goal) === "OUTCOME"), [goals]);
  const existingActionCount = useMemo(() => goals.filter((goal) => resolveGoalType(goal) === "PROCESS").length, [goals]);
  const existingOutcomeCount = useMemo(() => outcomes.length, [outcomes]);
  const existingNames = new Set(categories.map((category) => String(category?.name || "").trim().toLowerCase()).filter(Boolean));
  const existingIds = new Set(categories.map((category) => category?.id).filter(Boolean));
  const suggestedCategories = useMemo(
    () =>
      SUGGESTED_CATEGORIES.filter(
        (category) =>
          category &&
          !existingIds.has(category.id) &&
          !existingNames.has(String(category.name || "").trim().toLowerCase())
      ),
    [existingIds, existingNames]
  );
  const categoryOptions = useMemo(
    () => [
      ...categories.slice().sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""))),
      ...suggestedCategories.map((category) => ({ id: category.id, name: category.name, suggested: true })),
    ],
    [categories, suggestedCategories]
  );

  const activateSuggestedCategory = (category) => {
    if (!category || typeof setData !== "function") return;
    if (!canCreateCategory(safeData)) {
      onOpenPaywall?.("Limite de catégories atteinte.");
      return;
    }
    setData((previous) => ensureSuggestedCategory(previous, category));
  };

  const assistantProposal = draft.kind === "assistant" ? draft.proposal : null;
  const effectiveKind = draft.kind || "action";
  const actionDraftSource =
    assistantProposal?.actionDrafts?.[0] ||
    draft.actionDraft ||
    null;
  const outcomeDraftSource =
    assistantProposal?.outcomeDraft ||
    draft.outcomeDraft ||
    null;
  const additionalProposalActionDrafts =
    assistantProposal?.actionDrafts?.slice(1) || [];

  const actionController = useActionDraftController({
    categories,
    outcomes,
    actionDraft: actionDraftSource,
    categoryOptions,
    suggestedCategories,
    onActivateSuggestedCategory: activateSuggestedCategory,
    linkedOutcomeRequired: effectiveKind === "guided" || (effectiveKind === "assistant" && Boolean(outcomeDraftSource)),
  });
  const outcomeController = useOutcomeDraftController({
    categories,
    outcomeDraft: outcomeDraftSource,
    categoryOptions,
    suggestedCategories,
    onActivateSuggestedCategory: activateSuggestedCategory,
  });

  const [error, setError] = useState("");

  const unresolvedQuestions = assistantProposal?.unresolvedQuestions || [];
  const additionalReviewCards = additionalProposalActionDrafts.map((draftItem, index) => ({
    title: `Action proposée ${index + 2}`,
    text: [draftItem.title || LABELS.action, formatRepeatSummary(draftItem), formatMomentSummary(draftItem)]
      .filter(Boolean)
      .join(" · "),
  }));
  const initialDraftSignature = useMemo(
    () =>
      JSON.stringify({
        ...createEmptyCreateItemDraft(),
        kind: effectiveKind,
        origin,
        intent: draft.intent,
        proposal: assistantProposal,
        actionDraft: actionController.draftValue,
        outcomeDraft: outcomeController.draftValue,
        status: "draft",
      }),
    // The initial signature must remain tied to the opened route state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    if (typeof setData !== "function") return;
    const nextDraft = {
      ...createEmptyCreateItemDraft(),
      kind: effectiveKind,
      origin,
      intent: draft.intent,
      proposal: assistantProposal,
      actionDraft: actionController.draftValue,
      outcomeDraft: outcomeController.draftValue,
      status: "draft",
    };
    setData((previous) => {
      const prevUi = previous?.ui && typeof previous.ui === "object" ? previous.ui : {};
      const previousDraft = normalizeCreateItemDraft(prevUi.createDraft);
      if (JSON.stringify(previousDraft) === JSON.stringify(nextDraft)) return previous;
      return {
        ...previous,
        ui: {
          ...prevUi,
          createDraft: nextDraft,
          createDraftWasCanceled: false,
          createDraftWasCompleted: false,
        },
      };
    });
  }, [
    actionController.draftValue,
    assistantProposal,
    draft.intent,
    effectiveKind,
    origin,
    outcomeController.draftValue,
    setData,
  ]);

  const isDirty = useMemo(
    () =>
      JSON.stringify({
        ...createEmptyCreateItemDraft(),
        kind: effectiveKind,
        origin,
        intent: draft.intent,
        proposal: assistantProposal,
        actionDraft: actionController.draftValue,
        outcomeDraft: outcomeController.draftValue,
        status: "draft",
      }) !== initialDraftSignature,
    [actionController.draftValue, assistantProposal, draft.intent, effectiveKind, initialDraftSignature, origin, outcomeController.draftValue]
  );

  const resetDraftState = () => {
    setData?.((previous) => {
      const prevUi = previous?.ui && typeof previous.ui === "object" ? previous.ui : {};
      return {
        ...previous,
        ui: {
          ...prevUi,
          createDraft: createEmptyCreateItemDraft(),
          createDraftWasCanceled: true,
          createDraftWasCompleted: false,
        },
      };
    });
  };

  const finalizeAndClose = ({ outcome = "cancel", createdCategoryId = null, createdIds = null } = {}) => {
    if (outcome === "cancel") resetDraftState();
    if (outcome === "saved") {
      setData?.((previous) => {
        const prevUi = previous?.ui && typeof previous.ui === "object" ? previous.ui : {};
        return {
          ...previous,
          ui: {
            ...prevUi,
            createDraft: createEmptyCreateItemDraft(),
            createDraftWasCanceled: false,
            createDraftWasCompleted: true,
          },
        };
      });
    }
    onCloseTask?.({
      outcome,
      origin,
      createdCategoryId,
      createdIds,
    });
  };

  const handleCancel = async () => {
    if (isDirty) {
      const shouldDiscard = await safeConfirm("Annuler cette création ? Le brouillon sera perdu.");
      if (!shouldDiscard) return;
    }
    finalizeAndClose({ outcome: "cancel" });
  };

  const persistCoachSummary = ({ createdCategoryId, createdActionIds, createdOutcomeId }) => {
    if (!origin.coachConversationId || typeof setData !== "function") return;
    const categoryLabel =
      categories.find((category) => category.id === createdCategoryId)?.name ||
      safeData.categories?.find((category) => category?.id === createdCategoryId)?.name ||
      "ta catégorie";
    const summaryBits = [];
    if (createdOutcomeId) summaryBits.push("1 objectif");
    if (createdActionIds.length) summaryBits.push(`${createdActionIds.length} action${createdActionIds.length > 1 ? "s" : ""}`);
    const createdAt = new Date().toISOString();
    const summaryText = `Créé dans ${categoryLabel}.\n${summaryBits.join(" · ") || "Structure créée."}`;
    const viewTarget = buildCreationViewTarget({
      createdCategoryId,
      createdActionIds,
      createdOutcomeId,
    });
    const message = buildCoachConversationMessage(
      "assistant",
      summaryText,
      createdAt,
      {
        kind: "conversation",
        mode: "plan",
        message: summaryText,
        primaryAction: {
          intent: "open_created_view",
          label: "Voir",
          categoryId: createdCategoryId,
          actionId: createdActionIds.length === 1 && !createdOutcomeId ? createdActionIds[0] : createdOutcomeId || null,
          viewTarget,
        },
        secondaryAction: {
          intent: "continue_coach",
          label: "Continuer",
        },
        proposal: null,
        createStatus: "created",
        createMessage: "",
        viewTarget,
      }
    );
    setData((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      const result = appendCoachConversationMessages(safePrevious.coach_conversations_v1, {
        conversationId: origin.coachConversationId,
        messages: message ? [message] : [],
        contextSnapshot: {
          activeCategoryId: createdCategoryId,
          dateKey: origin.dateKey,
        },
        mode: "plan",
      });
      return {
        ...safePrevious,
        coach_conversations_v1: result.state,
      };
    });
  };

  const handleSave = () => {
    setError("");
    const pendingOutcome =
      effectiveKind === "outcome" || effectiveKind === "guided" || (effectiveKind === "assistant" && outcomeDraftSource)
        ? outcomeController.draftValue
        : null;
    const pendingAction = effectiveKind !== "outcome" ? actionController.draftValue : null;

    const preparedCommit = prepareCreateCommit({
      state: safeData,
      kind: effectiveKind === "assistant" ? assistantProposal?.kind || "assistant" : effectiveKind,
      actionDraft: pendingAction,
      outcomeDraft: pendingOutcome,
      additionalActionDrafts: additionalProposalActionDrafts,
      canCreateAction,
      canCreateOutcome,
      isPremiumPlan,
      planLimits,
    });
    if (!preparedCommit.ok) {
      if (preparedCommit.kind === "paywall") {
        onOpenPaywall?.(preparedCommit.message);
        return;
      }
      setError(preparedCommit.message || "Création indisponible pour le moment.");
      return;
    }

    const commitResult = commitPreparedCreatePlan(safeData, preparedCommit.plan, {
      generationWindowDays,
      isPremiumPlan,
    });
    setData?.(commitResult.state);
    persistCoachSummary({
      createdCategoryId: commitResult.createdCategoryId,
      createdActionIds: commitResult.createdActionIds,
      createdOutcomeId: commitResult.createdOutcomeId,
    });
    finalizeAndClose({
      outcome: "saved",
      createdCategoryId: commitResult.createdCategoryId,
      createdIds: {
        outcomeId: commitResult.createdOutcomeId,
        actionIds: commitResult.createdActionIds,
      },
    });
  };

  const headerTitle =
    effectiveKind === "guided"
      ? "Créer un objectif puis une action"
      : effectiveKind === "outcome"
        ? `Créer un ${LABELS.goalLower}`
        : effectiveKind === "assistant"
          ? "Valider la proposition"
          : "Créer une action";
  const headerSubtitle =
    effectiveKind === "guided"
      ? "Commence par la catégorie, pose l’objectif, puis une première action vraiment exécutable."
      : effectiveKind === "outcome"
        ? "Choisis d’abord la bonne catégorie, puis pose un objectif clair."
        : effectiveKind === "assistant"
          ? "Le Coach propose une structure courte. Tu valides la catégorie, l’objectif éventuel et les actions utiles."
          : "Choisis la catégorie, puis donne à l’action un rythme simple et crédible.";

  const headerRight = (
    <div className="createItemHeaderMeta">
      <StatusBadge className="createItemHeaderBadge">
        {effectiveKind === "assistant"
          ? "Assistant"
          : effectiveKind === "guided"
            ? "Guidé"
            : effectiveKind === "outcome"
              ? "Objectif"
              : LABELS.action}
      </StatusBadge>
      <div className="createItemHeaderText">Retour vers {resolveMainTabLabel(origin.mainTab)}</div>
    </div>
  );

  const actionScreenController = {
    ...actionController,
    error,
    onBack: handleCancel,
    handleSave,
  };
  const outcomeScreenController = {
    ...outcomeController,
    error,
    onBack: handleCancel,
    handleSave,
  };

  return (
    <AppScreen
      data={data}
      pageId="create-item"
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      headerRight={headerRight}
    >
      <div className="mainPageStack">
        {effectiveKind === "outcome" ? (
          <OutcomeCreateScreen controller={outcomeScreenController} />
        ) : effectiveKind === "guided" ? (
          <GuidedCreateScreen
            outcomeController={outcomeController}
            actionController={actionController}
            error={error}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        ) : effectiveKind === "assistant" ? (
          <AssistantCreateScreen
            controller={{
              ...actionController,
              unresolvedQuestions,
              additionalReviewCards,
            }}
            outcomeController={outcomeDraftSource ? outcomeController : null}
            error={error}
            onCancel={handleCancel}
            onSave={handleSave}
          />
        ) : (
          <ActionCreateScreen controller={actionScreenController} />
        )}
      </div>
    </AppScreen>
  );
}
