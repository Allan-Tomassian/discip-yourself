export const NOTIFICATION_TYPE = Object.freeze({
  BLOCK_START_SOON: "block_start_soon",
  BLOCK_START_NOW: "block_start_now",
  BLOCK_OVERDUE_RECOVERY: "block_overdue_recovery",
  EMPTY_DAY_WITH_AVAILABILITY: "empty_day_with_availability",
  MISSED_BLOCK_RECOVERY: "missed_block_recovery",
});

export const NOTIFICATION_PRIORITY = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

export const NOTIFICATION_CHANNEL = Object.freeze({
  IN_APP: "in_app",
  PUSH: "push",
  IOS_LOCAL: "ios_local",
  IOS_REMOTE: "ios_remote",
  NONE: "none",
});

export const NOTIFICATION_PREFERENCE_KEY = Object.freeze({
  BLOCK_REMINDERS: "blockReminders",
  RECOVERY_NUDGES: "recoveryNudges",
  DAY_PLANNING_NUDGES: "dayPlanningNudges",
});

export const NOTIFICATION_TYPE_PREFERENCE_KEY = Object.freeze({
  [NOTIFICATION_TYPE.BLOCK_START_SOON]: NOTIFICATION_PREFERENCE_KEY.BLOCK_REMINDERS,
  [NOTIFICATION_TYPE.BLOCK_START_NOW]: NOTIFICATION_PREFERENCE_KEY.BLOCK_REMINDERS,
  [NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY]: NOTIFICATION_PREFERENCE_KEY.RECOVERY_NUDGES,
  [NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY]: NOTIFICATION_PREFERENCE_KEY.RECOVERY_NUDGES,
  [NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY]: NOTIFICATION_PREFERENCE_KEY.DAY_PLANNING_NUDGES,
});

export const NOTIFICATION_TARGET_TYPE = Object.freeze({
  OCCURRENCE: "occurrence",
  DAY: "day",
  SYSTEM: "system",
});

export const NOTIFICATION_PRIORITY_RANK = Object.freeze({
  [NOTIFICATION_PRIORITY.LOW]: 1,
  [NOTIFICATION_PRIORITY.MEDIUM]: 2,
  [NOTIFICATION_PRIORITY.HIGH]: 3,
  [NOTIFICATION_PRIORITY.CRITICAL]: 4,
});

const NOTIFICATION_TYPES = new Set(Object.values(NOTIFICATION_TYPE));
const NOTIFICATION_PRIORITIES = new Set(Object.values(NOTIFICATION_PRIORITY));
const NOTIFICATION_CHANNELS = new Set(Object.values(NOTIFICATION_CHANNEL));

export function isNotificationType(value) {
  return NOTIFICATION_TYPES.has(value);
}

export function normalizeNotificationType(value) {
  return isNotificationType(value) ? value : "";
}

export function normalizeNotificationPriority(value, fallback = NOTIFICATION_PRIORITY.MEDIUM) {
  return NOTIFICATION_PRIORITIES.has(value) ? value : fallback;
}

export function normalizeNotificationChannel(value, fallback = NOTIFICATION_CHANNEL.NONE) {
  return NOTIFICATION_CHANNELS.has(value) ? value : fallback;
}

export function getNotificationTypePreferenceKey(type) {
  return NOTIFICATION_TYPE_PREFERENCE_KEY[normalizeNotificationType(type)] || "";
}

