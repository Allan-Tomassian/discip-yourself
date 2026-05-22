import { ensureNotificationHistory } from "./notificationHistory";
import { ensureNotificationPreferences } from "./notificationPreferences";
import {
  getNotificationTypePreferenceKey,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_PRIORITY_RANK,
  NOTIFICATION_TYPE,
} from "./notificationTypes";
import { normalizeLocalDateKey, parseTimeToMinutes, toLocalDateKey } from "../../utils/datetime";

const UNSAFE_COPY_RE = /\b(honte|coupable|paresseux|fain[eé]ant|nul|faute)\b/i;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeVisibility(value) {
  return value === "hidden" ? "hidden" : "visible";
}

function getEventDateKey(event) {
  return (
    normalizeLocalDateKey(event?.deliveredDateKey) ||
    normalizeLocalDateKey(event?.deliveredAt) ||
    normalizeLocalDateKey(event?.createdAt) ||
    ""
  );
}

function getNowDateKey(now) {
  const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return toLocalDateKey(current);
}

function countDeliveredToday(history, now) {
  const todayKey = getNowDateKey(now);
  return history.delivered.filter((event) => getEventDateKey(event) === todayKey).length;
}

function isQuietHours(now, quietHours) {
  if (!quietHours?.enabled) return false;
  const start = parseTimeToMinutes(quietHours.start);
  const end = parseTimeToMinutes(quietHours.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return false;

  const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const minutes = current.getHours() * 60 + current.getMinutes();
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function hasCooldownForToday(history, candidate, now) {
  const cooldownKey = safeString(candidate?.cooldownKey);
  if (!cooldownKey) return false;
  const cooldown = history.cooldowns[cooldownKey];
  if (!cooldown?.lastAt) return false;
  return normalizeLocalDateKey(cooldown.lastAt) === getNowDateKey(now);
}

function hasUnsafeCopy(candidate) {
  return UNSAFE_COPY_RE.test(`${safeString(candidate?.title)} ${safeString(candidate?.body)} ${safeString(candidate?.reason)}`);
}

function normalizeRoute(route) {
  const raw = safeString(route);
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function isSameRouteContext(candidateRoute, currentRoute) {
  const target = normalizeRoute(candidateRoute);
  const current = normalizeRoute(currentRoute);
  if (!target || !current) return false;
  if (target === current) return true;
  if (target.startsWith("/session") && current.startsWith("/session")) return true;
  if (target.startsWith("/adjust") && current.startsWith("/adjust")) return true;
  if (target.startsWith("/coach") && current.startsWith("/coach")) return true;
  if ((target.startsWith("/planning") || target.startsWith("/timeline")) && (current.startsWith("/planning") || current.startsWith("/timeline"))) {
    return true;
  }
  return false;
}

function sortCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    const priorityDiff = (NOTIFICATION_PRIORITY_RANK[b.priority] || 0) - (NOTIFICATION_PRIORITY_RANK[a.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return safeString(a.scheduledFor).localeCompare(safeString(b.scheduledFor));
  });
}

function suppress(suppressed, candidate, reason) {
  suppressed.push({ candidate, reason });
}

export function applyNotificationPolicy({
  candidates = [],
  preferences = null,
  history = null,
  now = new Date(),
  appVisibility = "visible",
  currentRoute = "",
} = {}) {
  const normalizedPreferences = ensureNotificationPreferences(preferences);
  const normalizedHistory = ensureNotificationHistory(history);
  const suppressed = [];

  if (normalizedPreferences.enabled !== true) {
    safeArray(candidates).forEach((candidate) => suppress(suppressed, candidate, "notifications_disabled"));
    return { candidates: [], suppressed };
  }

  const visible = normalizeVisibility(appVisibility) === "visible";
  const deliveredToday = countDeliveredToday(normalizedHistory, now);
  let remainingToday = Math.max(0, normalizedPreferences.maxPerDay - deliveredToday);
  const seenCooldownKeys = new Set();
  const allowed = [];

  sortCandidates(safeArray(candidates)).forEach((candidate) => {
    const preferenceKey = getNotificationTypePreferenceKey(candidate?.type);
    const cooldownKey = safeString(candidate?.cooldownKey);

    if (!candidate || typeof candidate !== "object") {
      suppress(suppressed, candidate, "invalid_candidate");
      return;
    }
    if (remainingToday <= 0) {
      suppress(suppressed, candidate, "max_per_day_reached");
      return;
    }
    if (preferenceKey && normalizedPreferences[preferenceKey] !== true) {
      suppress(suppressed, candidate, `${preferenceKey}_disabled`);
      return;
    }
    if (isQuietHours(now, normalizedPreferences.quietHours) && candidate.priority !== NOTIFICATION_PRIORITY.CRITICAL) {
      suppress(suppressed, candidate, "quiet_hours");
      return;
    }
    if (cooldownKey && (seenCooldownKeys.has(cooldownKey) || hasCooldownForToday(normalizedHistory, candidate, now))) {
      suppress(suppressed, candidate, "cooldown");
      return;
    }
    if (visible && isSameRouteContext(candidate.targetRoute, currentRoute)) {
      suppress(suppressed, candidate, "current_route");
      return;
    }
    if (hasUnsafeCopy(candidate)) {
      suppress(suppressed, candidate, "unsafe_copy");
      return;
    }

    allowed.push(candidate);
    if (cooldownKey) seenCooldownKeys.add(cooldownKey);
    remainingToday -= 1;
  });

  return { candidates: allowed, suppressed };
}

export function isRecoveryNotificationType(type) {
  return type === NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY || type === NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY;
}

