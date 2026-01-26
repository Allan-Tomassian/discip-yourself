import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { AccentItem, Button, Card, Input, Select, Textarea } from "../components/UI";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";
import { resolveGoalType } from "../domain/goalType";
import { uid } from "../utils/helpers";
import { createGoal } from "../logic/goals";
import { setPrimaryGoalForCategory } from "../logic/priority";
import { ensureWindowForGoals } from "../logic/occurrencePlanner";
import { fromLocalDateKey, normalizeLocalDateKey, todayLocalKey, toLocalDateKey } from "../utils/dateKey";
import { createDefaultGoalSchedule, ensureSystemInboxCategory, normalizeCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import { canCreateCategory } from "../logic/entitlements";
import { normalizeReminder } from "../logic/reminders";

// App convention: 1 = Monday ... 7 = Sunday
const DOWS = [
  { id: 1, label: "L" },
  { id: 2, label: "M" },
  { id: 3, label: "M" },
  { id: 4, label: "J" },
  { id: 5, label: "V" },
  { id: 6, label: "S" },
  { id: 7, label: "D" },
];

const QUANTITY_PERIODS = [
  { id: "DAY", label: "par jour" },
  { id: "WEEK", label: "par semaine" },
  { id: "MONTH", label: "par mois" },
];

function appDowFromDate(d) {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function normalizeStartTime(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^\d{2}:\d{2}$/.test(raw) ? raw : "";
}

function normalizeDurationMinutes(value) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw);
}

function normalizeQuantityValue(value) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100) / 100;
}

function normalizeQuantityUnit(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw;
}

function normalizeQuantityPeriod(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return QUANTITY_PERIODS.some((p) => p.id === raw) ? raw : "DAY";
}

function formatQuantityLabel(habit) {
  if (!habit || !Number.isFinite(habit.quantityValue)) return "";
  const unit = habit.quantityUnit || "";
  const period = QUANTITY_PERIODS.find((p) => p.id === habit.quantityPeriod)?.label || "";
  if (!unit || !period) return "";
  return `${habit.quantityValue} ${unit} ${period}`;
}

