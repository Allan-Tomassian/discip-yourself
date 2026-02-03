import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Textarea } from "../components/UI";
import Select from "../ui/select/Select";
import DatePicker from "../ui/date/DatePicker";
import { safeConfirm } from "../utils/dialogs";
import { fromLocalDateKey, normalizeLocalDateKey, toLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { addDays } from "../utils/dates";
import { uid } from "../utils/helpers";
import { createDefaultGoalSchedule, ensureSystemInboxCategory, normalizeCategory, SYSTEM_INBOX_ID } from "../logic/state";
import { updateGoal } from "../logic/goals";
import { setPrimaryGoalForCategory } from "../logic/priority";
import { resolveGoalType } from "../domain/goalType";
import { regenerateWindowFromScheduleRules } from "../logic/occurrencePlanner";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import { canCreateCategory } from "../logic/entitlements";
import { normalizeTimeFields } from "../logic/timeFields";

const PRIORITY_OPTIONS = [
  { value: "prioritaire", label: "Prioritaire" },
  { value: "secondaire", label: "Secondaire" },
  { value: "bonus", label: "Bonus" },
];

const REPEAT_OPTIONS = [
  { value: "none", label: "Une fois" },
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdo" },
];

const QUANTITY_PERIODS = [
  { id: "DAY", label: "par jour" },
  { id: "WEEK", label: "par semaine" },
  { id: "MONTH", label: "par mois" },
];

const DAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

function resolvePlanType(item) {
  const rawPlan = typeof item?.planType === "string" ? item.planType.toUpperCase() : "";
  if (rawPlan === "ACTION" || rawPlan === "ONE_OFF" || rawPlan === "STATE") return rawPlan;
  const rawType = typeof item?.type === "string" ? item.type.toUpperCase() : "";
  if (rawType === "ACTION" || rawType === "ONE_OFF" || rawType === "STATE") return rawType;
  if (item?.oneOffDate || item?.freqUnit === "ONCE") return "ONE_OFF";
  if (item?.freqUnit || item?.freqCount || item?.cadence) return "ACTION";
  return "STATE";
}

function parseStartAt(value) {
  if (!value) return { date: "", time: "" };
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return {
      date: toLocalDateKey(dt),
      time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    };
  }
  if (typeof value === "string" && value.includes("T")) {
    const [date, time = ""] = value.split("T");
    return { date: date || "", time: time.slice(0, 5) || "" };
  }
  return { date: value, time: "" };
}

function buildStartAt(date, time) {
  const cleanDate = (date || "").trim();
  if (!cleanDate) return "";
  const cleanTime = (time || "00:00").trim() || "00:00";
  return `${cleanDate}T${cleanTime}`;
}

function normalizeStartTime(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : "";
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

function normalizeRepeat(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "daily" || raw === "weekly" || raw === "none") return raw;
  return "none";
}

function normalizeDays(days) {
  if (!Array.isArray(days) || days.length === 0) return createDefaultGoalSchedule().daysOfWeek;
  const cleaned = days.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d >= 1 && d <= 7);
  return cleaned.length ? cleaned : createDefaultGoalSchedule().daysOfWeek;
}

