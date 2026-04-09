import React, { useEffect, useMemo, useState } from "react";
import { normalizeRouteOrigin } from "../app/routeOrigin";
import { safeConfirm } from "../utils/dialogs";
import { uid } from "../utils/helpers";
import { AppScreen, StatusBadge } from "../shared/ui/app";
import {
  getVisibleCategories,
} from "../domain/categoryVisibility";
import { resolveGoalType } from "../domain/goalType";
import { canCreateCategory } from "../logic/entitlements";
import { normalizeCategory } from "../logic/state";
import { CATEGORY_UI_COPY, LABELS } from "../ui/labels";
import {
  updateCoachConversationMessage,
} from "../features/coach/coachStorage";
import {
  buildCreationViewTarget,
  commitPreparedCreatePlan,
  prepareCreateCommit,
} from "../features/create-item/createItemCommit";
import {
  buildMinDeadlineKey,
  ensureSuggestedCategory,
  normalizeReminderTimes,
  resolveSuggestedCategories,
} from "../features/create-item/createItemShared";
import {
  normalizeDurationMinutes,
  normalizeQuantityValue,
} from "../features/edit-item/editItemShared";
import {
  AssistantCreateScreen,
  GuidedCreateScreen,
  ActionManualCreateScreen,
  OutcomeManualCreateScreen,
} from "../features/create-item/CreateItemScreens";
import {
  createEmptyCreateItemDraft,
  normalizeActionDraft,
  normalizeCreateItemDraft,
  normalizeOutcomeDraft,
} from "../creation/createItemDraft";
import {
  addDaysLocal,
  normalizeLocalDateKey,
  normalizeStartTime,
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

function resolveMainTabLabel(mainTab) {
  if (mainTab === "planning") return "Planning";
  if (mainTab === "library") return "Objectifs";
  if (mainTab === "pilotage") return "Analyses";
  return "Aujourd'hui";
}

function normalizeCategoryName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveActionTimingPreset(draftValue) {
  const safeDraft = draftValue && typeof draftValue === "object" ? draftValue : {};
  const repeat = safeDraft.repeat || "none";
  if (repeat === "daily" || repeat === "weekly") return "recurring";
  const todayKey = todayLocalKey();
  const oneOffDate = normalizeLocalDateKey(safeDraft.oneOffDate);
  if (oneOffDate && oneOffDate > todayKey) return "later";
  if (safeDraft.timeMode === "FIXED" && normalizeStartTime(safeDraft.startTime)) return "today";
  return "now";
}

function applyActionTimingPreset(controller, preset) {
  const todayKey = todayLocalKey();
  if (!controller || typeof controller !== "object") return;
  if (preset === "recurring") {
    controller.setRepeat(controller.repeat === "weekly" ? "weekly" : "daily");
    controller.handleRecurringTimeModeChange("NONE");
    controller.setStartTime("");
    return;
  }

  controller.setRepeat("none");
  controller.handleOneOffTimeModeChange("NONE");
  controller.setOneOffTime("");

  if (preset === "later") {
    const nextDate =
      normalizeLocalDateKey(controller.oneOffDate) > todayKey
        ? normalizeLocalDateKey(controller.oneOffDate)
        : addDaysLocal(todayKey, 1);
    controller.setOneOffDate(nextDate || addDaysLocal(todayKey, 1));
    return;
  }

  controller.setOneOffDate(todayKey);
}

function resolveOutcomeHorizonPreset(draftValue) {
  const safeDraft = draftValue && typeof draftValue === "object" ? draftValue : {};
  const startDate = normalizeLocalDateKey(safeDraft.startDate) || todayLocalKey();
  const deadline = normalizeLocalDateKey(safeDraft.deadline);
  if (!deadline) return "none";
  if (deadline === addDaysLocal(startDate, 7)) return "7";
  if (deadline === addDaysLocal(startDate, 30)) return "30";
  if (deadline === addDaysLocal(startDate, 90)) return "90";
  return "";
}

function applyOutcomeHorizonPreset(controller, preset) {
  const todayKey = todayLocalKey();
  if (!controller || typeof controller !== "object") return;
  controller.handleOutcomeStartDateChange(todayKey);
  if (preset === "none") {
    controller.setDeadline("");
    return;
  }
  controller.setDeadline(addDaysLocal(todayKey, Number.parseInt(preset, 10)) || "");
}

function useActionDraftController({
  categories,
  outcomes,
  actionDraft,
  categoryOptions,
  suggestedCategories,
  onActivateSuggestedCategory,
  onCreateCategory,
  linkedOutcomeRequired = false,
}) {
  const initialDraft = useMemo(() => normalizeActionDraft(actionDraft), [actionDraft]);
  const [title, setTitle] = useState(initialDraft.title || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialDraft.categoryId || categories[0]?.id || "");
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
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryCreationError, setCategoryCreationError] = useState("");

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
    setDaysOfWeek,
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
    isCreatingCategory,
    openCategoryCreator: () => {
      setIsCreatingCategory(true);
      setCategoryCreationError("");
    },
    cancelCategoryCreator: () => {
      setIsCreatingCategory(false);
      setNewCategoryName("");
      setCategoryCreationError("");
    },
    newCategoryName,
    setNewCategoryName,
    categoryCreationError,
    createInlineCategory: () => {
      const result = onCreateCategory?.(newCategoryName);
      if (!result?.ok || !result.category) {
        setCategoryCreationError(result?.error || CATEGORY_UI_COPY.emptyNameError);
        return;
      }
      setSelectedCategoryId(result.category.id);
      setIsCreatingCategory(false);
      setNewCategoryName("");
      setCategoryCreationError("");
    },
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

  const categoryName =
    categoryOptions.find((category) => category.id === selectedCategoryId)?.name || "Catégorie à confirmer";
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

function useOutcomeDraftController({
  categories,
  outcomeDraft,
  categoryOptions,
  suggestedCategories,
  onActivateSuggestedCategory,
  onCreateCategory,
}) {
  const initialDraft = useMemo(() => normalizeOutcomeDraft(outcomeDraft), [outcomeDraft]);
  const [title, setTitle] = useState(initialDraft.title || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialDraft.categoryId || categories[0]?.id || "");
  const [priority, setPriority] = useState(initialDraft.priority || "secondaire");
  const [startDate, setStartDate] = useState(initialDraft.startDate || todayLocalKey());
  const [deadline, setDeadline] = useState(initialDraft.deadline || "");
  const [measureType, setMeasureType] = useState(initialDraft.measureType || "");
  const [targetValue, setTargetValue] = useState(
    initialDraft.targetValue != null ? String(initialDraft.targetValue) : ""
  );
  const [notes, setNotes] = useState(initialDraft.notes || "");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryCreationError, setCategoryCreationError] = useState("");
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
    isCreatingCategory,
    openCategoryCreator: () => {
      setIsCreatingCategory(true);
      setCategoryCreationError("");
    },
    cancelCategoryCreator: () => {
      setIsCreatingCategory(false);
      setNewCategoryName("");
      setCategoryCreationError("");
    },
    newCategoryName,
    setNewCategoryName,
    categoryCreationError,
    createInlineCategory: () => {
      const result = onCreateCategory?.(newCategoryName);
      if (!result?.ok || !result.category) {
        setCategoryCreationError(result?.error || CATEGORY_UI_COPY.emptyNameError);
        return;
      }
      setSelectedCategoryId(result.category.id);
      setIsCreatingCategory(false);
      setNewCategoryName("");
      setCategoryCreationError("");
    },
    minDeadlineKey,
    handleOutcomeStartDateChange: (event) => {
      const nextValue = event?.target?.value || event || "";
      const normalized = normalizeLocalDateKey(nextValue) || todayLocalKey();
      setStartDate(normalized);
      setDeadline((previous) => {
        const current = normalizeLocalDateKey(previous);
        if (!current) return "";
        return current >= buildMinDeadlineKey(normalized) ? current : buildMinDeadlineKey(normalized);
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
  const categoryName =
    categoryOptions.find((category) => category.id === selectedCategoryId)?.name || "Catégorie à confirmer";
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
  const suggestedCategories = useMemo(() => resolveSuggestedCategories(categories), [categories]);
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
  const createInlineCategory = (rawName) => {
    const cleanName = String(rawName || "").trim();
    if (!cleanName) {
      return { ok: false, error: CATEGORY_UI_COPY.emptyNameError };
    }
    const normalizedName = normalizeCategoryName(cleanName);
    const duplicate = categories.find((category) => normalizeCategoryName(category?.name) === normalizedName) || null;
    if (duplicate) {
      return { ok: false, error: CATEGORY_UI_COPY.duplicateNameError };
    }
    if (!canCreateCategory(safeData)) {
      onOpenPaywall?.("Limite de catégories atteinte.");
      return { ok: false, error: "Limite de catégories atteinte." };
    }
    const created = normalizeCategory(
      {
        id: `cat_${uid()}`,
        name: cleanName,
      },
      categories.length
    );
    if (typeof setData === "function") {
      setData((previous) => {
        const previousCategories = Array.isArray(previous?.categories) ? previous.categories : [];
        if (
          previousCategories.some(
            (category) => normalizeCategoryName(category?.name) === normalizedName || category?.id === created.id
          )
        ) {
          return previous;
        }
        return {
          ...previous,
          categories: [...previousCategories, created],
        };
      });
    }
    return { ok: true, category: created };
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
    onCreateCategory: createInlineCategory,
    linkedOutcomeRequired: effectiveKind === "guided" || (effectiveKind === "assistant" && Boolean(outcomeDraftSource)),
  });
  const outcomeController = useOutcomeDraftController({
    categories,
    outcomeDraft: outcomeDraftSource,
    categoryOptions,
    suggestedCategories,
    onActivateSuggestedCategory: activateSuggestedCategory,
    onCreateCategory: createInlineCategory,
  });
  const actionManualController = {
    ...actionController,
    timingPreset: resolveActionTimingPreset(actionController.draftValue),
    selectTimingPreset: (preset) => applyActionTimingPreset(actionController, preset),
    setRecurringCadence: (value) => {
      const normalized = value === "weekly" ? "weekly" : "daily";
      actionController.setRepeat(normalized);
      if (normalized === "weekly" && !actionController.daysOfWeek.length) {
        actionController.setDaysOfWeek([1, 2, 3, 4, 5]);
      }
    },
  };
  const outcomeManualController = {
    ...outcomeController,
    horizonPreset: resolveOutcomeHorizonPreset(outcomeController.draftValue),
    selectHorizonPreset: (preset) => applyOutcomeHorizonPreset(outcomeController, preset),
  };

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
    const messageCreatedAt =
      origin.coachMessageCreatedAt || assistantProposal?.sourceContext?.coachMessageCreatedAt || null;
    if (!messageCreatedAt) return;
    const viewTarget = buildCreationViewTarget({
      createdCategoryId,
      createdActionIds,
      createdOutcomeId,
    });
    setData((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      const nextCoachConversations = updateCoachConversationMessage(safePrevious.coach_conversations_v1, {
        conversationId: origin.coachConversationId,
        messageCreatedAt,
        update: (message) => ({
          ...message,
          coachReply: {
            ...(message?.coachReply || {}),
            createStatus: "created",
            createMessage: "",
            viewTarget,
          },
        }),
      });
      return {
        ...safePrevious,
        coach_conversations_v1: nextCoachConversations,
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
      proposal: assistantProposal,
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
        ? `Pars du cap à faire avancer, puis affine seulement ce qui aide à rendre l’${LABELS.goalLower} lisible.`
        : effectiveKind === "assistant"
          ? "Le Coach propose une structure courte. Tu valides la catégorie, l’objectif éventuel et les actions utiles."
          : "Pars de l’intention, choisis un cadre simple, puis confirme sans te noyer dans le formulaire.";

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
    ...actionManualController,
    error,
    onBack: handleCancel,
    handleSave,
  };
  const outcomeScreenController = {
    ...outcomeManualController,
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
          <OutcomeManualCreateScreen controller={outcomeScreenController} />
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
          <ActionManualCreateScreen controller={actionScreenController} />
        )}
      </div>
    </AppScreen>
  );
}
