import { uid } from "../utils/helpers";
import { isValidTimeStr, normalizeLocalDateKey, parseTimeToMinutes, todayLocalKey } from "../utils/datetime";

const DOW_VALUES = new Set([1, 2, 3, 4, 5, 6, 7]); // 1=Mon .. 7=Sun

function normalizeTimeHM(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!isValidTimeStr(raw)) return "";
  return raw;
}

function normalizeDaysOfWeek(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const v of value) {
    const n = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(n)) continue;
    const id = Math.trunc(n);
    if (!DOW_VALUES.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeWeeklySlotsByDay(value) {
  if (!value || typeof value !== "object") return null;
  const out = {};
  for (const k of Object.keys(value)) {
    const day = String(k).trim();
    if (!/^[1-7]$/.test(day)) continue;
    const arr = value[k];
    if (!Array.isArray(arr)) continue;
    const clean = [];
    for (const slot of arr) {
      if (!slot || typeof slot !== "object") continue;
      const start = normalizeTimeHM(slot.start || slot.startTime || "");
      const end = normalizeTimeHM(slot.end || slot.endTime || "");
      if (!start) continue;
      clean.push({ start, end });
    }
    if (clean.length) out[day] = clean;
  }
  return Object.keys(out).length ? out : null;
}

function resolveScheduleMode(action, schedule) {
  const raw = typeof action?.scheduleMode === "string" ? action.scheduleMode : schedule?.scheduleMode;
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

function resolveTimeMode(action) {
  const raw = typeof action?.timeMode === "string" ? action.timeMode.trim().toUpperCase() : "";
  return raw;
}

function resolveRepeat(action) {
  const raw = typeof action?.repeat === "string" ? action.repeat.trim().toLowerCase() : "";
  return raw;
}

function resolveDaysOfWeek(action, schedule) {
  const raw = Array.isArray(action?.daysOfWeek)
    ? action.daysOfWeek
    : Array.isArray(schedule?.daysOfWeek)
      ? schedule.daysOfWeek
      : [];
  const normalized = normalizeDaysOfWeek(raw);
  if (normalized.length) return normalized;

  const rep = resolveRepeat(action);
  if (rep === "daily") return [1, 2, 3, 4, 5, 6, 7];
  return [];
}

function resolveTimeSlots(action, schedule) {
  const raw = Array.isArray(action?.timeSlots)
    ? action.timeSlots
    : Array.isArray(schedule?.timeSlots)
      ? schedule.timeSlots
      : [];
  const out = [];
  const seen = new Set();
  for (const t of raw) {
    const slot = normalizeTimeHM(t);
    if (!slot || seen.has(slot)) continue;
    seen.add(slot);
    out.push(slot);
  }
  return out;
}

function resolveStartTime(action, schedule) {
  const direct = normalizeTimeHM(action?.startTime);
  if (direct) return direct;
  const slots = resolveTimeSlots(action, schedule);
  return slots[0] || "";
}

function resolveWindow(action, schedule) {
  const windowStart =
    normalizeTimeHM(schedule?.windowStart) ||
    normalizeTimeHM(action?.reminderWindowStart) ||
    normalizeTimeHM(action?.windowStart) ||
    "";
  const windowEnd =
    normalizeTimeHM(schedule?.windowEnd) ||
    normalizeTimeHM(action?.reminderWindowEnd) ||
    normalizeTimeHM(action?.windowEnd) ||
    "";
  return { windowStart, windowEnd };
}

function resolveDurationMinutes(action, schedule, fallbackMinutes = 30) {
  const direct = Number(action?.durationMinutes);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const session = Number(action?.sessionMinutes);
  if (Number.isFinite(session) && session > 0) return Math.round(session);
  const sched = Number(schedule?.durationMinutes);
  if (Number.isFinite(sched) && sched > 0) return Math.round(sched);
  return fallbackMinutes;
}

function resolveDurationForSlot(slot, baseDuration) {
  if (!slot || !slot.start) return baseDuration;
  const startMin = parseTimeToMinutes(slot.start);
  const endMin = parseTimeToMinutes(slot.end);
  if (Number.isFinite(startMin) && Number.isFinite(endMin) && endMin > startMin) {
    return Math.round(endMin - startMin);
  }
  return baseDuration;
}

function resolveActionKind(action) {
  const plan = typeof action?.planType === "string" ? action.planType.trim().toUpperCase() : "";
  if (plan === "ONE_OFF") return "one_time";
  if (plan === "ACTION") return "recurring";
  if (action?.oneOffDate) return "one_time";
  return "recurring";
}

function resolveAnytimeFlexible(action, schedule) {
  const raw = action?.anytimeFlexible;
  if (typeof raw === "boolean") return raw;
  if (typeof schedule?.anytimeFlexible === "boolean") return schedule.anytimeFlexible;
  return false;
}

export function buildScheduleRuleSourceKey(rule) {
  if (!rule || typeof rule !== "object") return "";
  const days = Array.isArray(rule.daysOfWeek) ? rule.daysOfWeek.join(",") : "";
  return [
    rule.actionId || "",
    rule.kind || "",
    rule.startDate || "",
    rule.endDate || "",
    days,
    rule.timeType || "",
    rule.startTime || "",
    rule.endTime || "",
    rule.windowStart || "",
    rule.windowEnd || "",
    Number.isFinite(rule.durationMin) ? String(rule.durationMin) : "",
  ].join("|");
}

export function normalizeScheduleRule(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rule = { ...raw };
  if (!rule.id) rule.id = uid();
  const actionId = typeof rule.actionId === "string" ? rule.actionId.trim() : "";
  if (!actionId) return null;
  rule.actionId = actionId;
  rule.kind = rule.kind === "one_time" ? "one_time" : "recurring";
  rule.timeType = rule.timeType === "window" ? "window" : "fixed";
  rule.startDate = normalizeLocalDateKey(rule.startDate) || "";
  rule.endDate = normalizeLocalDateKey(rule.endDate) || "";
  rule.daysOfWeek = normalizeDaysOfWeek(rule.daysOfWeek);
  rule.startTime = normalizeTimeHM(rule.startTime);
  rule.endTime = normalizeTimeHM(rule.endTime);
  rule.windowStart = normalizeTimeHM(rule.windowStart);
  rule.windowEnd = normalizeTimeHM(rule.windowEnd);
  rule.durationMin = Number.isFinite(rule.durationMin) && rule.durationMin > 0 ? Math.round(rule.durationMin) : null;
  rule.isActive = rule.isActive !== false;
  if (!rule.sourceKey) rule.sourceKey = buildScheduleRuleSourceKey(rule);
  if (typeof rule.createdAt !== "string") rule.createdAt = "";
  if (typeof rule.updatedAt !== "string") rule.updatedAt = "";
  return rule;
}

export function buildScheduleRulesFromAction(action) {
  if (!action || typeof action !== "object") return [];
  const actionId = typeof action.id === "string" ? action.id.trim() : "";
  if (!actionId) return [];

  const schedule = action.schedule && typeof action.schedule === "object" ? action.schedule : {};
  if (resolveAnytimeFlexible(action, schedule)) return [];

  const kind = resolveActionKind(action);
  const timezone = typeof schedule.timezone === "string" ? schedule.timezone : "";
  const startDate = normalizeLocalDateKey(kind === "one_time" ? action.oneOffDate : action.activeFrom) || "";
  if (kind === "one_time" && !startDate) return [];
  const endDate = normalizeLocalDateKey(kind === "recurring" ? action.activeTo : "") || "";
  const daysOfWeek = kind === "recurring" ? resolveDaysOfWeek(action, schedule) : [];

  const scheduleMode = resolveScheduleMode(action, schedule);
  const weeklySlots =
    scheduleMode === "WEEKLY_SLOTS"
      ? normalizeWeeklySlotsByDay(action.weeklySlotsByDay || schedule.weeklySlotsByDay)
      : null;
  const timeMode = resolveTimeMode(action);
  const timeSlots = resolveTimeSlots(action, schedule);
  const startTime = resolveStartTime(action, schedule);
  const { windowStart, windowEnd } = resolveWindow(action, schedule);

  const baseDuration = resolveDurationMinutes(action, schedule, 30);

  const rules = [];

  if (weeklySlots) {
    for (const [dayKey, slots] of Object.entries(weeklySlots)) {
      const day = Number(dayKey);
      if (!DOW_VALUES.has(day)) continue;
      for (const slot of slots) {
        if (!slot?.start) continue;
        const durationMin = resolveDurationForSlot(slot, baseDuration);
        const rule = {
          id: uid(),
          actionId,
          kind: "recurring",
          timezone,
          startDate: startDate || "",
          endDate,
          daysOfWeek: [day],
          timeType: "fixed",
          startTime: slot.start,
          endTime: slot.end || "",
          durationMin,
          isActive: true,
        };
        rule.sourceKey = buildScheduleRuleSourceKey(rule);
        rules.push(rule);
      }
    }
    return rules;
  }

  if (timeMode === "SLOTS" && timeSlots.length > 1) {
    for (const slot of timeSlots) {
      const rule = {
        id: uid(),
        actionId,
        kind,
        timezone,
        startDate,
        endDate,
        daysOfWeek,
        timeType: "fixed",
        startTime: slot,
        endTime: "",
        durationMin: baseDuration,
        isActive: true,
      };
      rule.sourceKey = buildScheduleRuleSourceKey(rule);
      rules.push(rule);
    }
    return rules;
  }

  const usesWindow = timeMode === "WINDOW" || timeMode === "NONE" || Boolean(windowStart || windowEnd) || !startTime;

  if (usesWindow) {
    const rule = {
      id: uid(),
      actionId,
      kind,
      timezone,
      startDate,
      endDate,
      daysOfWeek,
      timeType: "window",
      windowStart: windowStart || "",
      windowEnd: windowEnd || "",
      durationMin: baseDuration,
      isActive: true,
    };
    rule.sourceKey = buildScheduleRuleSourceKey(rule);
    rules.push(rule);
    return rules;
  }

  const rule = {
    id: uid(),
    actionId,
    kind,
    timezone,
    startDate,
    endDate,
    daysOfWeek,
    timeType: "fixed",
    startTime,
    endTime: "",
    durationMin: baseDuration,
    isActive: true,
  };
  rule.sourceKey = buildScheduleRuleSourceKey(rule);
  rules.push(rule);
  return rules;
}

export function syncScheduleRulesForActions(state, actionIds = null, now = new Date()) {
  if (!state || typeof state !== "object") return { state, changed: false, deactivatedRuleIds: [] };
  const actions = Array.isArray(state.goals) ? state.goals : [];
  const actionIdSet = Array.isArray(actionIds) ? new Set(actionIds.filter(Boolean)) : null;
  const relevantActions = actionIdSet ? actions.filter((a) => actionIdSet.has(a?.id)) : actions;
  const existingRulesRaw = Array.isArray(state.scheduleRules) ? state.scheduleRules : [];
  const existingRules = existingRulesRaw.map(normalizeScheduleRule).filter(Boolean);

  const touchedIds = new Set(relevantActions.map((a) => a?.id).filter(Boolean));
  const retained = existingRules.filter((r) => !touchedIds.has(r.actionId));
  const nowIso = now.toISOString();

  let changed = false;
  const deactivatedRuleIds = new Set();
  const updated = [];

  for (const action of relevantActions) {
    if (!action?.id) continue;
    const actionId = action.id;
    const existingForAction = existingRules.filter((r) => r.actionId === actionId);
    const desiredRules = buildScheduleRulesFromAction(action);

    const existingBySource = new Map();
    for (const rule of existingForAction) {
      if (!rule.sourceKey) continue;
      if (!rule.isActive) continue;
      if (!existingBySource.has(rule.sourceKey)) existingBySource.set(rule.sourceKey, rule);
    }

    const usedIds = new Set();
    for (const desired of desiredRules) {
      const sourceKey = buildScheduleRuleSourceKey(desired);
      const existing = sourceKey ? existingBySource.get(sourceKey) : null;
      if (existing) {
        usedIds.add(existing.id);
        const merged = {
          ...existing,
          ...desired,
          id: existing.id,
          actionId,
          sourceKey,
          isActive: true,
          updatedAt: nowIso,
        };
        updated.push(merged);
      } else {
        const created = {
          ...desired,
          id: desired.id || uid(),
          actionId,
          sourceKey: sourceKey || buildScheduleRuleSourceKey(desired),
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        updated.push(created);
        changed = true;
      }
    }

    for (const existing of existingForAction) {
      if (usedIds.has(existing.id)) continue;
      if (existing.isActive) {
        updated.push({ ...existing, isActive: false, updatedAt: nowIso });
        deactivatedRuleIds.add(existing.id);
        changed = true;
      } else {
        updated.push(existing);
      }
    }
  }

  const nextRules = [...retained, ...updated];
  if (nextRules.length !== existingRulesRaw.length) changed = true;

  return {
    state: { ...state, scheduleRules: nextRules },
    changed,
    deactivatedRuleIds: Array.from(deactivatedRuleIds),
  };
}

export function listActiveScheduleRules(state, actionIds = null) {
  const rules = Array.isArray(state?.scheduleRules) ? state.scheduleRules : [];
  if (!actionIds || !Array.isArray(actionIds)) return rules.filter((r) => r && r.isActive !== false);
  const set = new Set(actionIds.filter(Boolean));
  return rules.filter((r) => r && r.isActive !== false && set.has(r.actionId));
}

export function ensureScheduleRules(state, now = new Date()) {
  const result = syncScheduleRulesForActions(state, null, now);
  return result.state || state;
}

function normalizeDaysForCompare(days) {
  if (!Array.isArray(days)) return "";
  const out = [];
  const seen = new Set();
  for (const v of days) {
    const n = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(n)) continue;
    const id = Math.trunc(n);
    if (!DOW_VALUES.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  out.sort((a, b) => a - b);
  return out.join(",");
}

function ruleCompareSignature(rule, sourceKeyOverride = "") {
  if (!rule || typeof rule !== "object") return "";
  const sourceKey = sourceKeyOverride || rule.sourceKey || buildScheduleRuleSourceKey(rule);
  const duration = Number.isFinite(rule.durationMin) && rule.durationMin > 0 ? Math.round(rule.durationMin) : null;
  return [
    rule.actionId || "",
    rule.kind || "",
    rule.timezone || "",
    rule.startDate || "",
    rule.endDate || "",
    normalizeDaysForCompare(rule.daysOfWeek),
    rule.timeType || "",
    rule.startTime || "",
    rule.endTime || "",
    rule.windowStart || "",
    rule.windowEnd || "",
    duration == null ? "" : String(duration),
    rule.isActive === false ? "0" : "1",
    sourceKey || "",
  ].join("|");
}

export function ensureScheduleRulesForActions(state, actionIds = null, now = new Date()) {
  if (!state || typeof state !== "object") return state;
  const scheduleRules = Array.isArray(state.scheduleRules) ? state.scheduleRules : [];
  const actions = Array.isArray(state.goals) ? state.goals : [];
  const actionIdSet = Array.isArray(actionIds) ? new Set(actionIds.filter(Boolean)) : null;
  const relevantActions = actionIdSet ? actions.filter((a) => actionIdSet.has(a?.id)) : actions;
  if (!relevantActions.length) return state;

  const nowIso = now.toISOString();
  let nextRules = scheduleRules;
  let changed = false;

  const rulesByAction = new Map();
  scheduleRules.forEach((rule, idx) => {
    const actionId = typeof rule?.actionId === "string" ? rule.actionId : "";
    if (!actionId) return;
    if (!rulesByAction.has(actionId)) rulesByAction.set(actionId, []);
    rulesByAction.get(actionId).push({ rule, idx });
  });

  for (const action of relevantActions) {
    if (!action?.id) continue;
    const actionId = action.id;
    const existingEntries = rulesByAction.get(actionId) || [];
    const existingBySource = new Map();
    for (const entry of existingEntries) {
      const existingKey = entry.rule?.sourceKey || buildScheduleRuleSourceKey(entry.rule);
      if (!existingKey || existingBySource.has(existingKey)) continue;
      existingBySource.set(existingKey, entry);
    }

    const desired = buildScheduleRulesFromAction(action);
    const desiredKeys = new Set();

    for (const rule of desired) {
      const sourceKey = rule.sourceKey || buildScheduleRuleSourceKey(rule);
      if (!sourceKey) continue;
      desiredKeys.add(sourceKey);
      const existingEntry = existingBySource.get(sourceKey);
      if (existingEntry) {
        const existing = existingEntry.rule;
        const idx = existingEntry.idx;
        const nextRule = {
          ...existing,
          ...rule,
          id: existing.id || rule.id || uid(),
          actionId,
          sourceKey,
          isActive: true,
          createdAt: existing.createdAt || nowIso,
        };
        const prevSig = ruleCompareSignature(existing, sourceKey);
        const nextSig = ruleCompareSignature(nextRule, sourceKey);
        if (prevSig !== nextSig) {
          nextRule.updatedAt = nowIso;
          if (nextRules === scheduleRules) nextRules = scheduleRules.slice();
          nextRules[idx] = nextRule;
          changed = true;
        } else if (!existing.sourceKey && sourceKey) {
          if (nextRules === scheduleRules) nextRules = scheduleRules.slice();
          nextRules[idx] = { ...existing, sourceKey };
          changed = true;
        }
      } else {
        const created = {
          ...rule,
          id: rule.id || uid(),
          actionId,
          sourceKey,
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        if (nextRules === scheduleRules) nextRules = scheduleRules.slice();
        nextRules.push(created);
        changed = true;
      }
    }

    for (const entry of existingEntries) {
      const existing = entry.rule;
      const idx = entry.idx;
      const existingKey = existing?.sourceKey || buildScheduleRuleSourceKey(existing);
      if (existingKey && desiredKeys.has(existingKey)) continue;
      if (existing?.isActive === false) {
        if (!existing?.sourceKey && existingKey) {
          if (nextRules === scheduleRules) nextRules = scheduleRules.slice();
          nextRules[idx] = { ...existing, sourceKey: existingKey };
          changed = true;
        }
        continue;
      }
      if (nextRules === scheduleRules) nextRules = scheduleRules.slice();
      nextRules[idx] = {
        ...existing,
        sourceKey: existingKey || existing?.sourceKey || "",
        isActive: false,
        updatedAt: nowIso,
      };
      changed = true;
    }
  }

  if (!changed) return state;
  return { ...state, scheduleRules: nextRules };
}

export function getDefaultOccurrenceWindowBounds(referenceKey) {
  const baseKey = normalizeLocalDateKey(referenceKey) || todayLocalKey();
  const baseDate = new Date(`${baseKey}T12:00:00`);
  const start = new Date(baseDate);
  start.setDate(start.getDate() - 7);
  const end = new Date(baseDate);
  end.setDate(end.getDate() + 14);
  return { fromKey: normalizeLocalDateKey(start) || baseKey, toKey: normalizeLocalDateKey(end) || baseKey };
}
