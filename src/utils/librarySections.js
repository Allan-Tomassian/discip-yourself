const SECTION_ORDER = [
  { key: "oneOff", title: "Une fois" },
  { key: "recurring", title: "Récurrentes" },
  { key: "withTime", title: "Avec heure" },
  { key: "withReminder", title: "Avec rappel" },
  { key: "anytime", title: "Anytime" },
];

function normalizeRepeat(goal) {
  const raw = typeof goal?.repeat === "string" ? goal.repeat.trim().toLowerCase() : "";
  if (raw === "daily" || raw === "weekly" || raw === "none") return raw;
  return "";
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
  if (isOneOff) badges.push("Une fois");
  else if (repeat === "weekly") badges.push("Hebdo");
  else if (repeat === "daily") badges.push("Quotidien");

  const reminder = typeof goal?.reminderTime === "string" ? goal.reminderTime.trim() : "";
  const { mode, slotCount, fixedTime, hasTime } = resolveTimeMeta(goal);
  if (mode === "SLOTS" && slotCount) badges.push(`Créneaux: ${slotCount}`);
  else if (mode === "FIXED" && fixedTime) badges.push(`Heure: ${fixedTime}`);
  else if (!hasTime && !reminder) badges.push("Sans heure");

  if (reminder) badges.push(`Rappel: ${reminder}`);

  const outcomeId = resolveOutcomeId(goal);
  if (outcomeId) {
    const outcomeTitle = outcomeMap?.get(outcomeId)?.title || "";
    badges.push(outcomeTitle ? `Objectif: ${outcomeTitle}` : "Objectif lié");
  }

  return badges;
}

function resolveSectionKey(goal) {
  const repeat = normalizeRepeat(goal);
  const isOneOff = repeat === "none" || Boolean(goal?.oneOffDate) || goal?.planType === "ONE_OFF";
  const isRecurring = repeat === "daily" || repeat === "weekly";
  const reminder = typeof goal?.reminderTime === "string" ? goal.reminderTime.trim() : "";
  const { hasTime } = resolveTimeMeta(goal);

  // Priority: One-off > Recurring > With time > With reminder > Anytime
  if (isOneOff) return "oneOff";
  if (isRecurring) return "recurring";
  if (hasTime) return "withTime";
  if (reminder) return "withReminder";
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
