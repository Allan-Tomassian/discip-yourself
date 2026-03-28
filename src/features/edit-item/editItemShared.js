import { uid } from "../../utils/helpers";
import { createDefaultGoalSchedule } from "../../logic/state";
import { resolveGoalType } from "../../domain/goalType";

export const PRIORITY_OPTIONS = [
  { value: "prioritaire", label: "Prioritaire" },
  { value: "secondaire", label: "Secondaire" },
  { value: "bonus", label: "Bonus" },
];

export const REPEAT_OPTIONS = [
  { value: "none", label: "Une fois" },
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
];

export const QUANTITY_PERIODS = [
  { id: "DAY", label: "par jour" },
  { id: "WEEK", label: "par semaine" },
  { id: "MONTH", label: "par mois" },
];

export const DAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

export const MEASURE_OPTIONS = [
  { value: "money", label: "Argent" },
  { value: "counter", label: "Compteur" },
  { value: "time", label: "Temps" },
  { value: "energy", label: "Énergie" },
  { value: "distance", label: "Distance" },
  { value: "weight", label: "Poids" },
];

export const DEFAULT_CONFLICT_DURATION = 30;

export function getMeasurePlaceholder(type) {
  if (type === "money") return "€";
  if (type === "time") return "Minutes";
  if (type === "energy") return "0 à 100";
  if (type === "distance") return "Km";
  if (type === "weight") return "Kg";
  if (type === "counter") return "Nombre";
  return "Valeur";
}

export function resolvePlanType(item) {
  const rawPlan = typeof item?.planType === "string" ? item.planType.toUpperCase() : "";
  if (rawPlan === "ACTION" || rawPlan === "ONE_OFF" || rawPlan === "STATE") return rawPlan;
  const rawType = typeof item?.type === "string" ? item.type.toUpperCase() : "";
  if (rawType === "ACTION" || rawType === "ONE_OFF" || rawType === "STATE") return rawType;
  if (item?.oneOffDate || item?.freqUnit === "ONCE") return "ONE_OFF";
  if (item?.freqUnit || item?.freqCount || item?.cadence) return "ACTION";
  return "STATE";
}

export function parseStartAt(value) {
  if (!value) return { date: "", time: "" };
  const dt = new Date(value);
  if (!Number.isNaN(dt.getTime())) {
    const pad = (n) => String(n).padStart(2, "0");
    return {
      date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
      time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`,
    };
  }
  if (typeof value === "string" && value.includes("T")) {
    const [date, time = ""] = value.split("T");
    return { date: date || "", time: time.slice(0, 5) || "" };
  }
  return { date: value, time: "" };
}

export function buildStartAt(date, time) {
  const cleanDate = (date || "").trim();
  if (!cleanDate) return "";
  const cleanTime = (time || "00:00").trim() || "00:00";
  return `${cleanDate}T${cleanTime}`;
}

export function normalizeDurationMinutes(value) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw);
}

export function normalizeQuantityValue(value) {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.round(raw * 100) / 100;
}

export function normalizeQuantityUnit(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeQuantityPeriod(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return QUANTITY_PERIODS.some((period) => period.id === raw) ? raw : "DAY";
}

export function normalizeRepeat(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "daily" || raw === "weekly" || raw === "none") return raw;
  return "none";
}

export function normalizeDays(days) {
  if (!Array.isArray(days) || days.length === 0) return createDefaultGoalSchedule().daysOfWeek;
  const cleaned = days.map((day) => Number(day)).filter((day) => Number.isFinite(day) && day >= 1 && day <= 7);
  return cleaned.length ? cleaned : createDefaultGoalSchedule().daysOfWeek;
}

export function normalizeTimes(times) {
  if (!Array.isArray(times)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of times) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function resolvePriority(item) {
  const raw = typeof item?.priority === "string" ? item.priority.toLowerCase() : "";
  if (PRIORITY_OPTIONS.some((opt) => opt.value === raw)) return raw;

  const level = typeof item?.priorityLevel === "string" ? item.priorityLevel.toLowerCase() : "";
  if (level === "primary") return "prioritaire";
  if (level === "secondary") return "secondaire";

  const tier = typeof item?.priorityTier === "string" ? item.priorityTier.toLowerCase() : "";
  if (tier === "essential") return "prioritaire";
  if (tier === "optional" || tier === "someday") return "bonus";

  return "secondaire";
}

export function buildOccurrencesByGoal(list) {
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

export function buildPlanSignature(goal, occurrencesByGoal) {
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

export function updateRemindersForGoal(state, goalId, config, fallbackLabel, options = {}) {
  const base = Array.isArray(state?.reminders) ? state.reminders : [];
  const others = base.filter((reminder) => reminder.goalId !== goalId);
  const goal = Array.isArray(state?.goals) ? state.goals.find((entry) => entry?.id === goalId) : null;
  const goalType = resolveGoalType(goal);
  if (goalType !== "PROCESS") return others;

  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const goalOccurrences = occurrences.filter((occurrence) => occurrence?.goalId === goalId);
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
    ...new Set(goalOccurrences.map((occurrence) => (typeof occurrence?.start === "string" ? occurrence.start : "")).filter(Boolean)),
  ];
  const times = hasOccurrences
    ? occurrenceTimes.length
      ? occurrenceTimes
      : requestedTimes.length
        ? requestedTimes
        : ["09:00"]
    : scheduleSlots;
  const safeTimes = times.filter((time) => typeof time === "string" && time.trim().length);
  if (!safeTimes.length) return others;

  const existing = base.filter((reminder) => reminder.goalId === goalId);
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