function normalizeDaysOfWeek(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const v of value) {
    const n = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(n)) continue;
    const id = Math.trunc(n);
    if (id < 1 || id > 7 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function formatRepeatLabel(habit) {
  if (!habit) return "Une fois";
  const repeat = habit.repeat || "none";
  if (repeat === "daily") return "Quotidien";
  if (repeat === "weekly") {
    const days = Array.isArray(habit.daysOfWeek) ? habit.daysOfWeek : [];
    const labels = days
      .map((id) => DOWS.find((d) => d.id === id)?.label)
      .filter(Boolean)
      .join(" ");
    return labels ? `Hebdo · ${labels}` : "Hebdo";
  }
  const dateLabel = habit.oneOffDate ? ` · ${habit.oneOffDate}` : "";
  return `Une fois${dateLabel}`;
}

export default function CreateV2Habits({
  data,
  setData,
  onBack,
  onDone,
  onCancel,
  canCreateAction = true,
  onOpenPaywall,
  isPremiumPlan = false,
  planLimits = null,
  generationWindowDays = null,
  onOpenCategories,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const [title, setTitle] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    const draftId = draft?.category?.mode === "existing" ? draft.category.id : "";
    const sys = categories.find((c) => c?.id === SYSTEM_INBOX_ID) || null;
    if (draftId && categories.some((c) => c.id === draftId)) return draftId;
    if (sys?.id) return sys.id;
    return categories[0]?.id || SYSTEM_INBOX_ID;
  });
  const [oneOffDate, setOneOffDate] = useState(() => todayLocalKey());
  const [repeat, setRepeat] = useState("none");
  const [daysOfWeek, setDaysOfWeek] = useState(() => [appDowFromDate(new Date())]);
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [quantityValue, setQuantityValue] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const [quantityPeriod, setQuantityPeriod] = useState("DAY");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderWindowStart, setReminderWindowStart] = useState("");
  const [reminderWindowEnd, setReminderWindowEnd] = useState("");
  const [memo, setMemo] = useState("");
  const [linkToObjective, setLinkToObjective] = useState(() =>
    Boolean(draft.activeOutcomeId || draft.outcomes?.length)
  );
  const [error, setError] = useState("");

  const habits = Array.isArray(draft.habits) ? draft.habits : [];
  const outcomes = Array.isArray(draft.outcomes) ? draft.outcomes : [];
  const activeOutcomeId = draft.activeOutcomeId || outcomes[0]?.id || "";
  const availableOutcomes = useMemo(
    () => goals.filter((g) => g && resolveGoalType(g) === "OUTCOME"),
    [goals]
  );
  const hasAvailableOutcomes = availableOutcomes.length > 0;
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(() =>
    activeOutcomeId || availableOutcomes[0]?.id || ""
  );
  const [postActionPrompt, setPostActionPrompt] = useState(null);
  const [postObjectiveTitle, setPostObjectiveTitle] = useState("");
  const [postSelectedOutcomeId, setPostSelectedOutcomeId] = useState("");
  const hasOutcome = Boolean(selectedOutcomeId);
  const categoryId = selectedCategoryId || SYSTEM_INBOX_ID;
  const category = categoryId ? (safeData.categories || []).find((c) => c.id === categoryId) : null;
  const existingActionCount = useMemo(
    () => goals.filter((g) => resolveGoalType(g) === "PROCESS").length,
    [goals]
  );
  const isWeekly = repeat === "weekly";
  const missingWeeklyDays = isWeekly && daysOfWeek.length === 0;
  const oneOffDateValid = repeat !== "none" || Boolean(normalizeLocalDateKey(oneOffDate));
  const quantityValueParsed = normalizeQuantityValue(quantityValue);
  const quantityUnitClean = normalizeQuantityUnit(quantityUnit);
  const quantityValid =
    !String(quantityValue || "").trim() || (Number.isFinite(quantityValueParsed) && quantityUnitClean);
  const normalizedReminderTime = normalizeStartTime(reminderTime);
  const normalizedReminderWindowStart = normalizeStartTime(reminderWindowStart);
  const normalizedReminderWindowEnd = normalizeStartTime(reminderWindowEnd);
  const reminderWindowProvided = Boolean(normalizedReminderWindowStart || normalizedReminderWindowEnd);
  const reminderValid = !reminderWindowProvided || Boolean(normalizedReminderTime);
  const canAddHabit = Boolean(title.trim()) && !missingWeeklyDays && oneOffDateValid && quantityValid && reminderValid;
  const hasInvalidHabits = habits.some(
    (habit) =>
      habit &&
      ((habit.repeat === "weekly" && (!habit.daysOfWeek || habit.daysOfWeek.length === 0)) ||
        (habit.repeat === "none" && !normalizeLocalDateKey(habit.oneOffDate)) ||
        (habit.quantityValue && !habit.quantityUnit))
  );
  const suggestedCategories = useMemo(() => {
    const existingNames = new Set(categories.map((c) => String(c?.name || "").trim().toLowerCase()).filter(Boolean));
    const existingIds = new Set(categories.map((c) => c?.id).filter(Boolean));
    return SUGGESTED_CATEGORIES.filter(
      (cat) =>
        cat &&
        !existingIds.has(cat.id) &&
        !existingNames.has(String(cat.name || "").trim().toLowerCase())
    );
  }, [categories]);
  const categoryOptions = useMemo(() => {
    const sys = categories.find((c) => c?.id === SYSTEM_INBOX_ID) || null;
    const rest = categories.filter((c) => c?.id !== SYSTEM_INBOX_ID);
    rest.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    const options = [];
    if (sys) options.push({ id: sys.id, name: sys.name || "Général", color: sys.color });
    for (const c of rest) options.push({ id: c.id, name: c.name || "Catégorie", color: c.color });
    for (const s of suggestedCategories) options.push({ id: s.id, name: s.name, color: s.color, suggested: true });
    if (!options.length) options.push({ id: SYSTEM_INBOX_ID, name: "Général" });
    return options;
  }, [categories, suggestedCategories]);

  useEffect(() => {
    if (hasOutcome && error) setError("");
  }, [hasOutcome, error]);

  useEffect(() => {
    if (!selectedOutcomeId && hasAvailableOutcomes && linkToObjective) {
      setSelectedOutcomeId(availableOutcomes[0].id);
    }
  }, [availableOutcomes, hasAvailableOutcomes, linkToObjective, selectedOutcomeId]);

  useEffect(() => {
    if (!hasAvailableOutcomes && linkToObjective) {
      setLinkToObjective(false);
      setSelectedOutcomeId("");
      syncActiveOutcome("");
    }
  }, [hasAvailableOutcomes, linkToObjective]);

  useEffect(() => {
    if (!postActionPrompt) return;
    if (!postSelectedOutcomeId && availableOutcomes.length) {
      setPostSelectedOutcomeId(availableOutcomes[0].id);
    }
  }, [availableOutcomes, postActionPrompt, postSelectedOutcomeId]);

  useEffect(() => {
    if (repeat !== "none") return;
    if (normalizeLocalDateKey(oneOffDate)) return;
    setOneOffDate(todayLocalKey());
  }, [repeat, oneOffDate]);

  useEffect(() => {
    if (!categories.length) {
      if (selectedCategoryId !== SYSTEM_INBOX_ID) setSelectedCategoryId(SYSTEM_INBOX_ID);
      return;
    }
    const exists = categories.some((c) => c?.id === selectedCategoryId);
    if (exists) return;
    const sys = categories.find((c) => c?.id === SYSTEM_INBOX_ID) || null;
    setSelectedCategoryId(sys?.id || categories[0]?.id || SYSTEM_INBOX_ID);
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    syncCategory(selectedCategoryId);
  }, [selectedCategoryId]);

  function updateDraft(nextHabits) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            habits: nextHabits,
            activeOutcomeId: selectedOutcomeId || null,
            step: STEP_HABITS,
          },
        },
      };
    });
  }

  function syncActiveOutcome(nextId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            activeOutcomeId: nextId || null,
            step: STEP_HABITS,
          },
        },
      };
    });
  }

  function syncCategory(nextId) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            category: nextId ? { mode: "existing", id: nextId } : null,
            step: STEP_HABITS,
          },
        },
      };
    });
  }

  function ensureSuggestedCategory(cat) {
    if (!cat || typeof setData !== "function") return;
    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      if (prevCategories.some((c) => c?.id === cat.id)) return prev;
      if (prevCategories.some((c) => String(c?.name || "").trim().toLowerCase() === String(cat.name || "").trim().toLowerCase())) {
        return prev;
      }
      const created = normalizeCategory({ id: cat.id, name: cat.name, color: cat.color }, prevCategories.length);
      return { ...prev, categories: [...prevCategories, created] };
    });
  }

  function addHabit() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    if (missingWeeklyDays) return;
    if (!oneOffDateValid) {
      setError("Sélectionne une date pour l’action \"Une fois\".");
      return;
    }
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
    const normalizedQuantityPeriod = normalizeQuantityPeriod(quantityPeriod);
    const normalizedReminderTime = normalizeStartTime(reminderTime);
    const normalizedWindowStart = normalizeStartTime(reminderWindowStart);
    const normalizedWindowEnd = normalizeStartTime(reminderWindowEnd);
    if ((normalizedWindowStart || normalizedWindowEnd) && !normalizedReminderTime) {
      setError("Choisis une heure de rappel.");
      return;
    }
    const limit = Number(planLimits?.actions) || 0;
    if (!isPremiumPlan && limit > 0 && existingActionCount + habits.length >= limit) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’actions atteinte.");
      return;
    }
    if (!canCreateAction) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite d’actions atteinte.");
      return;
    }
    const outcomeId = linkToObjective && selectedOutcomeId ? selectedOutcomeId : null;
    const normalizedDays = isWeekly ? normalizeDaysOfWeek(daysOfWeek) : [];
    const normalizedStart = normalizeStartTime(startTime);
    const normalizedDuration = normalizeDurationMinutes(durationMinutes);
    const normalizedOneOff = normalizeLocalDateKey(oneOffDate) || todayLocalKey();
    const normalizedMemo = typeof memo === "string" ? memo.trim() : "";
    const nextHabits = [
      ...habits,
      {
        id: uid(),
        title: "" + cleanTitle,
        outcomeId,
        repeat,
        daysOfWeek: normalizedDays,
        startTime: normalizedStart,
        durationMinutes: normalizedDuration,
        oneOffDate: repeat === "none" ? normalizedOneOff : "",
        quantityValue: normalizedQuantityValue,
        quantityUnit: normalizedQuantityValue ? normalizedQuantityUnit : "",
        quantityPeriod: normalizedQuantityValue ? normalizedQuantityPeriod : "",
        reminderTime: normalizedReminderTime,
        reminderWindowStart: normalizedWindowStart,
        reminderWindowEnd: normalizedWindowEnd,
        memo: normalizedMemo,
      },
    ];
    updateDraft(nextHabits);
    setTitle("");
    setQuantityValue("");
    setQuantityUnit("");
    setQuantityPeriod("DAY");
    setReminderTime("");
    setReminderWindowStart("");
    setReminderWindowEnd("");
    setMemo("");
  }

  function removeHabit(id) {
    const nextHabits = habits.filter((h) => h.id !== id);
    updateDraft(nextHabits);
  }

  function handleCategoryChange(nextId) {
    const value = nextId || "";
    const suggested = suggestedCategories.find((cat) => cat.id === value) || null;
    if (suggested && !canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite de catégories atteinte.");
      return;
    }
    if (suggested) ensureSuggestedCategory(suggested);
    if (value === SYSTEM_INBOX_ID && typeof setData === "function") {
      setData((prev) => ensureSystemInboxCategory(prev).state);
    }
    setSelectedCategoryId(value);
    syncCategory(value);
  }

  function toggleHabitLink(habitId, shouldLink) {
    const nextHabits = habits.map((habit) => {
      if (habit.id !== habitId) return habit;
      if (shouldLink && selectedOutcomeId) return { ...habit, outcomeId: selectedOutcomeId };
      return { ...habit, outcomeId: null };
    });
    updateDraft(nextHabits);
  }

  function handleDone() {
    if (!habits.length) return;
    if (linkToObjective && !selectedOutcomeId) {
      setError("Choisis un objectif ou désactive le lien.");
      return;
    }
    if (hasOutcome && !outcomes[0] && !selectedOutcomeId) {
      setError("Complète l’objectif avant de terminer.");
      return;
    }
    if (typeof setData !== "function") return;
    if (!oneOffDateValid) {
      setError("Sélectionne une date pour l’action \"Une fois\".");
      return;
    }
    if (!categories.some((c) => c?.id === categoryId) && !canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite de catégories atteinte.");
      return;
    }
    const linkedOutcomeId = linkToObjective && selectedOutcomeId ? selectedOutcomeId : null;
    const validHabits = habits.filter(
      (habit) =>
        habit &&
        habit.title &&
        !(habit.repeat === "weekly" && (!habit.daysOfWeek || habit.daysOfWeek.length === 0))
    );
    const createdProcessIds = validHabits.map(() => uid());
    setData((prev) => {
      let next = prev;
      const existingCategories = Array.isArray(next.categories) ? next.categories : [];
      const hasCategory = existingCategories.some((c) => c?.id === categoryId);
      if (!hasCategory) {
        if (categoryId === SYSTEM_INBOX_ID) {
          next = ensureSystemInboxCategory(next).state;
        } else {
          const suggested = SUGGESTED_CATEGORIES.find((cat) => cat.id === categoryId) || null;
          if (suggested) {
            const created = normalizeCategory(
              { id: suggested.id, name: suggested.name, color: suggested.color },
              existingCategories.length
            );
            next = { ...next, categories: [...existingCategories, created] };
          }
        }
      }
      const objective = outcomes[0] || null;
      const outcomeId = objective ? uid() : null;
      const createdReminders = [];

      if (objective && outcomeId) {
        next = createGoal(next, {
          id: outcomeId,
          categoryId,
          title: objective.title || "Objectif",
          type: "OUTCOME",
          planType: "STATE",
          deadline: objective.deadline || "",
          priority: objective.priority || "secondaire",
        });
        if (objective.priority === "prioritaire") {
          next = setPrimaryGoalForCategory(next, categoryId, outcomeId);
        }
      }

      const baseSchedule = createDefaultGoalSchedule();
      let finalState = next;
      for (let index = 0; index < validHabits.length; index += 1) {
        const habit = validHabits[index];
        const habitId = createdProcessIds[index];
        const normalizedStart = normalizeStartTime(habit.startTime);
        const normalizedReminderTime = normalizeStartTime(habit.reminderTime);
        const normalizedWindowStart = normalizeStartTime(habit.reminderWindowStart);
        const normalizedWindowEnd = normalizeStartTime(habit.reminderWindowEnd);
        const occurrenceStart = normalizedStart || normalizedReminderTime || "00:00";
        const normalizedDuration = normalizeDurationMinutes(habit.durationMinutes);
        const normalizedDays = normalizeDaysOfWeek(habit.daysOfWeek);
        const repeatMode = habit.repeat || "none";
        const isWeeklyRepeat = repeatMode === "weekly";
        const isDailyRepeat = repeatMode === "daily";
        const isOneOff = repeatMode === "none";
        const reminderEnabled = Boolean(normalizedReminderTime);
        const schedule = isOneOff
          ? null
          : {
              ...baseSchedule,
              daysOfWeek: isWeeklyRepeat ? normalizedDays : [],
              timeSlots: [occurrenceStart],
              durationMinutes: normalizedDuration,
              windowStart: normalizedWindowStart || "",
              windowEnd: normalizedWindowEnd || "",
              remindersEnabled: reminderEnabled,
            };
        const normalizedOneOff = normalizeLocalDateKey(habit.oneOffDate) || todayLocalKey();
        const oneOffDate = isOneOff ? normalizedOneOff : undefined;
        const startAt = isOneOff ? `${oneOffDate}T${occurrenceStart}` : null;
        const normalizedQuantityValue = normalizeQuantityValue(habit.quantityValue);
        const normalizedQuantityUnit = normalizeQuantityUnit(habit.quantityUnit);
        const normalizedQuantityPeriod = normalizeQuantityPeriod(habit.quantityPeriod);
        const normalizedMemo = typeof habit.memo === "string" ? habit.memo.trim() : "";
        finalState = createGoal(finalState, {
          id: habitId,
          categoryId,
          title: habit.title,
          type: "PROCESS",
          planType: isOneOff ? "ONE_OFF" : "ACTION",
          parentId: habit.outcomeId && (outcomeId || selectedOutcomeId)
            ? outcomeId || selectedOutcomeId
            : null,
          cadence: isOneOff ? undefined : isDailyRepeat ? "DAILY" : "WEEKLY",
          target: isOneOff ? undefined : 1,
          freqCount: isOneOff ? undefined : 1,
          freqUnit: isOneOff ? undefined : isDailyRepeat ? "DAY" : "WEEK",
          weight: 100,
          sessionMinutes: normalizedDuration,
          schedule,
          oneOffDate,
          startAt,
          repeat: repeatMode,
          daysOfWeek: normalizedDays,
          startTime: normalizedStart,
          durationMinutes: normalizedDuration,
          quantityValue: normalizedQuantityValue,
          quantityUnit: normalizedQuantityValue ? normalizedQuantityUnit : "",
          quantityPeriod: normalizedQuantityValue ? normalizedQuantityPeriod : "",
          reminderTime: normalizedReminderTime,
          reminderWindowStart: normalizedWindowStart,
          reminderWindowEnd: normalizedWindowEnd,
          habitNotes: normalizedMemo,
        });
        if (reminderEnabled) {
          createdReminders.push(
            normalizeReminder(
              {
                goalId: habitId,
                time: normalizedReminderTime,
                enabled: true,
                channel: "IN_APP",
                label: habit.title || "Rappel",
              },
              createdReminders.length
            )
          );
        }
        if (isOneOff && oneOffDate) {
          finalState = ensureWindowForGoals(finalState, [habitId], oneOffDate, 1);
        }
      }

      if (createdProcessIds.length) {
        const days =
          Number.isFinite(generationWindowDays) && generationWindowDays > 0
            ? Math.floor(generationWindowDays)
            : isPremiumPlan
              ? 90
              : 7;
        finalState = ensureWindowForGoals(finalState, createdProcessIds, todayLocalKey(), days);
      }

      if (createdReminders.length) {
        const existingReminders = Array.isArray(finalState.reminders) ? finalState.reminders : [];
        const filtered = existingReminders.filter((r) => !createdProcessIds.includes(r?.goalId));
        finalState = { ...finalState, reminders: [...filtered, ...createdReminders] };
      }

      return {
        ...finalState,
        ui: { ...(finalState.ui || {}), createDraft: createEmptyDraft(), createDraftWasCompleted: true },
      };
    });
    if (!linkedOutcomeId && createdProcessIds.length) {
      const suggestedTitle = String(validHabits[0]?.title || title || "").trim();
      setPostActionPrompt({ createdProcessIds, categoryId: categoryId || SYSTEM_INBOX_ID });
      setPostObjectiveTitle(suggestedTitle);
      setPostSelectedOutcomeId(availableOutcomes[0]?.id || "");
      return;
    }
    if (typeof onDone === "function") onDone();
  }

  function handleSkipObjective() {
    setPostActionPrompt(null);
    if (typeof onDone === "function") onDone();
  }

  function linkToExistingObjective() {
    if (!postActionPrompt?.createdProcessIds?.length || !postSelectedOutcomeId) return;
    if (typeof setData !== "function") return;
    const linkId = postSelectedOutcomeId;
    setData((prev) => {
      const goalsList = Array.isArray(prev.goals) ? prev.goals : [];
      const updated = goalsList.map((goal) =>
        postActionPrompt.createdProcessIds.includes(goal.id)
          ? { ...goal, parentId: linkId, outcomeId: linkId }
          : goal
      );
      return { ...prev, goals: updated };
    });
    setPostActionPrompt(null);
    if (typeof onDone === "function") onDone();
  }

  function createObjectiveAndLink() {
    if (!postActionPrompt?.createdProcessIds?.length) return;
    const cleanTitle = String(postObjectiveTitle || "").trim();
    if (!cleanTitle) return;
    if (typeof setData !== "function") return;
    const startKey = todayLocalKey();
    const deadlineDate = fromLocalDateKey(startKey);
    deadlineDate.setDate(deadlineDate.getDate() + 7);
    const deadlineKey = toLocalDateKey(deadlineDate);
    const outcomeId = uid();
    const targetCategoryId = postActionPrompt.categoryId || SYSTEM_INBOX_ID;
    setData((prev) => {
      let next = prev;
      if (targetCategoryId === SYSTEM_INBOX_ID) {
        next = ensureSystemInboxCategory(next).state;
      }
      next = createGoal(next, {
        id: outcomeId,
        categoryId: targetCategoryId,
        title: cleanTitle,
        type: "OUTCOME",
        planType: "STATE",
        startDate: startKey,
        deadline: deadlineKey,
        priority: "secondaire",
      });
      const goalsList = Array.isArray(next.goals) ? next.goals : [];
      const updated = goalsList.map((goal) =>
        postActionPrompt.createdProcessIds.includes(goal.id)
          ? { ...goal, parentId: outcomeId, outcomeId }
          : goal
      );
      return { ...next, goals: updated };
    });
    setPostActionPrompt(null);
    if (typeof onDone === "function") onDone();
  }

  function getOutcomeLabel(id) {
    return (
      outcomes.find((o) => o.id === id)?.title ||
      goals.find((g) => g.id === id)?.title ||
      "Objectif"
    );
  }

  const outcomeLabel = hasOutcome ? getOutcomeLabel(selectedOutcomeId) : "Sans objectif";
  const objectiveColor = category?.color || "#64748B";

  if (postActionPrompt) {
    const hasOutcomes = availableOutcomes.length > 0;
    return (
      <ScreenShell
        data={safeData}
        pageId="categories"
        headerTitle="Créer"
        headerSubtitle={
          <>
            <span className="textMuted2">2.</span> Objectif
          </>
        }
        backgroundImage={backgroundImage}
      >
        <div className="stack stackGap12">
          <Card accentBorder>
            <div className="p18 col gap12">
              <div className="small2">Action créée.</div>
              <div className="stack stackGap8">
                <div className="small textMuted">Lier à un objectif existant</div>
                <Select
                  value={postSelectedOutcomeId}
                  onChange={(e) => setPostSelectedOutcomeId(e.target.value)}
                  disabled={!hasOutcomes}
                >
                  <option value="">Sans objectif</option>
                  {availableOutcomes.map((outcome) => (
                    <option key={outcome.id} value={outcome.id}>
                      {outcome.title || "Objectif"}
                    </option>
                  ))}
                </Select>
                <Button onClick={linkToExistingObjective} disabled={!hasOutcomes || !postSelectedOutcomeId}>
                  Lier à cet objectif
                </Button>
              </div>
              <div className="stack stackGap8">
                <div className="small textMuted">Créer un objectif maintenant</div>
                <Input
                  value={postObjectiveTitle}
                  onChange={(e) => setPostObjectiveTitle(e.target.value)}
                  placeholder="Nom de l’objectif"
                />
                <div className="small2 textMuted2">Durée minimale 7 jours (fin auto J+7).</div>
                <Button onClick={createObjectiveAndLink} disabled={!postObjectiveTitle.trim()}>
                  Créer l’objectif
                </Button>
              </div>
              <button type="button" className="linkBtn" onClick={handleSkipObjective}>
                Plus tard
              </button>
            </div>
          </Card>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">2.</span> Actions · {outcomeLabel}
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col gap12">
            <div className="row gap8">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nouvelle action"
              />
              <Button onClick={addHabit} disabled={!canAddHabit}>
                Ajouter
              </Button>
            </div>
            <div className="stack stackGap8">
              <div className="row rowBetween alignCenter">
                <div className="small textMuted">Catégorie</div>
                {typeof onOpenCategories === "function" ? (
                  <button type="button" className="linkBtn" onClick={onOpenCategories}>
                    Voir toutes
                  </button>
                ) : null}
              </div>
              <Select value={selectedCategoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                    {option.suggested ? " (suggestion)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="stack stackGap8">
              <div className="small textMuted">Mode</div>
              <div className="row gap8">
                <Select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
                  <option value="none">Une fois</option>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdo</option>
                </Select>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="Heure"
                />
                  <Input
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="Durée (min)"
                  />
                </div>
              {repeat === "none" ? (
                <div className="stack stackGap6">
                  <div className="small2 textMuted">Date</div>
                  <Input
                    type="date"
                    value={oneOffDate}
                    onChange={(e) => {
                      setOneOffDate(e.target.value);
                      if (error) setError("");
                    }}
                  />
                </div>
              ) : null}
              {repeat === "weekly" ? (
                <div className="editDaysRow">
                  {DOWS.map((day) => {
                    const active = daysOfWeek.includes(day.id);
                    return (
                      <label key={day.id} className="editDayOption">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() =>
                            setDaysOfWeek((prev) => {
                              const next = prev.includes(day.id)
                                ? prev.filter((d) => d !== day.id)
                                : [...prev, day.id].sort();
                              return next;
                            })
                          }
                        />
                        {day.label}
                      </label>
                    );
                  })}
                </div>
              ) : null}
              {missingWeeklyDays ? (
                <div className="small2 textAccent">Choisis au moins un jour.</div>
              ) : null}
            </div>
            <div className="stack stackGap8">
              <div className="small textMuted">Quantification (optionnel)</div>
              <div className="row gap8">
                <Input
                  type="number"
                  min="1"
                  value={quantityValue}
                  onChange={(e) => setQuantityValue(e.target.value)}
                  placeholder="Quantité"
                />
                <Input
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  placeholder="Unité"
                />
                <Select value={quantityPeriod} onChange={(e) => setQuantityPeriod(e.target.value)}>
                  {QUANTITY_PERIODS.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label}
                    </option>
                  ))}
                </Select>
              </div>
              {!quantityValid && String(quantityValue || "").trim() ? (
                <div className="small2 textAccent">Ajoute une unité pour la quantité.</div>
              ) : null}
            </div>
            <div className="stack stackGap8">
              <div className="small textMuted">Rappel (optionnel)</div>
              <div className="row gap8">
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  placeholder="Heure"
                />
                <Input
                  type="time"
                  value={reminderWindowStart}
                  onChange={(e) => setReminderWindowStart(e.target.value)}
                  placeholder="Fenêtre début"
                />
                <Input
                  type="time"
                  value={reminderWindowEnd}
                  onChange={(e) => setReminderWindowEnd(e.target.value)}
                  placeholder="Fenêtre fin"
                />
              </div>
              {!reminderValid && reminderWindowProvided ? (
                <div className="small2 textAccent">Définis une heure de rappel.</div>
              ) : null}
            </div>
            <div className="stack stackGap8">
              <div className="small textMuted">Mémo (optionnel)</div>
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note personnelle" />
            </div>
            <div className="stack stackGap8">
              <label className="includeToggle">
                <input
                  type="checkbox"
                  checked={linkToObjective}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setLinkToObjective(next);
                    if (!next) setSelectedOutcomeId("");
                    if (next && !selectedOutcomeId && hasAvailableOutcomes) {
                      setSelectedOutcomeId(availableOutcomes[0].id);
                    }
                    syncActiveOutcome(next ? selectedOutcomeId || availableOutcomes[0]?.id || "" : "");
                  }}
                  disabled={!hasAvailableOutcomes}
                />
                <span>Liée à un objectif</span>
              </label>
              <Select
                value={selectedOutcomeId}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setSelectedOutcomeId(nextValue);
                  syncActiveOutcome(nextValue);
                }}
                disabled={!linkToObjective || !hasAvailableOutcomes}
              >
                <option value="">Sans objectif</option>
                {availableOutcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title || "Objectif"}
                  </option>
                ))}
              </Select>
            </div>
            <div className="stack stackGap8">
              {habits.map((habit) => (
                <AccentItem
                  key={habit.id}
                  color={habit.outcomeId ? objectiveColor : null}
                  tone={habit.outcomeId ? "accent" : "neutral"}
                >
                  <div className="row rowBetween gap10 wFull">
                    <div className="small2 flex1">
                      {habit.title}
                      {habit.outcomeId ? (
                        <span className="textMuted2">
                          {" "}
                          · {getOutcomeLabel(habit.outcomeId)}
                        </span>
                      ) : null}
                      <div className="textMuted2">
                        {formatRepeatLabel(habit)}
                        {habit.startTime ? ` · ${habit.startTime}` : ""}
                        {Number.isFinite(habit.durationMinutes) ? ` · ${habit.durationMinutes} min` : ""}
                        {formatQuantityLabel(habit) ? ` · ${formatQuantityLabel(habit)}` : ""}
                        {habit.reminderTime ? ` · Rappel ${habit.reminderTime}` : ""}
                        {habit.memo ? " · Mémo" : ""}
                      </div>
                    </div>
                    <label className="includeToggle">
                      <input
                        type="checkbox"
                        checked={Boolean(habit.outcomeId)}
                        onChange={(e) => toggleHabitLink(habit.id, e.target.checked)}
                        disabled={!hasAvailableOutcomes}
                      />
                      <span>Liée</span>
                    </label>
                    <Button variant="ghost" onClick={() => removeHabit(habit.id)}>
                      Retirer
                    </Button>
                  </div>
                </AccentItem>
              ))}
              {!habits.length ? <div className="small2">Ajoute au moins une action.</div> : null}
              {hasInvalidHabits ? (
                <div className="small2 textAccent">Corrige les actions hebdo sans jour sélectionné.</div>
              ) : null}
              {error ? <div className="small2 textAccent">{error}</div> : null}
            </div>
            <div className="row rowEnd gap10">
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof onCancel === "function") {
                    onCancel();
                    return;
                  }
                  if (typeof onBack === "function") onBack();
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleDone} disabled={!habits.length || hasInvalidHabits}>
                Terminer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
