import { LABELS } from "../ui/labels";
import { parseTimeToMinutes } from "./datetime";

const SECTION_ORDER = [
  { key: "oneOff", title: "Ponctuelles" },
  { key: "recurring", title: "Planifiées" },
  { key: "withTime", title: "Avec horaire" },
  { key: "withReminder", title: "Avec rappel" },
  { key: "anytime", title: "Flexibles" },
];

function normalizeRepeat(goal) {
  const raw = typeof goal?.repeat === "string" ? goal.repeat.trim().toLowerCase() : "";
  if (raw === "daily" || raw === "weekly" || raw === "none") return raw;
  return "";
}

const DAY_LABELS = [
  "Lun",
  "Mar",
  "Mer",
  "Jeu",
  "Ven",
  "Sam",
  "Dim",
];

function normalizeDaysOfWeek(goal) {
  const raw = Array.isArray(goal?.daysOfWeek) ? goal.daysOfWeek : [];
  const nums = raw
    .map((d) => {
      if (typeof d === "number") return d;
      const n = Number(d);
      return Number.isFinite(n) ? n : null;
    })
    .filter((n) => n && n >= 1 && n <= 7);
  // 1..7 where 1 = Monday
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function daysBadge(goal) {
  const days = normalizeDaysOfWeek(goal);
  if (!days.length) return "";
  const labels = days.map((d) => DAY_LABELS[d - 1]).filter(Boolean);
  return labels.join(" · ");
}

function timeOfDayLabel(minutes) {
  if (minutes == null) return "";
  if (minutes < 12 * 60) return "Matin";
  if (minutes < 18 * 60) return "Après‑midi";
  return "Soir";
}

function slotsDayParts(slots) {
  const parts = new Set();
  for (const s of slots) {
    const mins = parseTimeToMinutes(s);
    if (mins == null) continue;
    parts.add(timeOfDayLabel(mins));
  }
  return Array.from(parts);
}

function resolveOutcomeId(goal) {
  return (
    (typeof goal?.parentId === "string" && goal.parentId.trim()) ||
    (typeof goal?.outcomeId === "string" && goal.outcomeId.trim()) ||
    (typeof goal?.primaryGoalId === "string" && goal.primaryGoalId.trim()) ||
    ""
  );
}

function resolveTimeMeta(goal) {
  const rawMode = typeof goal?.timeMode === "string" ? goal.timeMode.trim().toUpperCase() : "";
  const slots = Array.isArray(goal?.timeSlots)
    ? goal.timeSlots.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
    : [];
  const start = typeof goal?.startTime === "string" ? goal.startTime.trim() : "";

  let mode = rawMode;
  if (!mode) {
    if (slots.length > 1) mode = "SLOTS";
    else if (slots.length === 1 || start) mode = "FIXED";
    else mode = "NONE";
  }

  let normalizedSlots = slots;
  if (mode === "SLOTS" && !normalizedSlots.length && start) normalizedSlots = [start];
  if (mode === "FIXED" && !normalizedSlots.length && start) normalizedSlots = [start];

  const slotCount = mode === "SLOTS" ? normalizedSlots.length : 0;
  const fixedTime = mode === "FIXED" ? (normalizedSlots[0] || "") : "";
  const hasTime = mode === "SLOTS" ? slotCount > 0 : mode === "FIXED" ? Boolean(fixedTime) : false;

  return { mode, slotCount, fixedTime, hasTime };
}

function buildBadges(goal, outcomeMap) {
  const badges = [];
  const repeat = normalizeRepeat(goal);
  const isOneOff = repeat === "none" || Boolean(goal?.oneOffDate) || goal?.planType === "ONE_OFF";
  const isRecurring = goal?.planType === "RECURRING_SCHEDULED" || repeat === "weekly" || repeat === "daily";
  const isAnytime = goal?.planType === "ANYTIME_EXPECTED";

  if (isOneOff) badges.push("Ponctuelle");
  else if (isRecurring) {
    const d = daysBadge(goal);
    if (d) badges.push(d);
    else badges.push("Planifiée");
  } else if (isAnytime) {
    const d = daysBadge(goal);
    badges.push(d ? `Flexible · ${d}` : "Flexible");
  }

  const reminder = typeof goal?.reminderTime === "string" ? goal.reminderTime.trim() : "";
  const { mode, slotCount, fixedTime, hasTime } = resolveTimeMeta(goal);

  if (mode === "SLOTS" && slotCount) {
    const parts = slotsDayParts(
      Array.isArray(goal?.timeSlots)
        ? goal.timeSlots.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
        : []
    );
    if (parts.length) badges.push(parts.join(" · "));
    else badges.push(`Créneaux · ${slotCount}`);
  } else if (mode === "FIXED" && fixedTime) {
    badges.push(`Heure ${fixedTime}`);
  } else if (!hasTime) {
    badges.push("Sans horaire");
  }

  if (reminder) badges.push(`Rappel ${reminder}`);

  const outcomeId = resolveOutcomeId(goal);
  if (outcomeId) {
    const outcomeTitle = outcomeMap?.get(outcomeId)?.title || "";
    badges.push(outcomeTitle ? `${LABELS.goal}: ${outcomeTitle}` : `${LABELS.goal} lié`);
  }

  return badges;
}

function resolveSectionKey(goal) {
  const repeat = normalizeRepeat(goal);
  const isOneOff = repeat === "none" || Boolean(goal?.oneOffDate) || goal?.planType === "ONE_OFF";
  const isRecurring = goal?.planType === "RECURRING_SCHEDULED" || repeat === "daily" || repeat === "weekly";
  const isAnytime = goal?.planType === "ANYTIME_EXPECTED";
  const reminder = typeof goal?.reminderTime === "string" ? goal.reminderTime.trim() : "";
  const { hasTime } = resolveTimeMeta(goal);

  // Priority: One-off > Recurring > With time > With reminder > Flexible
  if (isOneOff) return "oneOff";
  if (isRecurring) return "recurring";
  if (hasTime) return "withTime";
  if (reminder) return "withReminder";
  if (isAnytime) return "anytime";
  return "anytime";
}

export function buildPlanningSections(goals, outcomes = []) {
  const list = Array.isArray(goals) ? goals : [];
  const outcomeMap = new Map(
    Array.isArray(outcomes) ? outcomes.filter((o) => o && o.id).map((o) => [o.id, o]) : []
  );
  const seen = new Set();
  const buckets = {
    oneOff: [],
    recurring: [],
    withTime: [],
    withReminder: [],
    anytime: [],
  };

  for (const goal of list) {
    if (!goal || !goal.id || seen.has(goal.id)) continue;
    seen.add(goal.id);
    const sectionKey = resolveSectionKey(goal);
    buckets[sectionKey].push({
      goal,
      badges: buildBadges(goal, outcomeMap),
    });
  }

  return SECTION_ORDER.map((section) => ({
    ...section,
    items: buckets[section.key],
  })).filter((section) => section.items.length > 0);
}

export { SECTION_ORDER as LIBRARY_SECTION_ORDER };