function normalizeTimes(times) {
  if (!Array.isArray(times)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of times) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function resolvePriority(item) {
  const raw = typeof item?.priority === "string" ? item.priority.toLowerCase() : "";
  if (PRIORITY_OPTIONS.some((opt) => opt.value === raw)) return raw;

  // legacy mappings
  const level = typeof item?.priorityLevel === "string" ? item.priorityLevel.toLowerCase() : "";
  if (level === "primary") return "prioritaire";
  if (level === "secondary") return "secondaire";

  const tier = typeof item?.priorityTier === "string" ? item.priorityTier.toLowerCase() : "";
  if (tier === "essential") return "prioritaire";
  if (tier === "optional" || tier === "someday") return "bonus";

  return "secondaire";
}

function buildOccurrencesByGoal(list) {
  const entries = Array.isArray(list) ? list : [];
  const map = new Map();
  for (const occ of entries) {
    if (!occ || typeof occ.goalId !== "string") continue;
    const bucket = map.get(occ.goalId) || [];
    bucket.push(occ);
    map.set(occ.goalId, bucket);
  }
  return map;
}

function buildPlanSignature(goal, occurrencesByGoal) {
  if (!goal) return "";
  const schedule = goal.schedule && typeof goal.schedule === "object" ? goal.schedule : null;
  const scheduleSig = schedule
    ? JSON.stringify({
        daysOfWeek: Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [],
        timeSlots: Array.isArray(schedule.timeSlots) ? schedule.timeSlots : [],
        durationMinutes: Number.isFinite(schedule.durationMinutes) ? schedule.durationMinutes : null,
        windowStart: schedule.windowStart || "",
        windowEnd: schedule.windowEnd || "",
      })
    : "";
  const occurrences = occurrencesByGoal?.get(goal.id) || [];
  const occurrenceSig = occurrences
    .map((occ) => `${occ?.date || ""}|${occ?.start || ""}|${occ?.status || ""}`)
    .sort()
    .join(",");
  return `${goal.planType || ""}|${goal.startAt || ""}|${scheduleSig}|${occurrenceSig}`;
}

function updateRemindersForGoal(state, goalId, config, fallbackLabel, options = {}) {
  const base = Array.isArray(state?.reminders) ? state.reminders : [];
  const others = base.filter((r) => r.goalId !== goalId);
  const goal = Array.isArray(state?.goals) ? state.goals.find((g) => g?.id === goalId) : null;
  const goalType = resolveGoalType(goal);
  if (goalType !== "PROCESS") return others;

  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const goalOccurrences = occurrences.filter((occ) => occ?.goalId === goalId);
  const hasOccurrences = goalOccurrences.length > 0;
  const schedule = goal && typeof goal.schedule === "object" ? goal.schedule : null;
  const scheduleSlots = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots : [];
  const scheduleDays =
    Array.isArray(schedule?.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : [1, 2, 3, 4, 5, 6, 7];
  const canUseReminders = hasOccurrences || scheduleSlots.length > 0;
  if (!config || !config.enabled || !canUseReminders) return others;

  const channel = config.channel === "NOTIFICATION" ? "NOTIFICATION" : "IN_APP";
  const label = config.label || fallbackLabel || "Rappel";
  const requestedTimes = Array.isArray(config.times) ? config.times : [];
  const occurrenceTimes = [
    ...new Set(goalOccurrences.map((occ) => (typeof occ?.start === "string" ? occ.start : "")).filter(Boolean)),
  ];
  const times = hasOccurrences
    ? occurrenceTimes.length
      ? occurrenceTimes
      : requestedTimes.length
        ? requestedTimes
        : ["09:00"]
    : scheduleSlots;
  const safeTimes = times.filter((t) => typeof t === "string" && t.trim().length);
  if (!safeTimes.length) return others;

  const existing = base.filter((r) => r.goalId === goalId);
  const forceNewIds = options?.forceNewIds === true;
  const nextForGoal = safeTimes.map((time, index) => {
    const prev = !forceNewIds ? existing[index] : null;
    return {
      id: prev?.id || uid(),
      goalId,
      time,
      enabled: true,
      channel,
      days: scheduleDays,
      label: prev?.label || label,
    };
  });

  return [...others, ...nextForGoal];
}

export default function EditItem({ data, setData, editItem, onBack, generationWindowDays = null, onOpenPaywall }) {
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const backgroundImage = safeData?.profile?.whyImage || "";
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);
  const reminders = useMemo(
    () => (Array.isArray(safeData.reminders) ? safeData.reminders : []),
    [safeData.reminders]
  );
  const occurrences = useMemo(
    () => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []),
    [safeData.occurrences]
  );
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const outcomes = useMemo(() => goals.filter((g) => resolveGoalType(g) === "OUTCOME"), [goals]);
  const existingNames = new Set(categories.map((c) => String(c?.name || "").trim().toLowerCase()).filter(Boolean));
  const existingIds = new Set(categories.map((c) => c?.id).filter(Boolean));
  const suggestedCategories = SUGGESTED_CATEGORIES.filter(
    (cat) =>
      cat && !existingIds.has(cat.id) && !existingNames.has(String(cat.name || "").trim().toLowerCase())
  );
  const sysCategory = categories.find((c) => c?.id === SYSTEM_INBOX_ID) || { id: SYSTEM_INBOX_ID, name: "Général" };
  const restCategories = categories.filter((c) => c?.id !== SYSTEM_INBOX_ID);
  restCategories.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  const categoryOptions = [
    sysCategory,
    ...restCategories,
    ...suggestedCategories.map((cat) => ({ id: cat.id, name: cat.name, suggested: true })),
  ];

  const rawItem = useMemo(
    () => (editItem?.id ? goals.find((g) => g?.id === editItem.id) || null : null),
    [editItem?.id, goals]
  );
  const item = useMemo(() => {
    if (!rawItem) return null;
    return {
      ...rawItem,
      _reminders: reminders.filter((r) => r?.goalId === rawItem.id),
      _occurrences: occurrences.filter((o) => o && o.goalId === rawItem.id),
    };
  }, [rawItem, reminders, occurrences]);

  const type = resolveGoalType(rawItem);

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
  const [reminderTime, setReminderTime] = useState("");
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [quantityValue, setQuantityValue] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const [quantityPeriod, setQuantityPeriod] = useState("DAY");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedOutcomeId, setSelectedOutcomeId] = useState("");
  const [deadlineTouched, setDeadlineTouched] = useState(false);
  const [error, setError] = useState("");
  const [planOpen, setPlanOpen] = useState(false);

  const isProcess = type === "PROCESS";
  const effectiveSelectedOutcomeId =
    isProcess && selectedOutcomeId && outcomes.some((o) => o.id === selectedOutcomeId) ? selectedOutcomeId : "";
  const selectedSuggestion = suggestedCategories.find((cat) => cat.id === selectedCategoryId) || null;
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

  /* eslint-disable react-hooks/set-state-in-effect */
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
    const reminderTimesRaw = reminderItems.length ? reminderItems.map((r) => r.time) : [];
    const reminderTimesClean = normalizeTimes(reminderTimesRaw);
    const reminderEnabled =
      reminderItems.length > 0 ? reminderItems.some((r) => r.enabled !== false) : Boolean(item.reminderTime);
    const reminderTimeValue = normalizeStartTime(item.reminderTime || reminderTimesClean[0] || "");
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
      reminderTime: reminderTimeValue,
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
    setReminderTime(reminderTimeValue);
    setNotes(isProcess ? item.habitNotes || "" : item.notes || "");
    setDeadline(item.deadline || "");
    setQuantityValue(rawQuantityValue != null ? String(rawQuantityValue) : "");
    setQuantityUnit(rawQuantityUnit);
    setQuantityPeriod(rawQuantityPeriod || "DAY");
    setSelectedCategoryId(item.categoryId || SYSTEM_INBOX_ID);
    setSelectedOutcomeId(item.parentId || item.outcomeId || "");
    setDeadlineTouched(Boolean(item.deadline));
    setError("");
    setPlanOpen(false);
  }, [item, isProcess, canUseReminders]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!item) {
    return (
      <ScreenShell
        headerTitle={<span className="textAccent">Modifier</span>}
        headerSubtitle={
          <div className="stack stackGap12">
            <div>Élément introuvable</div>
            <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
              ← Retour
            </Button>
          </div>
        }
        backgroundImage={backgroundImage}
      >
        <div className="stack stackGap12">
          <Card>
            <div className="p18">
              <div className="small2">Impossible de retrouver cet élément.</div>
            </div>
          </Card>
        </div>
      </ScreenShell>
    );
  }

  function toggleDay(day) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function activateSuggestedCategory(cat) {
    if (!cat || typeof setData !== "function") return;
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
      if (prevCategories.some((c) => c?.id === cat.id)) return prev;
      if (prevCategories.some((c) => String(c?.name || "").trim().toLowerCase() === String(cat.name || "").trim().toLowerCase())) {
        return prev;
      }
      const created = normalizeCategory({ id: cat.id, name: cat.name, color: cat.color }, prevCategories.length);
      return { ...prev, categories: [...prevCategories, created] };
    });
    setSelectedCategoryId(cat.id);
  }

  function handleSave() {
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
    // legacy backfill (kept for compatibility)
    updates.priorityLevel = priority === "prioritaire" ? "primary" : priority === "secondaire" ? "secondary" : "bonus";

    const normalizedCategoryId = selectedCategoryId || SYSTEM_INBOX_ID;
    const selectedSuggestion = suggestedCategories.find((cat) => cat.id === normalizedCategoryId) || null;
    if (selectedSuggestion && !canCreateCategory(safeData)) {
      if (typeof onOpenPaywall === "function") {
        onOpenPaywall("Limite de catégories atteinte.");
      } else {
        setError("Limite de catégories atteinte.");
      }
      return;
    }

    let normalizedReminderTime = "";
    let normalizedWindowStart = "";
    let normalizedWindowEnd = "";

    if (isProcess) {
      const repeatMode = normalizeRepeat(repeat);
      const isWeekly = repeatMode === "weekly";
      const isOneOff = repeatMode === "none";
      const normalizedOneOff = normalizeLocalDateKey(oneOffDate);
      if (isOneOff && !normalizedOneOff) {
        setError("Sélectionne une date pour l’action \"Une fois\".");
        return;
      }
      if (isWeekly && (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0)) {
        setError("Choisis au moins un jour.");
        return;
      }
      const normalizedTimeInput = normalizeStartTime(timeInputValue);
      if (!hasMultipleSlots && timeMode === "FIXED" && !normalizedTimeInput) {
        setError("Choisis une heure.");
        return;
      }
      const normalizedDuration = normalizeDurationMinutes(sessionMinutes);
      const days = normalizeDays(daysOfWeek);
      normalizedReminderTime = remindersEnabled ? normalizeStartTime(reminderTime) : "";
      normalizedWindowStart = normalizeStartTime(windowStart);
      normalizedWindowEnd = normalizeStartTime(windowEnd);
      if ((normalizedWindowStart || normalizedWindowEnd) && !normalizedReminderTime) {
        setError("Choisis une heure de rappel.");
        return;
      }
      const effectiveStart = normalizedTimeInput || normalizedReminderTime || "00:00";
      const scheduleBase = createDefaultGoalSchedule();
      const schedule =
        isOneOff
          ? undefined
          : {
              ...scheduleBase,
              ...item.schedule,
              daysOfWeek: isWeekly ? days : [],
              timeSlots: [effectiveStart],
              durationMinutes: normalizedDuration,
              remindersEnabled: Boolean(normalizedReminderTime),
              windowStart: normalizedReminderTime ? normalizedWindowStart || "" : "",
              windowEnd: normalizedReminderTime ? normalizedWindowEnd || "" : "",
            };
      const startAt = isOneOff
        ? buildStartAt(
            normalizedOneOff || todayLocalKey(),
            normalizedTimeInput || normalizedReminderTime || "00:00"
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
      updates.reminderTime = normalizedReminderTime;
      updates.reminderWindowStart = normalizedReminderTime ? normalizedWindowStart || "" : "";
      updates.reminderWindowEnd = normalizedReminderTime ? normalizedWindowEnd || "" : "";
      updates.parentId = effectiveSelectedOutcomeId || null;
      updates.outcomeId = effectiveSelectedOutcomeId || null;
      const existingTimeFields = normalizeTimeFields({
        timeMode: item.timeMode,
        timeSlots: item.timeSlots,
        startTime: item.startTime,
        reminderTime: normalizedReminderTime,
      });
      const timeFieldsToPersist = hasMultipleSlots
        ? existingTimeFields
        : normalizeTimeFields({
            timeMode,
            timeSlots: timeMode === "FIXED" && normalizedTimeInput ? [normalizedTimeInput] : [],
            startTime: normalizedTimeInput,
            reminderTime: normalizedReminderTime,
          });
      updates.timeMode = timeFieldsToPersist.timeMode;
      updates.timeSlots = timeFieldsToPersist.timeSlots;
      updates.startTime = timeFieldsToPersist.startTime;
    } else {
      const normalizedStart = normalizeLocalDateKey(startDate) || todayLocalKey();
      const normalizedDeadline = normalizeLocalDateKey(deadline);
      if (!normalizedDeadline || (minDeadlineKey && normalizedDeadline < minDeadlineKey)) {
        setError(`Un objectif dure min. 2 jours. Pour < 2 jours, crée une Action.`);
        return;
      }
      updates.categoryId = normalizedCategoryId;
      updates.startDate = normalizedStart;
      updates.deadline = normalizedDeadline;
      updates.notes = (notes || "").trim();
      updates.priority = priority;
    }

    const reminderConfig =
      isProcess && remindersEnabled && normalizedReminderTime
        ? {
            enabled: true,
            times: [normalizedReminderTime],
            channel: "IN_APP",
            days: normalizeDays(daysOfWeek),
            label: cleanTitle,
          }
        : null;

    if (typeof setData === "function") {
      const goalId = item.id;
      const categoryId = updates.categoryId || item.categoryId;
      setData((prev) => {
        let nextState = prev;
        if (categoryId === SYSTEM_INBOX_ID) {
          nextState = ensureSystemInboxCategory(nextState).state;
        }
        if (selectedSuggestion) {
          const prevCategories = Array.isArray(nextState.categories) ? nextState.categories : [];
          if (!prevCategories.some((c) => c?.id === selectedSuggestion.id)) {
            const created = normalizeCategory(
              { id: selectedSuggestion.id, name: selectedSuggestion.name, color: selectedSuggestion.color },
              prevCategories.length
            );
            nextState = { ...nextState, categories: [...prevCategories, created] };
          }
        }
        const prevOccurrencesByGoal = buildOccurrencesByGoal(prev?.occurrences);
        const prevGoal = Array.isArray(prev?.goals) ? prev.goals.find((g) => g?.id === goalId) : null;
        const prevPlanSig = buildPlanSignature(prevGoal, prevOccurrencesByGoal);

        let next = updateGoal(nextState, goalId, updates);
        if (type === "OUTCOME" && updates.priority === "prioritaire" && categoryId) {
          next = setPrimaryGoalForCategory(next, categoryId, goalId);
        }

        const nextOccurrencesByGoal = buildOccurrencesByGoal(next?.occurrences);
        const nextGoal = Array.isArray(next?.goals) ? next.goals.find((g) => g?.id === goalId) : null;
        const nextPlanSig = buildPlanSignature(nextGoal, nextOccurrencesByGoal);
        const planChanged = prevPlanSig !== nextPlanSig;

        if (type === "OUTCOME") {
          if (Array.isArray(next.reminders)) {
            const filtered = next.reminders.filter((r) => r.goalId !== goalId);
            if (filtered.length !== next.reminders.length) {
              next = { ...next, reminders: filtered };
            }
          }
        } else if (reminderConfig) {
          const label = updates.title || item.title || "Rappel";
          const nextReminders = updateRemindersForGoal(next, goalId, reminderConfig, label, { forceNewIds: planChanged });
          next = { ...next, reminders: nextReminders };
        } else if (Array.isArray(next.reminders)) {
          const filtered = next.reminders.filter((r) => r.goalId !== goalId);
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
        return next;
      });
    }

    if (typeof onBack === "function") onBack();
  }

  function handleDelete() {
    if (!item?.id || typeof setData !== "function") return;
    const ok = safeConfirm("Supprimer cet élément ?");
    if (!ok) return;
    const goalId = item.id;
    setData((prev) => {
      const goal = (prev.goals || []).find((g) => g.id === goalId);
      const isOutcome = resolveGoalType(goal) === "OUTCOME";
      let nextGoals = (prev.goals || []).filter((g) => g.id !== goalId);
      if (isOutcome) {
        nextGoals = nextGoals.map((g) =>
          g && g.parentId === goalId ? { ...g, parentId: null, outcomeId: null } : g
        );
      }
      const nextCategories = (prev.categories || []).map((cat) =>
        cat.mainGoalId === goalId ? { ...cat, mainGoalId: null } : cat
      );
      const nextUi = { ...(prev.ui || {}) };
      if (nextUi.sessionDraft?.objectiveId === goalId) nextUi.sessionDraft = null;
      if (nextUi.activeSession?.habitIds) {
        const kept = nextUi.activeSession.habitIds.filter((id) => nextGoals.some((g) => g.id === id));
        nextUi.activeSession = kept.length ? { ...nextUi.activeSession, habitIds: kept } : null;
      }
      if (resolveGoalType(goal) === "PROCESS") {
        const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
        const nextReminders = (prev.reminders || []).filter((r) => r && r.goalId !== goalId);
        const nextSessions = Array.isArray(prev.sessions)
          ? prev.sessions
              .map((s) => {
                if (!s || typeof s !== "object") return s;
                const habitIds = Array.isArray(s.habitIds) ? s.habitIds.filter((id) => id !== goalId) : [];
                const doneHabitIds = Array.isArray(s.doneHabitIds) ? s.doneHabitIds.filter((id) => id !== goalId) : [];
                return { ...s, habitIds, doneHabitIds };
              })
              .filter((s) => {
                if (!s || typeof s !== "object") return false;
                const hasHabits = Array.isArray(s.habitIds) && s.habitIds.length > 0;
                const hasDone = Array.isArray(s.doneHabitIds) && s.doneHabitIds.length > 0;
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
        return {
          ...prev,
          goals: nextGoals,
          categories: nextCategories,
          occurrences: nextOccurrences,
          reminders: nextReminders,
          sessions: nextSessions,
          checks: nextChecks,
          ui: nextUi,
        };
      }
      return { ...prev, goals: nextGoals, categories: nextCategories, ui: nextUi };
    });
    if (typeof onBack === "function") onBack();
  }

  return (
    <ScreenShell
      headerTitle={<span className="textAccent">Modifier</span>}
      headerSubtitle={
        <div className="stack stackGap12">
          <div>{item.title || (isProcess ? "Action" : "Objectif")}</div>
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </Button>
        </div>
      }
      headerRowAlign="start"
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Card>
          <div className="p18">
            <div className="editPanel">
          <div className="editPanelBody">
            <div className="editSection">
              <div className="editSectionTitle">Identité</div>
              <div className="editSectionBody">
                <div>
                  <div className="small" style={{ marginBottom: 6 }}>
                    Catégorie
                  </div>
                  <Select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                        {cat.suggested ? " (suggestion)" : ""}
                      </option>
                    ))}
                  </Select>
                  {selectedSuggestion ? (
                    <div className="row rowBetween alignCenter mt6">
                      <div className="small2 textMuted">Suggestion non activée.</div>
                      <Button variant="ghost" onClick={() => activateSuggestedCategory(selectedSuggestion)}>
                        Activer
                      </Button>
                    </div>
                  ) : null}
                </div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
                <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                {isProcess ? (
                  <div>
                    <div className="small" style={{ marginBottom: 6 }}>
                      Objectif lié (optionnel)
                    </div>
                    <Select value={effectiveSelectedOutcomeId} onChange={(e) => setSelectedOutcomeId(e.target.value)}>
                      <option value="">Sans objectif</option>
                      {outcomes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.title || "Objectif"}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="editSection">
              <button className="editSectionToggle" type="button" onClick={() => setPlanOpen((prev) => !prev)}>
                Plan
                <span>{planOpen ? "▾" : "▸"}</span>
              </button>
              {planOpen ? (
                <div className="editSectionBody">
                  {isProcess ? (
                    <>
                      <div>
                        <div className="small" style={{ marginBottom: 6 }}>
                          Mode
                        </div>
                        <Select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
                          {REPEAT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      {repeat === "none" ? (
                        <>
                          <div>
                            <div className="small" style={{ marginBottom: 6 }}>
                              Date
                            </div>
                            <DatePicker value={oneOffDate} onChange={(e) => setOneOffDate(e.target.value)} />
                          </div>
                          <div>
                            <div className="small" style={{ marginBottom: 6 }}>
                              Heure
                            </div>
                            {hasMultipleSlots ? (
                              <div className="small2 textMuted">Créneaux: {timeSlots.length}</div>
                            ) : (
                              <>
                                <Select
                                  value={timeMode}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setTimeMode(next);
                                    if (next !== "FIXED") {
                                      setStartTime("");
                                      setOneOffTime("");
                                    }
                                  }}
                                >
                                  <option value="NONE">Sans heure</option>
                                  <option value="FIXED">À heure fixe</option>
                                </Select>
                                {timeMode === "FIXED" ? (
                                  <Input
                                    type="time"
                                    value={oneOffTime}
                                    onChange={(e) => setOneOffTime(e.target.value)}
                                  />
                                ) : null}
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {repeat === "weekly" ? (
                            <div>
                              <div className="small" style={{ marginBottom: 6 }}>
                                Jours
                              </div>
                              <div className="editDaysRow">
                                {DAY_OPTIONS.map((day) => (
                                  <button
                                    key={day.value}
                                    type="button"
                                    className={`editDayOption${daysOfWeek.includes(day.value) ? " isActive" : ""}`}
                                    onClick={() => toggleDay(day.value)}
                                  >
                                    {day.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          <div>
                            <div className="small" style={{ marginBottom: 6 }}>
                              Durée (min)
                            </div>
                            <Input
                              type="number"
                              value={sessionMinutes}
                              onChange={(e) => setSessionMinutes(e.target.value)}
                            />
                          </div>
                          <div className="row" style={{ gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div className="small" style={{ marginBottom: 6 }}>
                                Heure
                              </div>
                              {hasMultipleSlots ? (
                                <div className="small2 textMuted">Créneaux: {timeSlots.length}</div>
                              ) : (
                                <>
                                  <Select
                                    value={timeMode}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setTimeMode(next);
                                      if (next !== "FIXED") {
                                        setStartTime("");
                                        setOneOffTime("");
                                      }
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
                                    />
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                      {!hasMultipleSlots && timeMode === "FIXED" && !normalizeStartTime(timeInputValue) ? (
                        <div className="small2 textAccent">Choisis une heure.</div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="small" style={{ marginBottom: 6 }}>
                          Date de début
                        </div>
                        <DatePicker
                          value={startDate}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setStartDate(nextValue);
                            if (!deadlineTouched) {
                              const base = fromLocalDateKey(normalizeLocalDateKey(nextValue) || todayLocalKey());
                              base.setDate(base.getDate() + 7);
                              setDeadline(toLocalDateKey(base));
                            }
                            if (error) setError("");
                          }}
                        />
                      </div>
                      <div>
                        <div className="small" style={{ marginBottom: 6 }}>
                          Date de fin (min 2 jours : {minDeadlineKey})
                        </div>
                        <DatePicker
                          value={deadline}
                          onChange={(e) => {
                            setDeadline(e.target.value);
                            setDeadlineTouched(true);
                            if (error) setError("");
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>

            {isProcess ? (
              <div className="editSection">
                <div className="editSectionTitle">Rappels</div>
                <div className="editSectionBody">
                  <label className="includeToggle">
                    <input
                      type="checkbox"
                      checked={remindersEnabled}
                      onChange={(e) => setRemindersEnabled(e.target.checked)}
                      disabled={!canUseReminders}
                    />
                    <span>Activer les rappels</span>
                  </label>
                  {remindersEnabled ? (
                    <>
                      <div className="row" style={{ gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div className="small" style={{ marginBottom: 6 }}>
                            Heure
                          </div>
                          <Input
                            type="time"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="row" style={{ gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div className="small" style={{ marginBottom: 6 }}>
                            Fenêtre début
                          </div>
                          <Input
                            type="time"
                            value={windowStart}
                            onChange={(e) => setWindowStart(e.target.value)}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="small" style={{ marginBottom: 6 }}>
                            Fenêtre fin
                          </div>
                          <Input
                            type="time"
                            value={windowEnd}
                            onChange={(e) => setWindowEnd(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {isProcess ? (
              <div className="editSection">
                <div className="editSectionTitle">Quantification</div>
                <div className="editSectionBody">
                  <div className="row" style={{ gap: 10 }}>
                    <Input
                      type="number"
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
                      {QUANTITY_PERIODS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="editSection">
              <div className="editSectionTitle">{isProcess ? "Mémo" : "Notes"}</div>
              <div className="editSectionBody">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
              </div>
            </div>

            <div className="editSection">
              <div className="editSectionTitle">Zone sensible</div>
              <div className="editSectionBody">
                <Button variant="danger" onClick={handleDelete}>
                  Supprimer
                </Button>
              </div>
            </div>

            {error ? (
              <div className="stack stackGap6">
                <div className="small2" style={{ color: "rgba(255,120,120,.95)" }}>{error}</div>
                {!isProcess && error.includes("min. 7 jours") ? (
                  <Button variant="ghost" onClick={onBack}>
                    Créer une action à la place
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

            <div className="editPanelFooter">
              <Button variant="ghost" onClick={onBack}>
                Annuler
              </Button>
              <Button onClick={handleSave}>Enregistrer</Button>
            </div>
          </div>
        </div>
      </Card>
      </div>
    </ScreenShell>
  );
}
