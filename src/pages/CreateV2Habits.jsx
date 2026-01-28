import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { AccentItem, Button, Card, Input, Select, Textarea } from "../components/UI";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS, STEP_LINK_OUTCOME, STEP_PICK_CATEGORY } from "../creation/creationSchema";
import { uid } from "../utils/helpers";
import { createGoal } from "../logic/goals";
import { ensureWindowForGoals } from "../logic/occurrencePlanner";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { createDefaultGoalSchedule, ensureSystemInboxCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { normalizeReminder } from "../logic/reminders";
import { normalizeTimeFields } from "../logic/timeFields";
import { resolveGoalType } from "../domain/goalType";

// App convention: 1 = Monday ... 7 = Sunday
const DOWS = [
  { id: 1, label: "L" },
  { id: 2, label: "Ma" },
  { id: 3, label: "Me" },
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

function timeToMinutes(hhmm) {
  const raw = typeof hhmm === "string" ? hhmm.trim() : "";
  if (!/^\d{2}:\d{2}$/.test(raw)) return null;
  const [h, m] = raw.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function normalizeSlot(slot) {
  const start = normalizeStartTime(slot?.start);
  const end = normalizeStartTime(slot?.end);
  return { start, end };
}

function normalizeWeeklySlotsByDay(value) {
  const out = {};
  for (let day = 1; day <= 7; day += 1) out[day] = [];
  if (!value || typeof value !== "object") return out;
  for (let day = 1; day <= 7; day += 1) {
    const raw = value[day] || value[String(day)];
    if (!Array.isArray(raw)) continue;
    const slots = [];
    for (const s of raw) {
      const slot = normalizeSlot(s);
      if (!slot.start && !slot.end) continue;
      slots.push(slot);
    }
    out[day] = slots;
  }
  return out;
}

function validateWeeklySlotsByDay(daysOfWeek, weeklySlotsByDay) {
  const days = normalizeDaysOfWeek(daysOfWeek);
  const map = normalizeWeeklySlotsByDay(weeklySlotsByDay);
  // Each selected day must have at least one slot with a start.
  for (const d of days) {
    const slots = Array.isArray(map[d]) ? map[d] : [];
    const hasValidStart = slots.some((s) => Boolean(normalizeStartTime(s?.start)));
    if (!hasValidStart) return false;
    // If end is provided, it must be after start.
    for (const s of slots) {
      const start = normalizeStartTime(s?.start);
      const end = normalizeStartTime(s?.end);
      if (!start || !end) continue;
      const a = timeToMinutes(start);
      const b = timeToMinutes(end);
      if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return false;
    }
  }
  return true;
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

function formatWeeklySlotsSummary(habit) {
  if (!habit || habit.scheduleMode !== "WEEKLY_SLOTS") return "";
  const map = normalizeWeeklySlotsByDay(habit.weeklySlotsByDay);
  const days = normalizeDaysOfWeek(habit.daysOfWeek);
  if (!days.length) return "Créneaux";
  const parts = [];
  for (const d of days) {
    const label = DOWS.find((x) => x.id === d)?.label || String(d);
    const slots = Array.isArray(map[d]) ? map[d] : [];
    const count = slots.filter((s) => Boolean(normalizeStartTime(s?.start))).length;
    parts.push(`${label}(${count || 0})`);
  }
  return parts.length ? `Créneaux · ${parts.join(" ")}` : "Créneaux";
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
  onNext,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  // Category UI/state removed
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const [title, setTitle] = useState("");
  const [oneOffDate, setOneOffDate] = useState(() => todayLocalKey());
  // habitType gating
  const habitType = draft?.habitType || "RECURRING"; // ONE_OFF | RECURRING | ANYTIME
  const isTypeOneOff = habitType === "ONE_OFF";
  const isTypeAnytime = habitType === "ANYTIME";
  const isTypeRecurring = !isTypeOneOff && !isTypeAnytime;
  const [repeat, setRepeat] = useState(() => (isTypeOneOff ? "none" : "daily"));
  const [scheduleMode, setScheduleMode] = useState("STANDARD"); // STANDARD | WEEKLY_SLOTS
  const [weeklySlotsByDay, setWeeklySlotsByDay] = useState(() => {
    const base = {};
    for (let d = 1; d <= 7; d += 1) base[d] = [{ start: "", end: "" }];
    return base;
  });
  const [daysOfWeek, setDaysOfWeek] = useState(() => [appDowFromDate(new Date())]);
  const [timeMode, setTimeMode] = useState("NONE");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [quantityValue, setQuantityValue] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const [quantityPeriod, setQuantityPeriod] = useState("DAY");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderWindowStart, setReminderWindowStart] = useState("");
  const [reminderWindowEnd, setReminderWindowEnd] = useState("");
  const [memo, setMemo] = useState("");
  // Remove linkToObjective state and all outcome linking logic
  const [error, setError] = useState("");

  const habits = Array.isArray(draft.habits) ? draft.habits : [];
  // Remove all outcomes/objective linking state and category state
  const existingActionCount = useMemo(
    () => goals.filter((g) => resolveGoalType(g) === "PROCESS").length,
    [goals]
  );
  const isWeekly = repeat === "weekly";
  const missingWeeklyDays = isWeekly && daysOfWeek.length === 0;
  const isWeeklySlotsMode = isWeekly && !isTypeAnytime && scheduleMode === "WEEKLY_SLOTS";
  const weeklySlotsOk = !isWeeklySlotsMode || validateWeeklySlotsByDay(daysOfWeek, weeklySlotsByDay);
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
  const normalizedStartForCheck = normalizeStartTime(startTime);
  const requiresStartTime = timeMode === "FIXED";
  const startTimeValid = !requiresStartTime || Boolean(normalizedStartForCheck);
  const canAddHabit =
    Boolean(title.trim()) &&
    !missingWeeklyDays &&
    oneOffDateValid &&
    quantityValid &&
    reminderValid &&
    startTimeValid &&
    weeklySlotsOk;
  const hasInvalidHabits = habits.some((habit) => {
    if (!habit) return false;
    if (habit.repeat === "weekly" && (!habit.daysOfWeek || habit.daysOfWeek.length === 0)) return true;
    if (habit.repeat === "none" && !normalizeLocalDateKey(habit.oneOffDate)) return true;
    if (habit.quantityValue && !habit.quantityUnit) return true;
    if (habit.repeat === "weekly" && habit.scheduleMode === "WEEKLY_SLOTS") {
      return !validateWeeklySlotsByDay(habit.daysOfWeek, habit.weeklySlotsByDay);
    }
    return false;
  });

  // Remove all outcome and category sync effects

  useEffect(() => {
    if (repeat !== "none") return;
    if (normalizeLocalDateKey(oneOffDate)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOneOffDate(todayLocalKey());
  }, [repeat, oneOffDate]);

  // Enforce constraints when habitType changes
  useEffect(() => {
    if (isTypeOneOff) {
      setRepeat("none");
      setScheduleMode("STANDARD");
    }
    if (isTypeAnytime) {
      setTimeMode("NONE");
      setStartTime("");
      setScheduleMode("STANDARD");
    }
  }, [isTypeAnytime, isTypeOneOff]);

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
            step: STEP_HABITS,
          },
        },
      };
    });
  }

  function addHabit() {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    if (missingWeeklyDays) return;
    if (isWeeklySlotsMode && !weeklySlotsOk) {
      setError("Ajoute au moins un créneau valide (début/fin) pour chaque jour sélectionné.");
      return;
    }
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
    const outcomeId = draft?.activeOutcomeId ? String(draft.activeOutcomeId) : null;
    const normalizedDays = isWeekly ? normalizeDaysOfWeek(daysOfWeek) : [];
    const normalizedStart = normalizeStartTime(startTime);
    const normalizedDuration = normalizeDurationMinutes(durationMinutes);
    const normalizedOneOff = normalizeLocalDateKey(oneOffDate) || todayLocalKey();
    const normalizedMemo = typeof memo === "string" ? memo.trim() : "";
    const effectiveScheduleMode = isWeeklySlotsMode ? "WEEKLY_SLOTS" : "STANDARD";
    const normalizedWeeklySlots = effectiveScheduleMode === "WEEKLY_SLOTS" ? normalizeWeeklySlotsByDay(weeklySlotsByDay) : null;

    const timeFields = normalizeTimeFields({
      timeMode: effectiveScheduleMode === "WEEKLY_SLOTS" ? "NONE" : timeMode,
      timeSlots:
        effectiveScheduleMode === "WEEKLY_SLOTS"
          ? []
          : timeMode === "FIXED" && normalizedStart
            ? [normalizedStart]
            : [],
      startTime: effectiveScheduleMode === "WEEKLY_SLOTS" ? "" : normalizedStart,
      reminderTime: normalizedReminderTime,
    });
    const nextHabits = [
      ...habits,
      {
        id: uid(),
        title: "" + cleanTitle,
        outcomeId,
        repeat,
        daysOfWeek: normalizedDays,
        scheduleMode: effectiveScheduleMode,
        weeklySlotsByDay: normalizedWeeklySlots,
        timeMode: timeFields.timeMode,
        timeSlots: timeFields.timeSlots,
        startTime: timeFields.startTime,
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
    if (isWeeklySlotsMode) {
      setWeeklySlotsByDay(() => {
        const base = {};
        for (let d = 1; d <= 7; d += 1) base[d] = [{ start: "", end: "" }];
        return base;
      });
    }
  }

  function addWeeklySlot(dayId) {
    setWeeklySlotsByDay((prev) => {
      const next = normalizeWeeklySlotsByDay(prev);
      const list = Array.isArray(next[dayId]) ? next[dayId] : [];
      next[dayId] = [...list, { start: "", end: "" }];
      return next;
    });
  }

  function removeWeeklySlot(dayId, slotIndex) {
    setWeeklySlotsByDay((prev) => {
      const next = normalizeWeeklySlotsByDay(prev);
      const list = Array.isArray(next[dayId]) ? next[dayId] : [];
      next[dayId] = list.filter((_, i) => i !== slotIndex);
      if (!next[dayId].length) next[dayId] = [{ start: "", end: "" }];
      return next;
    });
  }

  function updateWeeklySlot(dayId, slotIndex, field, value) {
    setWeeklySlotsByDay((prev) => {
      const next = normalizeWeeklySlotsByDay(prev);
      const list = Array.isArray(next[dayId]) ? [...next[dayId]] : [];
      const current = normalizeSlot(list[slotIndex] || {});
      const patch = { ...current, [field]: value };
      list[slotIndex] = patch;
      next[dayId] = list;
      return next;
    });
  }

  function removeHabit(id) {
    const nextHabits = habits.filter((h) => h.id !== id);
    updateDraft(nextHabits);
  }

  // Remove handleCategoryChange, toggleHabitLink

  function handleDone() {
    if (!habits.length) return;
    if (typeof setData !== "function") return;
    if (!oneOffDateValid) {
      setError("Sélectionne une date pour l’action \"Une fois\".");
      return;
    }
    // Use SYSTEM_INBOX_ID for all category creation; linking handled later
    const validHabits = habits.filter(
      (habit) =>
        habit &&
        habit.title &&
        !(habit.repeat === "weekly" && (!habit.daysOfWeek || habit.daysOfWeek.length === 0))
    );
    const createdProcessIds = validHabits.map(() => uid());
    setData((prev) => {
      let next = prev;
      // Ensure system inbox exists
      next = ensureSystemInboxCategory(next).state;
      // No objective creation here, only process goals
      const baseSchedule = createDefaultGoalSchedule();
      let finalState = next;
      for (let index = 0; index < validHabits.length; index += 1) {
        const habit = validHabits[index];
        const habitId = createdProcessIds[index];
        const normalizedStart = normalizeStartTime(habit.startTime);
        const normalizedReminderTime = normalizeStartTime(habit.reminderTime);
        const normalizedWindowStart = normalizeStartTime(habit.reminderWindowStart);
        const normalizedWindowEnd = normalizeStartTime(habit.reminderWindowEnd);
        const timeFields = normalizeTimeFields({
          timeMode: habit.timeMode,
          timeSlots: habit.timeSlots,
          startTime: normalizedStart,
          reminderTime: normalizedReminderTime,
        });
        const occurrenceStart = timeFields.startTime || "";
        const normalizedDuration = normalizeDurationMinutes(habit.durationMinutes);
        const normalizedDays = normalizeDaysOfWeek(habit.daysOfWeek);
        const repeatMode = habit.repeat || "none";
        const isWeeklyRepeat = repeatMode === "weekly";
        const isDailyRepeat = repeatMode === "daily";
        const isOneOff = repeatMode === "none";
        const reminderEnabled = Boolean(normalizedReminderTime);
        const processScheduleMode = habit.scheduleMode === "WEEKLY_SLOTS" ? "WEEKLY_SLOTS" : "STANDARD";
        const normalizedWeeklySlots =
          processScheduleMode === "WEEKLY_SLOTS" ? normalizeWeeklySlotsByDay(habit.weeklySlotsByDay) : null;
        const schedule = isOneOff
          ? null
          : {
              ...baseSchedule,
              daysOfWeek: isWeeklyRepeat ? normalizedDays : [],
              timeSlots: processScheduleMode === "WEEKLY_SLOTS" ? [] : occurrenceStart ? [occurrenceStart] : [],
              durationMinutes: normalizedDuration,
              windowStart: normalizedWindowStart || "",
              windowEnd: normalizedWindowEnd || "",
              remindersEnabled: reminderEnabled,
              scheduleMode: processScheduleMode,
              weeklySlotsByDay: normalizedWeeklySlots,
            };
        const normalizedOneOff = normalizeLocalDateKey(habit.oneOffDate) || todayLocalKey();
        const oneOffDate = isOneOff ? normalizedOneOff : undefined;
        const startAt = isOneOff && occurrenceStart ? `${oneOffDate}T${occurrenceStart}` : null;
        const normalizedQuantityValue = normalizeQuantityValue(habit.quantityValue);
        const normalizedQuantityUnit = normalizeQuantityUnit(habit.quantityUnit);
        const normalizedQuantityPeriod = normalizeQuantityPeriod(habit.quantityPeriod);
        const normalizedMemo = typeof habit.memo === "string" ? habit.memo.trim() : "";
        finalState = createGoal(finalState, {
          id: habitId,
          categoryId: SYSTEM_INBOX_ID,
          title: habit.title,
          type: "PROCESS",
          planType: isOneOff ? "ONE_OFF" : "ACTION",
          parentId: habit.outcomeId ? habit.outcomeId : null,
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
          scheduleMode: processScheduleMode,
          weeklySlotsByDay: normalizedWeeklySlots,
          timeMode: timeFields.timeMode,
          timeSlots: timeFields.timeSlots,
          startTime: timeFields.startTime,
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
          const existingReminders = Array.isArray(finalState.reminders) ? finalState.reminders : [];
          const filtered = existingReminders.filter((r) => r?.goalId !== habitId);
          finalState = {
            ...finalState,
            reminders: [
              ...filtered,
              normalizeReminder(
                {
                  goalId: habitId,
                  time: normalizedReminderTime,
                  enabled: true,
                  channel: "IN_APP",
                  label: habit.title || "Rappel",
                },
                0
              ),
            ],
          };
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

      // nextStep based on seeded outcome
      const seededOutcomeId = draft?.activeOutcomeId ? String(draft.activeOutcomeId) : null;
      const nextStep = seededOutcomeId ? STEP_PICK_CATEGORY : STEP_LINK_OUTCOME;
      const nextDraft = {
        ...createEmptyDraft(),
        step: nextStep,
        activeOutcomeId: seededOutcomeId,
        createdActionIds: createdProcessIds,
        category: { mode: "existing", id: SYSTEM_INBOX_ID },
        pendingCategoryId: SYSTEM_INBOX_ID,
      };
      return {
        ...finalState,
        ui: { ...(finalState.ui || {}), createDraft: nextDraft, createDraftWasCompleted: false },
      };
    });
    if (typeof onNext === "function") {
      const seededOutcomeId = draft?.activeOutcomeId ? String(draft.activeOutcomeId) : null;
      onNext(seededOutcomeId ? STEP_PICK_CATEGORY : STEP_LINK_OUTCOME);
      return;
    }
    if (typeof onDone === "function") onDone();
  }

  // Remove getOutcomeLabel, outcomeLabel, objectiveColor

  return (
    <ScreenShell
      data={safeData}
      pageId="create-habit"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">2.</span> Actions · {habitType === "ONE_OFF" ? "Une fois" : habitType === "ANYTIME" ? "Anytime" : "Récurrent"}
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
            {/* Category selection UI removed */}
            <div className="stack stackGap8">
              <div className="small textMuted">Mode</div>

              <div className="row gap8">
                {!isTypeOneOff ? (
                  <Select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
                    <option value="daily">Quotidien</option>
                    <option value="weekly">Hebdo</option>
                  </Select>
                ) : (
                  <div className="small2 textMuted">Ponctuelle</div>
                )}

                {repeat === "weekly" && !isTypeAnytime ? (
                  <Select
                    value={scheduleMode}
                    onChange={(e) => {
                      const next = e.target.value;
                      setScheduleMode(next);
                      if (next === "WEEKLY_SLOTS") {
                        setTimeMode("NONE");
                        setStartTime("");
                      }
                    }}
                  >
                    <option value="STANDARD">Heure unique (hebdo)</option>
                    <option value="WEEKLY_SLOTS">Créneaux par jour</option>
                  </Select>
                ) : null}

                {!isTypeAnytime && !isWeeklySlotsMode ? (
                  <>
                    <Select
                      value={timeMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setTimeMode(next);
                        if (next !== "FIXED") setStartTime("");
                      }}
                    >
                      <option value="NONE">Sans heure</option>
                      <option value="FIXED">À heure fixe</option>
                    </Select>
                    {timeMode === "FIXED" ? (
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        placeholder="Heure"
                      />
                    ) : null}
                  </>
                ) : isTypeAnytime ? (
                  <div className="small2 textMuted">Sans heure</div>
                ) : null}

                <Input
                  type="number"
                  min="1"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="Durée (min)"
                />
              </div>

              {isTypeOneOff ? (
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

              {repeat === "weekly" && scheduleMode === "WEEKLY_SLOTS" && !missingWeeklyDays ? (
                <div className="stack stackGap8">
                  <div className="small2 textMuted">Créneaux par jour</div>
                  <div className="stack stackGap10">
                    {(() => {
                      const normalizedMap = normalizeWeeklySlotsByDay(weeklySlotsByDay);
                      return normalizeDaysOfWeek(daysOfWeek).map((dayId) => {
                        const dayLabel = DOWS.find((d) => d.id === dayId)?.label || String(dayId);
                        const baseSlots = Array.isArray(normalizedMap[dayId]) ? normalizedMap[dayId] : [];
                        const slots = baseSlots.length ? baseSlots : [{ start: "", end: "" }];
                        return (
                          <div key={dayId} className="stack stackGap6">
                            <div className="row rowBetween alignCenter">
                              <div className="small2">{dayLabel}</div>
                              <Button variant="ghost" onClick={() => addWeeklySlot(dayId)}>
                                +
                              </Button>
                            </div>
                            <div className="stack stackGap6">
                              {slots.map((slot, idx) => (
                                <div key={`${dayId}-${idx}`} className="row gap8 alignCenter">
                                  <Input
                                    type="time"
                                    value={slot.start || ""}
                                    onChange={(e) => updateWeeklySlot(dayId, idx, "start", e.target.value)}
                                    placeholder="Début"
                                  />
                                  <Input
                                    type="time"
                                    value={slot.end || ""}
                                    onChange={(e) => updateWeeklySlot(dayId, idx, "end", e.target.value)}
                                    placeholder="Fin"
                                  />
                                  <Button variant="ghost" onClick={() => removeWeeklySlot(dayId, idx)}>
                                    Retirer
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {!weeklySlotsOk ? (
                    <div className="small2 textAccent">
                      Ajoute au moins un créneau valide (début/fin) pour chaque jour sélectionné.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {missingWeeklyDays ? <div className="small2 textAccent">Choisis au moins un jour.</div> : null}
              {isWeeklySlotsMode && !weeklySlotsOk && !missingWeeklyDays ? (
                <div className="small2 textAccent">Ajoute des créneaux valides pour chaque jour.</div>
              ) : null}
              {requiresStartTime && !normalizedStartForCheck ? (
                <div className="small2 textAccent">Choisis une heure.</div>
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
            {/* Objective linking UI removed */}
            <div className="stack stackGap8">
              {habits.map((habit) => (
                <AccentItem key={habit.id} tone="neutral">
                  <div className="row rowBetween gap10 wFull">
                    <div className="small2 flex1">
                      {habit.title}
                      <div className="textMuted2">
                        {formatRepeatLabel(habit)}
                        {habit.scheduleMode === "WEEKLY_SLOTS" ? ` · ${formatWeeklySlotsSummary(habit)}` : habit.startTime ? ` · ${habit.startTime}` : ""}
                        {Number.isFinite(habit.durationMinutes) ? ` · ${habit.durationMinutes} min` : ""}
                        {formatQuantityLabel(habit) ? ` · ${formatQuantityLabel(habit)}` : ""}
                        {habit.reminderTime ? ` · Rappel ${habit.reminderTime}` : ""}
                        {habit.memo ? " · Mémo" : ""}
                      </div>
                    </div>
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
