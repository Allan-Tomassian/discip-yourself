import { toLocalDateKey } from "../../utils/datetime";
import { buildNotificationDisplayCopy } from "./notificationDisplay";
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
    read: safeArray(source.read).map(normalizeHistoryEvent).filter(Boolean),
    cooldowns: normalizeCooldowns(source.cooldowns),
  };
}

export function recordNotificationDelivery({ history, candidate, channel, now, display = null }) {
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

  const hasDisplay = Object.keys(safeObject(display)).length > 0;
  const displayCopy = buildNotificationDisplayCopy(
    {
      ...candidate,
      ...(safeObject(display)),
    },
    { preferSourceCopy: hasDisplay },
  );

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
        title: displayCopy.title,
        body: displayCopy.body,
        ctaLabel: displayCopy.ctaLabel,
        scheduledFor: safeString(candidate?.scheduledFor),
        createdAt: safeString(candidate?.createdAt),
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

export function markNotificationsRead({ history, notificationIds = [], now } = {}) {
  const normalized = ensureNotificationHistory(history);
  const readAt = now instanceof Date && !Number.isNaN(now.getTime()) ? now.toISOString() : new Date().toISOString();
  const existing = new Set(normalized.read.map((event) => safeString(event.notificationId)).filter(Boolean));
  const nextRead = [...normalized.read];

  safeArray(notificationIds).forEach((value) => {
    const id = safeString(value);
    if (!id || existing.has(id)) return;
    existing.add(id);
    nextRead.push({ notificationId: id, readAt });
  });

  return {
    ...normalized,
    read: nextRead,
  };
}

function latestEventById(events, timestampKey) {
  return safeArray(events).reduce((acc, event) => {
    const id = safeString(event?.notificationId);
    const timestamp = safeString(event?.[timestampKey]);
    if (!id || !timestamp) return acc;
    if (!acc[id] || timestamp > acc[id]) acc[id] = timestamp;
    return acc;
  }, {});
}

function compareDeliveredDesc(left, right) {
  return safeString(right?.deliveredAt).localeCompare(safeString(left?.deliveredAt));
}

export function buildNotificationCenterItems({ history, limit = 12 } = {}) {
  const normalized = ensureNotificationHistory(history);
  const clickedById = latestEventById(normalized.clicked, "clickedAt");
  const dismissedById = latestEventById(normalized.dismissed, "dismissedAt");
  const readById = latestEventById(normalized.read, "readAt");

  return [...normalized.delivered]
    .sort(compareDeliveredDesc)
    .slice(0, Math.max(0, Number.isFinite(limit) ? Math.trunc(limit) : 12))
    .map((event) => {
      const displayCopy = buildNotificationDisplayCopy(event, { preferSourceCopy: true });
      const id = safeString(event?.notificationId);
      const clickedAt = clickedById[id] || "";
      const dismissedAt = dismissedById[id] || "";
      const readAt = readById[id] || "";
      return {
        id,
        notificationId: id,
        type: safeString(event?.type),
        title: displayCopy.title,
        body: displayCopy.body,
        ctaLabel: displayCopy.ctaLabel,
        deliveredAt: safeString(event?.deliveredAt),
        targetRoute: safeString(event?.targetRoute),
        targetType: safeString(event?.targetType),
        targetId: safeString(event?.targetId),
        clickedAt,
        dismissedAt,
        readAt,
        status: clickedAt ? "clicked" : dismissedAt ? "dismissed" : readAt ? "read" : "unread",
      };
    });
}

export function getUnreadNotificationCount(history, { limit = 12 } = {}) {
  return buildNotificationCenterItems({ history, limit }).filter((item) => item.status === "unread").length;
}
