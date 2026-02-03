import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import {
  AccentItem,
  Button,
  Card,
  Chip,
  ChipRow,
  CheckboxRow,
  Divider,
  Hint,
  Input,
  Textarea,
  ToggleChip,
} from "../components/UI";
import Select from "../ui/select/Select";
import DatePicker from "../ui/date/DatePicker";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS, STEP_LINK_OUTCOME, STEP_PICK_CATEGORY } from "../creation/creationSchema";
import { uid } from "../utils/helpers";
import { createGoal } from "../logic/goals";
import { ensureWindowFromScheduleRules } from "../logic/occurrencePlanner";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
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

function addDaysLocal(dateKey, days) {
  const dk = typeof dateKey === "string" ? normalizeLocalDateKey(dateKey) : "";
  if (!dk) return "";
  const base = fromLocalDateKey(dk);
  base.setDate(base.getDate() + (Number.isFinite(days) ? Math.trunc(days) : 0));
  return toLocalDateKey(base);
}

function setDaysPreset(setter, preset) {
  if (preset === "ALL") return setter([1, 2, 3, 4, 5, 6, 7]);
  if (preset === "WEEKDAYS") return setter([1, 2, 3, 4, 5]);
  if (preset === "CLEAR") return setter([]);
  return setter([appDowFromDate(new Date())]);
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
  for (const d of days) {
    const slots = Array.isArray(map[d]) ? map[d] : [];
    const hasValidStart = slots.some((s) => Boolean(normalizeStartTime(s?.start)));
    if (!hasValidStart) return false;
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
  const isOneOff = repeat === "none";
  const isWeekly = repeat === "weekly";

  if (isOneOff) {
    const dateLabel = habit.oneOffDate ? ` · ${habit.oneOffDate}` : "";
    return `Ponctuelle${dateLabel}`;
  }

  if (habit.habitType === "ANYTIME") {
    return habit.anytimeFlexible ? "Flexible" : "Flexible · Jours";
  }

  if (isWeekly) {
    const days = Array.isArray(habit.daysOfWeek) ? habit.daysOfWeek : [];
    const labels = days
      .map((id) => DOWS.find((d) => d.id === id)?.label)
      .filter(Boolean)
      .join(" ");
    return labels ? `Planifiée · ${labels}` : "Planifiée";
  }

  return "Planifiée";
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

function DayChips({ value, onChange }) {
  const days = Array.isArray(value) ? value : [];
  return (
    <ChipRow>
      {DOWS.map((day) => {
        const active = days.includes(day.id);
        return (
          <ToggleChip
            key={day.id}
            value={day.id}
            selected={active ? day.id : null}
            onSelect={() =>
              onChange((prev) => {
                const p = Array.isArray(prev) ? prev : [];
                const next = p.includes(day.id) ? p.filter((d) => d !== day.id) : [...p, day.id].sort();
                return next;
              })
            }
          >
            {day.label}
          </ToggleChip>
        );
      })}
    </ChipRow>
  );
}

function PresetChips({ onAll, onWeekdays, onClear }) {
  return (
    <ChipRow>
      <Chip onClick={onAll}>Tous</Chip>
      <Chip onClick={onWeekdays}>Lun–Ven</Chip>
      <Chip onClick={onClear}>Effacer</Chip>
    </ChipRow>
  );
}

export default function CreateV2Habits({
  data,
  createVariant,
  setData,
  onBack,
  onDone,
  onCancel,
  canCreateAction = true,
  onOpenPaywall,
  isPremiumPlan = false,
  planLimits = null,
  generationWindowDays = null,
  onNext,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);

  const [title, setTitle] = useState("");
  const [oneOffDate, setOneOffDate] = useState(() => todayLocalKey());
  const [location, setLocation] = useState("");

  // Mandatory action period (lifecycle)
  const [lifecycleMode] = useState("FIXED");
  const [activeFrom, setActiveFrom] = useState(() => todayLocalKey());
  const [activeTo, setActiveTo] = useState(() => addDaysLocal(todayLocalKey(), 29));

  // habitType gating
  const habitType = draft?.habitType || createVariant || "RECURRING"; // ONE_OFF | RECURRING | ANYTIME
  const isTypeOneOff = habitType === "ONE_OFF";
  const isTypeAnytime = habitType === "ANYTIME";
  const isTypeRecurring = !isTypeOneOff && !isTypeAnytime;

  // Unified: all non-one-off are weekly-based (days drive recurrence)
  const [repeat, setRepeat] = useState(() => (isTypeOneOff ? "none" : "weekly"));

  const [scheduleMode, setScheduleMode] = useState("STANDARD"); // STANDARD | WEEKLY_SLOTS
  const [weeklySlotsByDay, setWeeklySlotsByDay] = useState(() => {
    const base = {};
    for (let d = 1; d <= 7; d += 1) base[d] = [{ start: "", end: "" }];
    return base;
  });

  const [daysOfWeek, setDaysOfWeek] = useState(() => [appDowFromDate(new Date())]);
  const [anytimeFlexible, setAnytimeFlexible] = useState(false);

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
  const [error, setError] = useState("");

  const habits = Array.isArray(draft.habits) ? draft.habits : [];

  const existingActionCount = useMemo(
    () => goals.filter((g) => resolveGoalType(g) === "PROCESS").length,
    [goals]
  );

  const isWeekly = repeat === "weekly";
  const missingWeeklyDays = isTypeRecurring && isWeekly && daysOfWeek.length === 0;
  const isWeeklySlotsMode = isTypeRecurring && isWeekly && scheduleMode === "WEEKLY_SLOTS";
  const weeklySlotsOk = !isWeeklySlotsMode || validateWeeklySlotsByDay(daysOfWeek, weeklySlotsByDay);

  const oneOffDateValid = repeat !== "none" || Boolean(normalizeLocalDateKey(oneOffDate));

  const normalizedActiveFrom = normalizeLocalDateKey(activeFrom) || "";
  const normalizedActiveTo = normalizeLocalDateKey(activeTo) || "";
  const periodValidRaw =
    Boolean(normalizedActiveFrom && normalizedActiveTo) && normalizedActiveTo >= normalizedActiveFrom;
  const periodValid = isTypeOneOff ? oneOffDateValid : periodValidRaw;

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

  // Premium rule:
  // - ONE_OFF: time optional
  // - RECURRING (STANDARD): time required
  // - RECURRING (WEEKLY_SLOTS): time handled per day slots
  // - ANYTIME: no time
  const requiresStartTime =
    (isTypeOneOff && timeMode === "FIXED") ||
    (isTypeRecurring && scheduleMode !== "WEEKLY_SLOTS");

  const startTimeValid = !requiresStartTime || Boolean(normalizedStartForCheck);

  const canAddHabit =
    Boolean(title.trim()) &&
    !missingWeeklyDays &&
    oneOffDateValid &&
    periodValid &&
    quantityValid &&
    reminderValid &&
    startTimeValid &&
    weeklySlotsOk;

  const hasInvalidHabits = habits.some((habit) => {
    if (!habit) return false;
    if (
      habit.repeat === "weekly" &&
      (!habit.daysOfWeek || habit.daysOfWeek.length === 0) &&
      !(habit.habitType === "ANYTIME" && habit.anytimeFlexible)
    )
      return true;
    if (habit.repeat === "none" && !normalizeLocalDateKey(habit.oneOffDate)) return true;
    if (habit.quantityValue && !habit.quantityUnit) return true;
    if (habit.repeat === "weekly" && habit.scheduleMode === "WEEKLY_SLOTS") {
      return !validateWeeklySlotsByDay(habit.daysOfWeek, habit.weeklySlotsByDay);
    }
    if (habit.repeat !== "none") {
      const af = normalizeLocalDateKey(habit.activeFrom) || "";
      const at = normalizeLocalDateKey(habit.activeTo) || "";
      if (!af || !at || at < af) return true;
    }
    return false;
  });

  useEffect(() => {
    if (repeat !== "none") return;
    if (normalizeLocalDateKey(oneOffDate)) return;
    setOneOffDate(todayLocalKey());
  }, [repeat, oneOffDate]);

  useEffect(() => {
    if (!isTypeOneOff) return;
    const dk = normalizeLocalDateKey(oneOffDate) || todayLocalKey();
    if (activeFrom !== dk) setActiveFrom(dk);
    if (activeTo !== dk) setActiveTo(dk);
  }, [isTypeOneOff, oneOffDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enforce constraints when habitType changes
  useEffect(() => {
    if (isTypeOneOff) {
      setRepeat("none");
      setScheduleMode("STANDARD");
      setTimeMode("NONE");
      setStartTime("");
      setAnytimeFlexible(false);
      const dk = normalizeLocalDateKey(oneOffDate) || todayLocalKey();
      setActiveFrom(dk);
      setActiveTo(dk);
      return;
    }

    if (isTypeAnytime) {
      setRepeat("weekly");
      setScheduleMode("STANDARD");
      setTimeMode("NONE");
      setStartTime("");
      setReminderWindowStart("");
      setReminderWindowEnd("");
      setActiveFrom((prev) => normalizeLocalDateKey(prev) || todayLocalKey());
      setActiveTo((prev) => normalizeLocalDateKey(prev) || addDaysLocal(todayLocalKey(), 29));
      return;
    }

    // RECURRING: unified weekly + required days
    setRepeat("weekly");
    setActiveFrom((prev) => normalizeLocalDateKey(prev) || todayLocalKey());
    setActiveTo((prev) => normalizeLocalDateKey(prev) || addDaysLocal(todayLocalKey(), 29));
  }, [isTypeAnytime, isTypeOneOff]); // eslint-disable-line react-hooks/exhaustive-deps

  function normalizeDraftHabits(list) {
    const input = Array.isArray(list) ? list : [];
    const out = [];
    const seen = new Set();
    for (const h of input) {
      if (!h || typeof h !== "object") continue;
      let id = typeof h.id === "string" ? h.id.trim() : "";
      if (!id || seen.has(id)) id = uid();
      seen.add(id);
      out.push({ ...h, id });
    }
    return out;
  }

  function updateDraft(nextHabits) {
    const nextHabitsNormalized = normalizeDraftHabits(nextHabits);
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            habits: nextHabitsNormalized,
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
      setError("Sélectionne une date pour l’action ponctuelle.");
      return;
    }
    if (!isTypeOneOff) {
      const fromKey = normalizeLocalDateKey(activeFrom) || "";
      const toKey = normalizeLocalDateKey(activeTo) || "";
      if (!fromKey || !toKey) {
        setError("Définis une période (début + échéance).");
        return;
      }
      if (toKey < fromKey) {
        setError("L’échéance doit être après la date de début.");
        return;
      }
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

    const normalizedReminderTime2 = normalizeStartTime(reminderTime);
    const normalizedWindowStart = normalizeStartTime(reminderWindowStart);
    const normalizedWindowEnd = normalizeStartTime(reminderWindowEnd);
    if ((normalizedWindowStart || normalizedWindowEnd) && !normalizedReminderTime2) {
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

    const normalizedDays = isTypeOneOff ? [] : normalizeDaysOfWeek(daysOfWeek);
    const effectiveDays = isTypeAnytime && anytimeFlexible ? [] : normalizedDays;

    const normalizedStart = normalizeStartTime(startTime);
    const normalizedDuration = normalizeDurationMinutes(durationMinutes);
    const normalizedOneOff = normalizeLocalDateKey(oneOffDate) || todayLocalKey();

    const normalizedFrom = isTypeOneOff ? normalizedOneOff : normalizeLocalDateKey(activeFrom) || todayLocalKey();
    const normalizedTo = isTypeOneOff
      ? normalizedOneOff
      : normalizeLocalDateKey(activeTo) || addDaysLocal(normalizedFrom, 29);

    const normalizedMemo = typeof memo === "string" ? memo.trim() : "";
    const normalizedLocation = typeof location === "string" ? location.trim() : "";

    const effectiveScheduleMode = isWeeklySlotsMode ? "WEEKLY_SLOTS" : "STANDARD";
    const normalizedWeeklySlots =
      effectiveScheduleMode === "WEEKLY_SLOTS" ? normalizeWeeklySlotsByDay(weeklySlotsByDay) : null;

    const timeFields = normalizeTimeFields({
      timeMode: effectiveScheduleMode === "WEEKLY_SLOTS" ? "NONE" : isTypeRecurring ? "FIXED" : timeMode,
      timeSlots:
        effectiveScheduleMode === "WEEKLY_SLOTS"
          ? []
          : (isTypeRecurring || timeMode === "FIXED") && normalizedStart
          ? [normalizedStart]
          : [],
      startTime: effectiveScheduleMode === "WEEKLY_SLOTS" ? "" : normalizedStart,
      reminderTime: normalizedReminderTime2,
    });

    const nextHabits = [
      ...habits,
      {
        id: uid(),
        title: "" + cleanTitle,

        habitType,
        anytimeFlexible: isTypeAnytime ? Boolean(anytimeFlexible) : false,

        outcomeId,
        repeat: isTypeOneOff ? "none" : "weekly",
        daysOfWeek: effectiveDays,

        scheduleMode: effectiveScheduleMode,
        weeklySlotsByDay: normalizedWeeklySlots,

        timeMode: timeFields.timeMode,
        timeSlots: timeFields.timeSlots,
        startTime: timeFields.startTime,

        durationMinutes: normalizedDuration,
        oneOffDate: isTypeOneOff ? normalizedOneOff : "",

        lifecycleMode,
        activeFrom: normalizedFrom,
        activeTo: normalizedTo,

        completionMode: "ONCE",
        completionTarget: null,
        missPolicy: "LENIENT",
        graceMinutes: 0,

        quantityValue: normalizedQuantityValue,
        quantityUnit: normalizedQuantityValue ? normalizedQuantityUnit : "",
        quantityPeriod: normalizedQuantityValue ? normalizedQuantityPeriod : "",

        reminderTime: normalizedReminderTime2,
        reminderWindowStart: normalizedWindowStart,
        reminderWindowEnd: normalizedWindowEnd,

        location: normalizedLocation,
        memo: normalizedMemo,
      },
    ];

    updateDraft(nextHabits);

    setTitle("");
    setLocation("");
    setQuantityValue("");
    setQuantityUnit("");
    setQuantityPeriod("DAY");
    setReminderTime("");
    setReminderWindowStart("");
    setReminderWindowEnd("");
    setMemo("");
    setError("");

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
    updateDraft(habits.filter((h) => h.id !== id));
  }

  function handleDone() {
    if (!habits.length) return;
    if (typeof setData !== "function") return;

    const validHabits = habits.filter((habit) => habit && habit.title);

    const createdProcessIds = validHabits.map(() => uid());

    setData((prev) => {
      let next = prev;
      next = ensureSystemInboxCategory(next).state;

      const baseSchedule = createDefaultGoalSchedule();
      let finalState = next;

      for (let index = 0; index < validHabits.length; index += 1) {
        const habit = validHabits[index];
        const habitId = createdProcessIds[index];

        const normalizedStart = normalizeStartTime(habit.startTime);
        const normalizedReminderTime3 = normalizeStartTime(habit.reminderTime);
        const normalizedWindowStart = normalizeStartTime(habit.reminderWindowStart);
        const normalizedWindowEnd = normalizeStartTime(habit.reminderWindowEnd);

        const timeFields = normalizeTimeFields({
          timeMode: habit.timeMode,
          timeSlots: habit.timeSlots,
          startTime: normalizedStart,
          reminderTime: normalizedReminderTime3,
        });

        const occurrenceStart = timeFields.startTime || "";
        const normalizedDuration = normalizeDurationMinutes(habit.durationMinutes);

        const normalizedDays = normalizeDaysOfWeek(habit.daysOfWeek);
        const isOneOff = habit.repeat === "none";

        const reminderEnabled = Boolean(normalizedReminderTime3);
        const processScheduleMode = habit.scheduleMode === "WEEKLY_SLOTS" ? "WEEKLY_SLOTS" : "STANDARD";
        const normalizedWeeklySlots =
          processScheduleMode === "WEEKLY_SLOTS" ? normalizeWeeklySlotsByDay(habit.weeklySlotsByDay) : null;

        const schedule = isOneOff
          ? null
          : {
              ...baseSchedule,
              daysOfWeek: normalizedDays,
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

        const normalizedFrom = isOneOff
          ? oneOffDate || todayLocalKey()
          : normalizeLocalDateKey(habit.activeFrom) || todayLocalKey();
        const normalizedTo = isOneOff
          ? oneOffDate || todayLocalKey()
          : normalizeLocalDateKey(habit.activeTo) || addDaysLocal(normalizedFrom, 29);

        const normalizedQuantityValue = normalizeQuantityValue(habit.quantityValue);
        const normalizedQuantityUnit = normalizeQuantityUnit(habit.quantityUnit);
        const normalizedQuantityPeriod = normalizeQuantityPeriod(habit.quantityPeriod);
        const normalizedMemo = typeof habit.memo === "string" ? habit.memo.trim() : "";
        const normalizedLocation = typeof habit.location === "string" ? habit.location.trim() : "";

        finalState = createGoal(finalState, {
          id: habitId,
          categoryId: SYSTEM_INBOX_ID,
          title: habit.title,

          type: "PROCESS",
          habitType: habit.habitType || habitType,
          anytimeFlexible: Boolean(habit.anytimeFlexible),

          planType: isOneOff ? "ONE_OFF" : "ACTION",
          parentId: habit.outcomeId ? habit.outcomeId : null,

          cadence: isOneOff ? undefined : "WEEKLY",
          target: isOneOff ? undefined : 1,
          freqCount: isOneOff ? undefined : 1,
          freqUnit: isOneOff ? undefined : "WEEK",
          weight: 100,

          sessionMinutes: normalizedDuration,
          schedule,

          oneOffDate,
          startAt,

          lifecycleMode: "FIXED",
          activeFrom: normalizedFrom,
          activeTo: normalizedTo,

          completionMode: habit.completionMode || "ONCE",
          completionTarget: habit.completionTarget ?? null,
          missPolicy: habit.missPolicy || "LENIENT",
          graceMinutes: typeof habit.graceMinutes === "number" ? habit.graceMinutes : 0,

          repeat: isOneOff ? "none" : "weekly",
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

          reminderTime: normalizedReminderTime3,
          reminderWindowStart: normalizedWindowStart,
          reminderWindowEnd: normalizedWindowEnd,

          location: normalizedLocation,
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
                  time: normalizedReminderTime3,
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
          finalState = ensureWindowFromScheduleRules(finalState, oneOffDate, oneOffDate, [habitId]);
        }
      }

      if (createdProcessIds.length) {
        const days =
          Number.isFinite(generationWindowDays) && generationWindowDays > 0
            ? Math.floor(generationWindowDays)
            : isPremiumPlan
            ? 90
            : 7;
        const fromKey = todayLocalKey();
        const toKey = addDaysLocal(fromKey, Math.max(0, days - 1));
        finalState = ensureWindowFromScheduleRules(finalState, fromKey, toKey, createdProcessIds);
      }

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

  return (
    <ScreenShell
      data={safeData}
      pageId="create-habit"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">2.</span> Actions ·{" "}
          {habitType === "ONE_OFF" ? "Ponctuelle" : habitType === "ANYTIME" ? "Flexible" : "Planifiée"}
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
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle action" />
              <Button onClick={addHabit} disabled={!canAddHabit}>
                Ajouter
              </Button>
            </div>

            <div className="stack stackGap8">
              <div className="small textMuted">Lieu (optionnel)</div>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Salle, Bureau, 12 rue…"
              />
            </div>

            <div className="stack stackGap8">
              <div className="small textMuted">{isTypeOneOff ? "Ponctuelle" : isTypeAnytime ? "Flexible" : "Planifiée"}</div>

              <Divider />

              {/* ONE_OFF */}
              {isTypeOneOff ? (
                <div className="stack stackGap12">
                  <div className="stack stackGap6">
                    <div className="small2 textMuted">Date (obligatoire)</div>
                    <DatePicker value={oneOffDate} onChange={(e) => setOneOffDate(e.target.value)} />
                    <Hint>Cette action est valable uniquement ce jour-là (début = échéance).</Hint>
                  </div>

                  <div className="stack stackGap6">
                    <div className="small2 textMuted">Moment (optionnel)</div>
                    <div className="row gap8">
                      <Select
                        value={timeMode}
                        onChange={(e) => {
                          const next = e.target.value;
                          setTimeMode(next);
                          if (next !== "FIXED") setStartTime("");
                        }}
                      >
                        <option value="NONE">Dans la journée</option>
                        <option value="FIXED">À heure fixe</option>
                      </Select>
                      {timeMode === "FIXED" ? (
                        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                      ) : null}
                    </div>
                  </div>

                  <div className="stack stackGap6">
                    <div className="small2 textMuted">Durée (optionnel)</div>
                    <Input type="number" min="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="Minutes" />
                  </div>
                </div>
              ) : null}

              {/* ANYTIME */}
              {isTypeAnytime ? (
                <div className="stack stackGap12">
                  <div className="stack stackGap6">
                    <div className="small2 textMuted">Période (obligatoire)</div>
                    <div className="row gap8">
                      <DatePicker value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} />
                      <DatePicker value={activeTo} onChange={(e) => setActiveTo(e.target.value)} />
                    </div>
                    {!periodValid ? <Hint tone="danger">Définis une période valide (échéance ≥ début).</Hint> : null}
                  </div>

                  <CheckboxRow
                    checked={anytimeFlexible}
                    onChange={(e) => {
                      const next = Boolean(e.target.checked);
                      setAnytimeFlexible(next);
                      if (next) setDaysOfWeek([]);
                    }}
                    label="Flexible (sans jours fixes)"
                    description="Jamais manquée : tu coches quand c’est fait."
                  />

                  {!anytimeFlexible ? (
                    <div className="stack stackGap10">
                      <div className="row rowBetween alignCenter">
                        <div className="small2 textMuted">Jours attendus (optionnel)</div>
                        <PresetChips
                          onAll={() => setDaysPreset(setDaysOfWeek, "ALL")}
                          onWeekdays={() => setDaysPreset(setDaysOfWeek, "WEEKDAYS")}
                          onClear={() => setDaysPreset(setDaysOfWeek, "CLEAR")}
                        />
                      </div>
                      <DayChips value={daysOfWeek} onChange={setDaysOfWeek} />
                      <Hint>Dans la journée. Tu coches quand c’est fait.</Hint>
                    </div>
                  ) : (
                    <Hint>Mode flexible : tu coches quand c’est fait.</Hint>
                  )}

                  <div className="stack stackGap6">
                    <div className="small2 textMuted">Durée (optionnel)</div>
                    <Input type="number" min="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="Minutes" />
                  </div>
                </div>
              ) : null}

              {/* RECURRING */}
              {isTypeRecurring ? (
                <div className="stack stackGap12">
                  <div className="stack stackGap6">
                    <div className="small2 textMuted">Période (obligatoire)</div>
                    <div className="row gap8">
                      <DatePicker value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} />
                      <DatePicker value={activeTo} onChange={(e) => setActiveTo(e.target.value)} />
                    </div>
                    {!periodValid ? <Hint tone="danger">Définis une période valide (échéance ≥ début).</Hint> : null}
                  </div>

                  <div className="stack stackGap6">
                    <div className="row rowBetween alignCenter">
                      <div className="small2 textMuted">Jours (obligatoire)</div>
                      <PresetChips
                        onAll={() => setDaysPreset(setDaysOfWeek, "ALL")}
                        onWeekdays={() => setDaysPreset(setDaysOfWeek, "WEEKDAYS")}
                        onClear={() => setDaysPreset(setDaysOfWeek, "CLEAR")}
                      />
                    </div>

                    <DayChips value={daysOfWeek} onChange={setDaysOfWeek} />
                    {missingWeeklyDays ? <Hint tone="danger">Choisis au moins un jour.</Hint> : null}
                  </div>

                  <div className="stack stackGap6">
                    <div className="small2 textMuted">Moment</div>
                    <Select
                      value={scheduleMode}
                      onChange={(e) => {
                        const next = e.target.value;
                        setScheduleMode(next);
                        if (next === "WEEKLY_SLOTS") {
                          // per-day slots take over
                          setStartTime("");
                        }
                      }}
                    >
                      <option value="STANDARD">Dans la journée / Heure fixe</option>
                      <option value="WEEKLY_SLOTS">Créneaux par jour</option>
                    </Select>

                    {scheduleMode === "STANDARD" ? (
                      <div className="stack stackGap8">
                        <div className="row gap8 alignCenter">
                          <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                          />
                          <Button
                            variant="ghost"
                            onClick={() => {
                              // common default if empty
                              if (!normalizeStartTime(startTime)) setStartTime("08:00");
                            }}
                          >
                            Matin
                          </Button>
                          <Button variant="ghost" onClick={() => setStartTime("14:00")}>Après‑midi</Button>
                          <Button variant="ghost" onClick={() => setStartTime("19:00")}>Soir</Button>
                        </div>
                        {!startTimeValid ? <Hint tone="danger">Choisis une heure (obligatoire).</Hint> : null}
                        <Hint>Heure unique (même heure sur tous les jours sélectionnés).</Hint>
                      </div>
                    ) : null}

                    {scheduleMode === "WEEKLY_SLOTS" && !missingWeeklyDays ? (
                      <div className="stack stackGap10">
                        <Hint>Créneaux différents selon le jour.</Hint>

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
                                  <Button variant="ghost" onClick={() => addWeeklySlot(dayId)}>+</Button>
                                </div>

                                <div className="stack stackGap6">
                                  {slots.map((slot, idx) => (
                                    <div key={`${dayId}-${idx}`} className="row gap8 alignCenter">
                                      <Input type="time" value={slot.start || ""} onChange={(e) => updateWeeklySlot(dayId, idx, "start", e.target.value)} />
                                      <Input type="time" value={slot.end || ""} onChange={(e) => updateWeeklySlot(dayId, idx, "end", e.target.value)} />
                                      <Button variant="ghost" onClick={() => removeWeeklySlot(dayId, idx)}>Retirer</Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          });
                        })()}

                        {!weeklySlotsOk ? (
                          <Hint tone="danger">Ajoute au moins un créneau valide (début/fin) pour chaque jour sélectionné.</Hint>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="stack stackGap6">
                    <div className="small2 textMuted">Durée (optionnel)</div>
                    <Input type="number" min="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="Minutes" />
                  </div>
                </div>
              ) : null}
            </div>

            <Divider />

            <div className="stack stackGap8">
              <div className="small textMuted">Quantification (optionnel)</div>
              <div className="row gap8">
                <Input type="number" min="1" value={quantityValue} onChange={(e) => setQuantityValue(e.target.value)} placeholder="Quantité" />
                <Input value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} placeholder="Unité" />
                <Select value={quantityPeriod} onChange={(e) => setQuantityPeriod(e.target.value)}>
                  {QUANTITY_PERIODS.map((period) => (
                    <option key={period.id} value={period.id}>{period.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <Divider />

            <div className="stack stackGap8">
              <div className="small textMuted">Rappel (optionnel)</div>
              <div className="row gap8">
                <Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                {!isTypeAnytime ? (
                  <>
                    <Input type="time" value={reminderWindowStart} onChange={(e) => setReminderWindowStart(e.target.value)} />
                    <Input type="time" value={reminderWindowEnd} onChange={(e) => setReminderWindowEnd(e.target.value)} />
                  </>
                ) : null}
              </div>
            </div>

            <Divider />

            <div className="stack stackGap8">
              <div className="small textMuted">Mémo (optionnel)</div>
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note personnelle" />
            </div>

            <Divider />

            <div className="stack stackGap8">
              {habits.map((habit) => (
                <AccentItem key={habit.id} tone="neutral">
                  <div className="row rowBetween gap10 wFull">
                    <div className="small2 flex1">
                      {habit.title}
                      <div className="textMuted2">
                        {formatRepeatLabel(habit)}
                        {habit.activeFrom && habit.activeTo && habit.repeat !== "none" ? ` · ${habit.activeFrom} → ${habit.activeTo}` : ""}
                        {habit.location ? ` · ${habit.location}` : ""}
                        {habit.scheduleMode === "WEEKLY_SLOTS" ? ` · ${formatWeeklySlotsSummary(habit)}` : habit.startTime ? ` · ${habit.startTime}` : ""}
                        {Number.isFinite(habit.durationMinutes) ? ` · ${habit.durationMinutes} min` : ""}
                        {formatQuantityLabel(habit) ? ` · ${formatQuantityLabel(habit)}` : ""}
                        {habit.reminderTime ? ` · Rappel ${habit.reminderTime}` : ""}
                        {habit.memo ? " · Mémo" : ""}
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => removeHabit(habit.id)}>Retirer</Button>
                  </div>
                </AccentItem>
              ))}
              {!habits.length ? <Hint>Ajoute au moins une action.</Hint> : null}
              {hasInvalidHabits ? <Hint tone="danger">Corrige les actions invalides.</Hint> : null}
              {error ? <Hint tone="danger">{error}</Hint> : null}
            </div>

            <div className="row rowEnd gap10">
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof onCancel === "function") return onCancel();
                  if (typeof onBack === "function") onBack();
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleDone} disabled={!habits.length || hasInvalidHabits}>Terminer</Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
