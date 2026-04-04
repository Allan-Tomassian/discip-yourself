import React, { useEffect, useMemo, useState } from "react";
import { AppCard, AppScreen, GhostButton } from "../shared/ui/app";
import ConflictResolver from "../ui/scheduling/ConflictResolver";
import { safeConfirm } from "../utils/dialogs";
import {
  appDowFromDate,
  buildDateRangeLocalKeys,
  clampTimeToDay,
  fromLocalDateKey,
  minutesToTimeStr,
  normalizeLocalDateKey,
  normalizeStartTime,
  todayLocalKey,
  toLocalDateKey,
} from "../utils/datetime";
import { addDays } from "../utils/dates";
import { createDefaultGoalSchedule, normalizeCategory } from "../logic/state";
import { updateActionModel } from "../domain/actionModel";
import {
  getFirstVisibleCategoryId,
  getVisibleCategories,
  resolveVisibleCategoryId,
} from "../domain/categoryVisibility";
import { updateGoal } from "../logic/goals";
import { setPrimaryGoalForCategory } from "../logic/priority";
import { resolveGoalType } from "../domain/goalType";
import { regenerateWindowFromScheduleRules, removeScheduleRulesForAction } from "../logic/occurrencePlanner";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import { canCreateCategory } from "../logic/entitlements";
import { normalizeTimeFields } from "../logic/timeFields";
import { setOccurrenceStatusById } from "../logic/occurrences";
import { findConflicts, suggestNextSlots } from "../core/scheduling/intervals";
import { LABELS } from "../ui/labels";
import { useBehaviorFeedback } from "../feedback/BehaviorFeedbackContext";
import { deriveBehaviorFeedbackSignal } from "../feedback/feedbackDerivers";
import { ActionEditScreen, OutcomeEditScreen } from "../features/edit-item/EditItemScreens";
import {
  DEFAULT_CONFLICT_DURATION,
  buildOccurrencesByGoal,
  buildPlanSignature,
  buildStartAt,
  normalizeDays,
  normalizeDurationMinutes,
  normalizeQuantityPeriod,
  normalizeQuantityUnit,
  normalizeQuantityValue,
  normalizeRepeat,
  normalizeTimes,
  parseStartAt,
  resolvePlanType,
  resolvePriority,
  updateRemindersForGoal,
} from "../features/edit-item/editItemShared";

