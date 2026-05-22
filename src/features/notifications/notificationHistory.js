import { toLocalDateKey } from "../../utils/datetime";
import { normalizeNotificationChannel } from "./notificationTypes";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value) {
  const raw = safeString(value);
  if (!raw) return "";
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function normalizeHistoryEvent(event) {
  const source = safeObject(event);
  const notificationId = safeString(source.notificationId) || safeString(source.id) || safeString(source.candidateId);
  if (!notificationId) return null;
  return {
    ...source,
    notificationId,
  };
}

function normalizeCooldowns(raw) {
  const source = safeObject(raw);
  return Object.entries(source).reduce((acc, [key, value]) => {
    const cooldownKey = safeString(key);
    const item = safeObject(value);
    const lastAt = normalizeTimestamp(item.lastAt);
    if (!cooldownKey || !lastAt) return acc;
    acc[cooldownKey] = {
      lastAt,
      count: Number.isFinite(item.count) ? Math.max(0, Math.trunc(item.count)) : 1,
    };
    return acc;
  }, {});
}

export function ensureNotificationHistory(raw) {
  const source = safeObject(raw);
  return {
    delivered: safeArray(source.delivered).map(normalizeHistoryEvent).filter(Boolean),
    dismissed: safeArray(source.dismissed).map(normalizeHistoryEvent).filter(Boolean),
    clicked: safeArray(source.clicked).map(normalizeHistoryEvent).filter(Boolean),
    cooldowns: normalizeCooldowns(source.cooldowns),
  };
}

export function recordNotificationDelivery({ history, candidate, channel, now }) {
  const normalized = ensureNotificationHistory(history);
  const deliveredAt = now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const notificationId = safeString(candidate?.id);
  if (!notificationId) return normalized;

  const cooldownKey = safeString(candidate?.cooldownKey);
  const nextCooldowns = { ...normalized.cooldowns };
  if (cooldownKey) {
    nextCooldowns[cooldownKey] = {
      lastAt: deliveredAt,
      count: (nextCooldowns[cooldownKey]?.count || 0) + 1,
    };
  }

  return {
    ...normalized,
    delivered: [
      ...normalized.delivered,
      {
        notificationId,
        candidateId: notificationId,
        type: safeString(candidate?.type),
        priority: safeString(candidate?.priority),
        targetRoute: safeString(candidate?.targetRoute),
        targetType: safeString(candidate?.targetType),
        targetId: safeString(candidate?.targetId),
        sourceSignalIds: safeArray(candidate?.sourceSignalIds).map(safeString).filter(Boolean),
        channel: normalizeNotificationChannel(channel),
        cooldownKey,
        deliveredAt,
        deliveredDateKey: toLocalDateKey(new Date(deliveredAt)),
      },
    ],
    cooldowns: nextCooldowns,
  };
}

export function dismissNotification({ history, notificationId, now }) {
  const normalized = ensureNotificationHistory(history);
  const id = safeString(notificationId);
  if (!id) return normalized;
  const dismissedAt = now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : new Date().toISOString();
  return {
    ...normalized,
    dismissed: [...normalized.dismissed, { notificationId: id, dismissedAt }],
  };
}

export function clickNotification({ history, notificationId, now }) {
  const normalized = ensureNotificationHistory(history);
  const id = safeString(notificationId);
  if (!id) return normalized;
  const clickedAt = now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : new Date().toISOString();
  return {
    ...normalized,
    clicked: [...normalized.clicked, { notificationId: id, clickedAt }],
  };
}