export default function EditItem({ data, setData, editItem, onBack, generationWindowDays = null, onOpenPaywall }) {
  const { emitBehaviorFeedback } = useBehaviorFeedback();
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const backgroundImage = safeData?.profile?.whyImage || "";
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const goalsById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const reminders = useMemo(
    () => (Array.isArray(safeData.reminders) ? safeData.reminders : []),
    [safeData.reminders]
  );
  const occurrences = useMemo(
    () => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []),
    [safeData.occurrences]
  );
  const categories = useMemo(
    () => getVisibleCategories(safeData.categories),
    [safeData.categories]
  );
  const outcomes = useMemo(() => goals.filter((goal) => resolveGoalType(goal) === "OUTCOME"), [goals]);
  const existingNames = new Set(categories.map((category) => String(category?.name || "").trim().toLowerCase()).filter(Boolean));
  const existingIds = new Set(categories.map((category) => category?.id).filter(Boolean));
  const suggestedCategories = SUGGESTED_CATEGORIES.filter(
    (category) =>
      category &&
      !existingIds.has(category.id) &&
      !existingNames.has(String(category.name || "").trim().toLowerCase())
  );
  const categoryOptions = [
    ...categories.slice().sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""))),
    ...suggestedCategories.map((category) => ({ id: category.id, name: category.name, suggested: true })),
  ];

  const rawItem = useMemo(
    () => (editItem?.id ? goals.find((goal) => goal?.id === editItem.id) || null : null),
    [editItem?.id, goals]
  );
  const item = useMemo(() => {
    if (!rawItem) return null;
    return {
      ...rawItem,
      _reminders: reminders.filter((reminder) => reminder?.goalId === rawItem.id),
      _occurrences: occurrences.filter((occurrence) => occurrence && occurrence.goalId === rawItem.id),
    };
  }, [rawItem, reminders, occurrences]);

  const type = resolveGoalType(rawItem);
  const isProcess = type === "PROCESS";

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("secondaire");
  const [repeat, setRepeat] = useState("daily");
  const [timeMode, setTimeMode] = useState("NONE");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [oneOffDate, setOneOffDate] = useState("");
  const [oneOffTime, setOneOffTime] = useState("");
  const [timeSlots, setTimeSlots] = useState([]);
  const [sessionMinutes, setSessionMinutes] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState(createDefaultGoalSchedule().daysOfWeek);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState(["09:00"]);
  const [reminderChannel, setReminderChannel] = useState("IN_APP");
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [quantityValue, setQuantityValue] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const [quantityPeriod, setQuantityPeriod] = useState("DAY");
  const [measureType, setMeasureType] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedOutcomeId, setSelectedOutcomeId] = useState("");
  const [deadlineTouched, setDeadlineTouched] = useState(false);
  const [error, setError] = useState("");
  const [conflictState, setConflictState] = useState(null);

  const effectiveSelectedOutcomeId =
    isProcess && selectedOutcomeId && outcomes.some((outcome) => outcome.id === selectedOutcomeId) ? selectedOutcomeId : "";
  const selectedSuggestion = suggestedCategories.find((category) => category.id === selectedCategoryId) || null;
  const effectiveStartKey = normalizeLocalDateKey(startDate) || todayLocalKey();
  const minDeadlineKey = useMemo(() => {
    const normalized = normalizeLocalDateKey(effectiveStartKey);
    if (!normalized) return "";
    const base = fromLocalDateKey(normalized);
    base.setDate(base.getDate() + 1);
    return toLocalDateKey(base);
  }, [effectiveStartKey]);
  const hasOccurrenceSource = Array.isArray(item?._occurrences) && item._occurrences.length > 0;
  const hasScheduleSource =
    isProcess && item?.schedule && Array.isArray(item.schedule.timeSlots) && item.schedule.timeSlots.length > 0;
  const canUseReminders = hasOccurrenceSource || hasScheduleSource;
  const hasMultipleSlots = isProcess && Array.isArray(timeSlots) && timeSlots.length > 1;
  const timeInputValue = repeat === "none" ? oneOffTime : startTime;
  const showFixedTimeHint = isProcess && !hasMultipleSlots && timeMode === "FIXED" && !normalizeStartTime(timeInputValue);

  const fixedOccurrencesByDate = useMemo(() => {
    const map = new Map();
    for (const occurrence of occurrences) {
      if (!occurrence || occurrence.noTime === true) continue;
      if (occurrence.timeType === "window") continue;
      const dateKey = normalizeLocalDateKey(occurrence.date);
      if (!dateKey) continue;
      const start = normalizeStartTime(occurrence.start || occurrence.slotKey || "");
      if (!start) continue;
      const list = map.get(dateKey) || [];
      list.push({
        id: occurrence.id,
        goalId: occurrence.goalId,
        dateKey,
        startHHmm: start,
        durationMin: occurrence.durationMinutes,
        occurrence,
      });
      map.set(dateKey, list);
    }
    return map;
  }, [occurrences]);

  useEffect(() => {
    if (!item) return;
    const resolvedPlan = isProcess ? resolvePlanType(item) : "STATE";
    const parsed = parseStartAt(item.startAt || item.startDate || "");
    const scheduleBase = createDefaultGoalSchedule();
    const schedule =
      item.schedule && typeof item.schedule === "object"
        ? { ...scheduleBase, ...item.schedule }
        : { ...scheduleBase };
    const scheduleDays = normalizeDays(schedule.daysOfWeek);
    const scheduleSlotsRaw =
      item.schedule && typeof item.schedule === "object" && Array.isArray(item.schedule.timeSlots)
        ? item.schedule.timeSlots
        : [];
    const reminderItems = Array.isArray(item._reminders) ? item._reminders : [];
    const reminderTimesRaw = reminderItems.length ? reminderItems.map((reminder) => reminder.time) : [];
    const reminderTimesClean = normalizeTimes(reminderTimesRaw);
    const reminderEnabled =
      reminderItems.length > 0 ? reminderItems.some((reminder) => reminder.enabled !== false) : Boolean(item.reminderTime);
    const primaryReminderTime = normalizeStartTime(item.reminderTime || reminderTimesClean[0] || "");
    const reminderChannelRaw = reminderItems.find((reminder) => reminder?.channel)?.channel || "IN_APP";
    const windowStartValue = normalizeStartTime(item.reminderWindowStart || schedule.windowStart || "");
    const windowEndValue = normalizeStartTime(item.reminderWindowEnd || schedule.windowEnd || "");
    const normalizedRepeat = normalizeRepeat(item.repeat);
    const derivedRepeat =
      normalizedRepeat ||
      (resolvedPlan === "ONE_OFF"
        ? "none"
        : scheduleDays.length && scheduleDays.length < 7
          ? "weekly"
          : "daily");
    const rawQuantityValue = normalizeQuantityValue(item.quantityValue);
    const rawQuantityUnit = normalizeQuantityUnit(item.quantityUnit);
    const rawQuantityPeriod = normalizeQuantityPeriod(item.quantityPeriod);

    setTitle(item.title || "");
    setPriority(resolvePriority(item));
    setRepeat(derivedRepeat);
    setStartDate(normalizeLocalDateKey(item.startDate) || parsed.date || todayLocalKey());
    const timeFields = normalizeTimeFields({
      timeMode: item.timeMode,
      timeSlots:
        Array.isArray(item.timeSlots) && item.timeSlots.length ? item.timeSlots : scheduleSlotsRaw,
      startTime: item.startTime || parsed.time || "",
      reminderTime: primaryReminderTime,
    });
    const nextStartTime = timeFields.startTime === "00:00" ? "" : timeFields.startTime;
    setTimeMode(timeFields.timeMode);
    setTimeSlots(timeFields.timeSlots);
    setStartTime(nextStartTime);
    const normalizedOneOffDate =
      normalizeLocalDateKey(item.oneOffDate) ||
      (resolvedPlan === "ONE_OFF" ? parsed.date : "");
    setOneOffDate(normalizedOneOffDate || "");
    setOneOffTime(nextStartTime);
    setSessionMinutes(
      Number.isFinite(item.durationMinutes)
        ? String(item.durationMinutes)
        : Number.isFinite(schedule.durationMinutes)
          ? String(schedule.durationMinutes)
          : ""
    );
    setDaysOfWeek(scheduleDays);
    setWindowStart(windowStartValue);
    setWindowEnd(windowEndValue);
    setRemindersEnabled(reminderEnabled && canUseReminders);
    setReminderTimes(reminderTimesClean.length ? reminderTimesClean : primaryReminderTime ? [primaryReminderTime] : ["09:00"]);
    setReminderChannel(reminderChannelRaw === "NOTIFICATION" ? "NOTIFICATION" : "IN_APP");
    setNotes(isProcess ? item.habitNotes || "" : item.notes || "");
    setDeadline(item.deadline || "");
    setQuantityValue(rawQuantityValue != null ? String(rawQuantityValue) : "");
    setQuantityUnit(rawQuantityUnit);
    setQuantityPeriod(rawQuantityPeriod || "DAY");
    setMeasureType(item.measureType || "");
    setTargetValue(item.targetValue != null ? String(item.targetValue) : "");
    setSelectedCategoryId(
      resolveVisibleCategoryId(item.categoryId, categories) ||
      getFirstVisibleCategoryId(categories) ||
      ""
    );
    setSelectedOutcomeId(item.parentId || item.outcomeId || "");
    setDeadlineTouched(Boolean(item.deadline));
    setError("");
  }, [categories, item, isProcess, canUseReminders]);

  function buildCandidateIntervalsForEdit(windowFromKey, windowToKey, overrides = {}) {
    if (!isProcess) return [];
    if (hasMultipleSlots) return [];
    const effectiveTimeMode = overrides.timeMode || timeMode;
    if (effectiveTimeMode !== "FIXED") return [];
    const effectiveTimeInput = overrides.timeInput ?? timeInputValue;
    const start = normalizeStartTime(effectiveTimeInput);
    if (!start) return [];
    const durationMin = normalizeDurationMinutes(sessionMinutes);

    if (repeat === "none") {
      const dateKey = normalizeLocalDateKey(oneOffDate);
      if (!dateKey) return [];
      return [{ dateKey, startHHmm: start, durationMin }];
    }

    const days =
      repeat === "daily"
        ? [1, 2, 3, 4, 5, 6, 7]
        : normalizeDays(daysOfWeek);
    if (!days.length) return [];

    const dates = buildDateRangeLocalKeys(windowFromKey, windowToKey);
    const out = [];
    for (const dateKey of dates) {
      const dow = appDowFromDate(fromLocalDateKey(dateKey));
      if (!days.includes(dow)) continue;
      out.push({ dateKey, startHHmm: start, durationMin });
    }
    return out;
  }

  function findFirstConflictForEdit(ignoreOccurrenceIds, overrides = {}) {
    const ignoreSet = ignoreOccurrenceIds || new Set();
    const days =
      Number.isFinite(generationWindowDays) && generationWindowDays > 0
        ? Math.floor(generationWindowDays)
        : 14;
    const fromKey = todayLocalKey();
    const baseDate = fromLocalDateKey(fromKey);
    const toKey = baseDate ? toLocalDateKey(addDays(baseDate, Math.max(0, days - 1))) : fromKey;

    const candidates = buildCandidateIntervalsForEdit(fromKey, toKey, overrides);
    for (const candidate of candidates) {
      const existing = (fixedOccurrencesByDate.get(candidate.dateKey) || []).filter(
        (occurrence) => occurrence && occurrence.goalId !== item?.id && !ignoreSet.has(occurrence.id)
      );
      const conflicts = findConflicts({
        dateKey: candidate.dateKey,
        candidate,
        existingFixedOccurrences: existing,
        defaultDuration: DEFAULT_CONFLICT_DURATION,
      });
      if (conflicts.length) {
        const suggestions = suggestNextSlots({
          dateKey: candidate.dateKey,
          candidate,
          existing,
          step: 15,
          limit: 3,
          defaultDuration: DEFAULT_CONFLICT_DURATION,
        });
        return { candidate, conflicts, suggestions };
      }
    }
    return null;
  }

  function toggleDay(day) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day]));
  }

  function activateSuggestedCategory(category) {
    if (!category || typeof setData !== "function") return;
    if (!canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") {
        onOpenPaywall("Limite de catégories atteinte.");
      } else {
        setError("Limite de catégories atteinte.");
      }
      return;
    }
    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      if (prevCategories.some((entry) => entry?.id === category.id)) return prev;
      if (
        prevCategories.some(
          (entry) => String(entry?.name || "").trim().toLowerCase() === String(category.name || "").trim().toLowerCase()
        )
      ) {
        return prev;
      }
      const created = normalizeCategory({ id: category.id, name: category.name, color: category.color }, prevCategories.length);
      return { ...prev, categories: [...prevCategories, created] };
    });
    setSelectedCategoryId(category.id);
  }

  function updateReminderTime(index, value) {
    setReminderTimes((prev) => prev.map((entry, currentIndex) => (currentIndex === index ? value : entry)));
  }

  function addReminderTime() {
    setReminderTimes((prev) => [...prev, "09:00"]);
  }

  function removeReminderTime(index) {
    setReminderTimes((prev) => {
      const next = prev.filter((_, currentIndex) => currentIndex !== index);
      return next.length ? next : ["09:00"];
    });
  }

  function handleRecurringTimeModeChange(nextMode) {
    setTimeMode(nextMode);
    if (nextMode !== "FIXED") {
      setStartTime("");
    }
  }

  function handleOneOffTimeModeChange(nextMode) {
    setTimeMode(nextMode);
    if (nextMode !== "FIXED") {
      setOneOffTime("");
    }
  }

  function handleOutcomeStartDateChange(event) {
    const nextValue = event.target.value;
    setStartDate(nextValue);
    if (!deadlineTouched) {
      const base = fromLocalDateKey(normalizeLocalDateKey(nextValue) || todayLocalKey());
      base.setDate(base.getDate() + 7);
      setDeadline(toLocalDateKey(base));
    }
    if (error) setError("");
  }

  function handleDeadlineChange(event) {
    setDeadline(event.target.value);
    setDeadlineTouched(true);
    if (error) setError("");
  }

  function handleSave(options = {}) {
    const { conflictResolution, overrideStartTime, overrideTimeMode } = options || {};
    const cleanTitle = (title || "").trim();
    if (!cleanTitle) {
      setError("Titre requis.");
      return;
    }
    setError("");

    const updates = {
      title: cleanTitle,
      priority,
    };
    updates.priorityLevel = priority === "prioritaire" ? "primary" : priority === "secondaire" ? "secondary" : "bonus";

    const normalizedCategoryId =
      resolveVisibleCategoryId(selectedCategoryId, categories) ||
      getFirstVisibleCategoryId(categories) ||
      "";
    if (!normalizedCategoryId) {
      setError("Choisis une vraie catégorie.");
      return;
    }
    const matchedSuggestion = suggestedCategories.find((category) => category.id === normalizedCategoryId) || null;
    if (matchedSuggestion && !canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") {
        onOpenPaywall("Limite de catégories atteinte.");
      } else {
        setError("Limite de catégories atteinte.");
      }
      return;
    }

    let normalizedReminderTimes = [];
    let normalizedPrimaryReminderTime = "";
    let normalizedWindowStart = "";
    let normalizedWindowEnd = "";

    if (isProcess) {
      const repeatMode = normalizeRepeat(repeat);
      const isWeekly = repeatMode === "weekly";
      const isOneOff = repeatMode === "none";
      const effectiveTimeMode = overrideTimeMode || timeMode;
      const effectiveTimeInput = typeof overrideStartTime === "string" ? overrideStartTime : timeInputValue;
      const normalizedOneOff = normalizeLocalDateKey(oneOffDate);
      if (isOneOff && !normalizedOneOff) {
        setError("Choisis une date pour cette action ponctuelle.");
        return;
      }
      if (isWeekly && (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0)) {
        setError("Choisis au moins un jour.");
        return;
      }
      const normalizedTimeInput = normalizeStartTime(effectiveTimeInput);
      if (!hasMultipleSlots && effectiveTimeMode === "FIXED" && !normalizedTimeInput) {
        setError("Choisis une heure.");
        return;
      }
      const normalizedDuration = normalizeDurationMinutes(sessionMinutes);
      const days = normalizeDays(daysOfWeek);
      normalizedReminderTimes = remindersEnabled ? normalizeTimes(reminderTimes) : [];
      normalizedPrimaryReminderTime = normalizedReminderTimes[0] || "";
      normalizedWindowStart = normalizeStartTime(windowStart);
      normalizedWindowEnd = normalizeStartTime(windowEnd);
      if ((normalizedWindowStart || normalizedWindowEnd) && !normalizedPrimaryReminderTime) {
        setError("Choisis d’abord une heure de rappel.");
        return;
      }
      const effectiveStart = normalizedTimeInput || normalizedPrimaryReminderTime || "00:00";
      const scheduleBase = createDefaultGoalSchedule();
      const schedule = isOneOff
        ? undefined
        : {
            ...scheduleBase,
            ...item.schedule,
            daysOfWeek: isWeekly ? days : [],
            timeSlots: [effectiveStart],
            durationMinutes: normalizedDuration,
            remindersEnabled: Boolean(normalizedPrimaryReminderTime),
            windowStart: normalizedPrimaryReminderTime ? normalizedWindowStart || "" : "",
            windowEnd: normalizedPrimaryReminderTime ? normalizedWindowEnd || "" : "",
          };
      const startAt = isOneOff
        ? buildStartAt(
            normalizedOneOff || todayLocalKey(),
            normalizedTimeInput || normalizedPrimaryReminderTime || "00:00"
          )
        : null;

      const normalizedQuantityValue = normalizeQuantityValue(quantityValue);
      const normalizedQuantityUnit = normalizeQuantityUnit(quantityUnit);
      if (String(quantityValue || "").trim() && !normalizedQuantityValue) {
        setError("Quantité invalide.");
        return;
      }
      if (normalizedQuantityValue && !normalizedQuantityUnit) {
        setError("Unité requise pour la quantité.");
        return;
      }

      updates.categoryId = normalizedCategoryId;
      updates.planType = isOneOff ? "ONE_OFF" : "ACTION";
      updates.repeat = repeatMode;
      updates.daysOfWeek = isWeekly ? days : [];
      updates.durationMinutes = normalizedDuration;
      updates.oneOffDate = isOneOff ? normalizedOneOff || "" : undefined;
      updates.startAt = startAt || null;
      updates.schedule = schedule;
      updates.cadence = !isOneOff ? (repeatMode === "daily" ? "DAILY" : "WEEKLY") : undefined;
      updates.target = !isOneOff ? 1 : undefined;
      updates.freqCount = !isOneOff ? 1 : undefined;
      updates.freqUnit = !isOneOff ? (repeatMode === "daily" ? "DAY" : "WEEK") : undefined;
      updates.habitNotes = (notes || "").trim();
      updates.quantityValue = normalizedQuantityValue;
      updates.quantityUnit = normalizedQuantityValue ? normalizedQuantityUnit : "";
      updates.quantityPeriod = normalizedQuantityValue ? normalizeQuantityPeriod(quantityPeriod) : "";
      updates.reminderTime = normalizedPrimaryReminderTime;
      updates.reminderWindowStart = normalizedPrimaryReminderTime ? normalizedWindowStart || "" : "";
      updates.reminderWindowEnd = normalizedPrimaryReminderTime ? normalizedWindowEnd || "" : "";
      updates.parentId = effectiveSelectedOutcomeId || null;
      updates.outcomeId = effectiveSelectedOutcomeId || null;
      const existingTimeFields = normalizeTimeFields({
        timeMode: item.timeMode,
        timeSlots: item.timeSlots,
        startTime: item.startTime,
        reminderTime: normalizedPrimaryReminderTime,
      });
      const timeFieldsToPersist = hasMultipleSlots
        ? existingTimeFields
        : normalizeTimeFields({
            timeMode: effectiveTimeMode,
            timeSlots: effectiveTimeMode === "FIXED" && normalizedTimeInput ? [normalizedTimeInput] : [],
            startTime: normalizedTimeInput,
            reminderTime: normalizedPrimaryReminderTime,
          });
      updates.timeMode = timeFieldsToPersist.timeMode;
      updates.timeSlots = timeFieldsToPersist.timeSlots;
      updates.startTime = timeFieldsToPersist.startTime;
    } else {
      const normalizedStart = normalizeLocalDateKey(startDate) || todayLocalKey();
      const normalizedDeadline = normalizeLocalDateKey(deadline);
      if (!normalizedDeadline || (minDeadlineKey && normalizedDeadline < minDeadlineKey)) {
        setError(`Un ${LABELS.goalLower} dure min. 2 jours. Pour moins de 2 jours, crée une ${LABELS.actionLower}.`);
        return;
      }
      const cleanMeasure = (measureType || "").trim();
      const rawTarget = (targetValue || "").trim();
      const parsedTarget = Number(rawTarget);
      const hasTarget = Boolean(cleanMeasure) && Number.isFinite(parsedTarget) && parsedTarget > 0;

      updates.categoryId = normalizedCategoryId;
      updates.startDate = normalizedStart;
      updates.deadline = normalizedDeadline;
      updates.notes = (notes || "").trim();
      updates.measureType = cleanMeasure || null;
      updates.targetValue = hasTarget ? parsedTarget : null;
      updates.currentValue = hasTarget
        ? Number.isFinite(item.currentValue)
          ? item.currentValue
          : 0
        : null;
      updates.priority = priority;
    }

    if (isProcess) {
      const ignoreIds = new Set(conflictResolution?.cancelOccurrenceIds || []);
      const conflict = findFirstConflictForEdit(ignoreIds, {
        timeMode: overrideTimeMode || timeMode,
        timeInput: typeof overrideStartTime === "string" ? overrideStartTime : timeInputValue,
      });
      if (conflict) {
        const { candidate, conflicts, suggestions } = conflict;
        const conflictItems = conflicts.map((entry, index) => {
          const source = entry.source || {};
          const goal = goalsById.get(source.goalId);
          const start = minutesToTimeStr(clampTimeToDay(entry.conflict?.startMin));
          const end = minutesToTimeStr(clampTimeToDay(entry.conflict?.endMin));
          return {
            id: source.id || `${source.goalId || "occ"}-${index}`,
            title: goal?.title || "Action",
            dateKey: candidate.dateKey,
            start,
            end,
            occurrenceId: source.id,
          };
        });
        setConflictState({
          candidate,
          conflicts: conflictItems,
          suggestions,
          label: `Cette action chevauche une occurrence planifiée le ${candidate.dateKey}.`,
        });
        return;
      }
    }

    const reminderConfig =
      isProcess && remindersEnabled && normalizedReminderTimes.length
        ? {
            enabled: true,
            times: normalizedReminderTimes,
            channel: reminderChannel,
            days: normalizeDays(daysOfWeek),
            label: cleanTitle,
          }
        : null;

    if (typeof setData === "function") {
      const goalId = item.id;
      const categoryId = updates.categoryId || item.categoryId;
      let feedbackSignal = null;
      setData((prev) => {
        let nextState = prev;
        if (conflictResolution?.cancelOccurrenceIds?.length) {
          let updatedOccurrences = Array.isArray(prev.occurrences) ? prev.occurrences : [];
          for (const occId of conflictResolution.cancelOccurrenceIds) {
            updatedOccurrences = setOccurrenceStatusById(occId, "canceled", { occurrences: updatedOccurrences });
          }
          if (updatedOccurrences !== prev.occurrences) {
            nextState = { ...nextState, occurrences: updatedOccurrences };
          }
        }
        if (matchedSuggestion) {
          const prevCategories = Array.isArray(nextState.categories) ? nextState.categories : [];
          if (!prevCategories.some((category) => category?.id === matchedSuggestion.id)) {
            const created = normalizeCategory(
              { id: matchedSuggestion.id, name: matchedSuggestion.name, color: matchedSuggestion.color },
              prevCategories.length
            );
            nextState = { ...nextState, categories: [...prevCategories, created] };
          }
        }
        const prevOccurrencesByGoal = buildOccurrencesByGoal(prev?.occurrences);
        const prevGoal = Array.isArray(prev?.goals) ? prev.goals.find((goal) => goal?.id === goalId) : null;
        const prevPlanSig = buildPlanSignature(prevGoal, prevOccurrencesByGoal);

        const normalizedUpdates =
          type === "OUTCOME"
            ? updates
            : updateActionModel(prevGoal, updates, { categories: nextState.categories }).value;
        if (type !== "OUTCOME" && !normalizedUpdates) return nextState;

        let next = updateGoal(nextState, goalId, normalizedUpdates);
        if (type === "OUTCOME" && updates.priority === "prioritaire" && categoryId) {
          next = setPrimaryGoalForCategory(next, categoryId, goalId);
        }

        const nextOccurrencesByGoal = buildOccurrencesByGoal(next?.occurrences);
        const nextGoal = Array.isArray(next?.goals) ? next.goals.find((goal) => goal?.id === goalId) : null;
        const nextPlanSig = buildPlanSignature(nextGoal, nextOccurrencesByGoal);
        const planChanged = prevPlanSig !== nextPlanSig;

        if (type === "OUTCOME") {
          if (Array.isArray(next.reminders)) {
            const filtered = next.reminders.filter((reminder) => reminder.goalId !== goalId);
            if (filtered.length !== next.reminders.length) {
              next = { ...next, reminders: filtered };
            }
          }
        } else if (reminderConfig) {
          const label = updates.title || item.title || "Rappel";
          const nextReminders = updateRemindersForGoal(next, goalId, reminderConfig, label, { forceNewIds: planChanged });
          next = { ...next, reminders: nextReminders };
        } else if (Array.isArray(next.reminders)) {
          const filtered = next.reminders.filter((reminder) => reminder.goalId !== goalId);
          if (filtered.length !== next.reminders.length) {
            next = { ...next, reminders: filtered };
          }
        }
        if (planChanged && type !== "OUTCOME") {
          const days =
            Number.isFinite(generationWindowDays) && generationWindowDays > 0
              ? Math.floor(generationWindowDays)
              : 14;
          const fromKey = todayLocalKey();
          const baseDate = fromLocalDateKey(fromKey);
          const toKey = baseDate ? toLocalDateKey(addDays(baseDate, Math.max(0, days - 1))) : fromKey;
          next = regenerateWindowFromScheduleRules(next, goalId, fromKey, toKey);
        }
        feedbackSignal = deriveBehaviorFeedbackSignal({
          intent: type === "OUTCOME" ? "update_outcome" : "update_action",
          payload: {
            surface: "edit-item",
            categoryId,
            planChanged,
          },
        });
        return next;
      });
      if (feedbackSignal) emitBehaviorFeedback(feedbackSignal);
    }

    if (typeof onBack === "function") onBack();
  }

  function applyConflictShift(nextStart) {
    if (!nextStart) return;
    setConflictState(null);
    setTimeMode("FIXED");
    setStartTime(nextStart);
    setOneOffTime(nextStart);
    setTimeSlots([nextStart]);
    handleSave({ overrideStartTime: nextStart, overrideTimeMode: "FIXED" });
  }

  function applyConflictNoTime() {
    setConflictState(null);
    setTimeMode("NONE");
    setStartTime("");
    setOneOffTime("");
    setTimeSlots([]);
    handleSave({ overrideStartTime: "", overrideTimeMode: "NONE" });
  }

  function applyConflictReplace() {
    if (!conflictState?.conflicts?.length) return;
    const cancelOccurrenceIds = conflictState.conflicts
      .map((conflict) => conflict.occurrenceId)
      .filter((id) => typeof id === "string" && id.trim());
    setConflictState(null);
    handleSave({ conflictResolution: { cancelOccurrenceIds } });
  }

  function handleDelete() {
    if (!item?.id || typeof setData !== "function") return;
    const ok = safeConfirm("Supprimer cet élément ?");
    if (!ok) return;
    const goalId = item.id;
    setData((prev) => {
      const goal = (prev.goals || []).find((entry) => entry.id === goalId);
      const isOutcome = resolveGoalType(goal) === "OUTCOME";
      let nextGoals = (prev.goals || []).filter((entry) => entry.id !== goalId);
      if (isOutcome) {
        nextGoals = nextGoals.map((entry) =>
          entry && entry.parentId === goalId ? { ...entry, parentId: null, outcomeId: null } : entry
        );
      }
      const nextCategories = (prev.categories || []).map((category) =>
        category.mainGoalId === goalId ? { ...category, mainGoalId: null } : category
      );
      const nextUi = { ...(prev.ui || {}) };
      if (nextUi.sessionDraft?.objectiveId === goalId) nextUi.sessionDraft = null;
      if (nextUi.activeSession?.habitIds) {
        const kept = nextUi.activeSession.habitIds.filter((id) => nextGoals.some((goalEntry) => goalEntry.id === id));
        nextUi.activeSession = kept.length ? { ...nextUi.activeSession, habitIds: kept } : null;
      }
      if (resolveGoalType(goal) === "PROCESS") {
        const nextOccurrences = (prev.occurrences || []).filter((occurrence) => occurrence && occurrence.goalId !== goalId);
        const nextReminders = (prev.reminders || []).filter((reminder) => reminder && reminder.goalId !== goalId);
        const nextSessions = Array.isArray(prev.sessions)
          ? prev.sessions
              .map((session) => {
                if (!session || typeof session !== "object") return session;
                const habitIds = Array.isArray(session.habitIds) ? session.habitIds.filter((id) => id !== goalId) : [];
                const doneHabitIds = Array.isArray(session.doneHabitIds) ? session.doneHabitIds.filter((id) => id !== goalId) : [];
                return { ...session, habitIds, doneHabitIds };
              })
              .filter((session) => {
                if (!session || typeof session !== "object") return false;
                const hasHabits = Array.isArray(session.habitIds) && session.habitIds.length > 0;
                const hasDone = Array.isArray(session.doneHabitIds) && session.doneHabitIds.length > 0;
                return hasHabits || hasDone;
              })
          : prev.sessions;
        let nextChecks = prev.checks;
        if (nextChecks && typeof nextChecks === "object") {
          const cleaned = {};
          for (const [key, bucket] of Object.entries(nextChecks)) {
            const habits = Array.isArray(bucket?.habits) ? bucket.habits.filter((id) => id !== goalId) : [];
            const micro = bucket?.micro && typeof bucket.micro === "object" ? bucket.micro : {};
            if (habits.length || Object.keys(micro).length) cleaned[key] = { ...bucket, habits, micro };
          }
          nextChecks = cleaned;
        }
        const nextState = {
          ...prev,
          goals: nextGoals,
          categories: nextCategories,
          occurrences: nextOccurrences,
          reminders: nextReminders,
          sessions: nextSessions,
          checks: nextChecks,
          ui: nextUi,
        };
        return removeScheduleRulesForAction(nextState, goalId);
      }
      return { ...prev, goals: nextGoals, categories: nextCategories, ui: nextUi };
    });
    if (typeof onBack === "function") onBack();
  }

  const controller = {
    title,
    setTitle,
    priority,
    setPriority,
    repeat,
    setRepeat,
    timeMode,
    setTimeMode,
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    oneOffDate,
    setOneOffDate,
    oneOffTime,
    setOneOffTime,
    timeSlots,
    sessionMinutes,
    setSessionMinutes,
    daysOfWeek,
    toggleDay,
    windowStart,
    setWindowStart,
    windowEnd,
    setWindowEnd,
    remindersEnabled,
    setRemindersEnabled,
    reminderTimes,
    setReminderTimes,
    reminderChannel,
    setReminderChannel,
    updateReminderTime,
    addReminderTime,
    removeReminderTime,
    notes,
    setNotes,
    deadline,
    setDeadline,
    quantityValue,
    setQuantityValue,
    quantityUnit,
    setQuantityUnit,
    quantityPeriod,
    setQuantityPeriod,
    measureType,
    setMeasureType,
    targetValue,
    setTargetValue,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedOutcomeId,
    setSelectedOutcomeId,
    effectiveSelectedOutcomeId,
    selectedSuggestion,
    activateSuggestedCategory,
    categoryOptions,
    outcomes,
    minDeadlineKey,
    hasMultipleSlots,
    canUseReminders,
    showFixedTimeHint,
    error,
    handleSave,
    handleDelete,
    onBack,
    handleRecurringTimeModeChange,
    handleOneOffTimeModeChange,
    handleOutcomeStartDateChange,
    handleDeadlineChange,
  };

  if (!item) {
    return (
      <AppScreen
        pageId="edit-item"
        headerTitle={<span className="textAccent">Modifier</span>}
        headerSubtitle="Élément introuvable"
        headerRight={
          <GhostButton className="btnBackCompact backBtn" onClick={onBack}>
            Retour
          </GhostButton>
        }
        backgroundImage={backgroundImage}
      >
        <div className="mainPageStack editItemPageShell">
          <AppCard variant="elevated">
            <div className="editItemMissingText">Impossible de retrouver cet élément.</div>
          </AppCard>
        </div>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      pageId="edit-item"
      headerTitle={<span className="textAccent">Modifier</span>}
      headerSubtitle={item.title || (isProcess ? LABELS.action : LABELS.goal)}
      headerRight={
        <GhostButton className="btnBackCompact backBtn" onClick={onBack}>
          Retour
        </GhostButton>
      }
      headerRowAlign="start"
      backgroundImage={backgroundImage}
    >
      <div className="mainPageStack editItemPageShell editItemScope">
        {isProcess ? <ActionEditScreen controller={controller} /> : <OutcomeEditScreen controller={controller} />}
      </div>

      <ConflictResolver
        open={Boolean(conflictState)}
        onClose={() => setConflictState(null)}
        candidateLabel={conflictState?.label}
        conflicts={conflictState?.conflicts || []}
        suggestions={conflictState?.suggestions || []}
        onReplace={applyConflictReplace}
        onShift={applyConflictShift}
        onUnset={applyConflictNoTime}
      />
    </AppScreen>
  );
}
