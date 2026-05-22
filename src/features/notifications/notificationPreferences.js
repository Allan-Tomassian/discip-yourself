import { normalizeStartTime } from "../../utils/datetime";
import { NOTIFICATION_CHANNEL } from "./notificationTypes";

const DEFAULT_QUIET_HOURS = Object.freeze({
  enabled: true,
  start: "22:00",
  end: "08:00",
});

const DEFAULT_CHANNELS = Object.freeze({
  [NOTIFICATION_CHANNEL.IN_APP]: true,
  [NOTIFICATION_CHANNEL.PUSH]: false,
  [NOTIFICATION_CHANNEL.IOS_LOCAL]: false,
  [NOTIFICATION_CHANNEL.IOS_REMOTE]: false,
});

const DEFAULT_MAX_PER_DAY = 3;
const MAX_REASONABLE_PER_DAY = 10;

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeMaxPerDay(value) {
  if (!Number.isFinite(value)) return DEFAULT_MAX_PER_DAY;
  return Math.max(0, Math.min(MAX_REASONABLE_PER_DAY, Math.trunc(value)));
}

function normalizeQuietHours(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: normalizeBoolean(source.enabled, DEFAULT_QUIET_HOURS.enabled),
    start: normalizeStartTime(source.start) || DEFAULT_QUIET_HOURS.start,
    end: normalizeStartTime(source.end) || DEFAULT_QUIET_HOURS.end,
  };
}

function normalizeChannels(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    [NOTIFICATION_CHANNEL.IN_APP]: normalizeBoolean(
      source[NOTIFICATION_CHANNEL.IN_APP],
      DEFAULT_CHANNELS[NOTIFICATION_CHANNEL.IN_APP],
    ),
    [NOTIFICATION_CHANNEL.PUSH]: normalizeBoolean(source[NOTIFICATION_CHANNEL.PUSH], DEFAULT_CHANNELS[NOTIFICATION_CHANNEL.PUSH]),
    [NOTIFICATION_CHANNEL.IOS_LOCAL]: normalizeBoolean(
      source[NOTIFICATION_CHANNEL.IOS_LOCAL],
      DEFAULT_CHANNELS[NOTIFICATION_CHANNEL.IOS_LOCAL],
    ),
    [NOTIFICATION_CHANNEL.IOS_REMOTE]: normalizeBoolean(
      source[NOTIFICATION_CHANNEL.IOS_REMOTE],
      DEFAULT_CHANNELS[NOTIFICATION_CHANNEL.IOS_REMOTE],
    ),
  };
}

export function buildDefaultNotificationPreferences() {
  return {
    enabled: true,
    blockReminders: true,
    recoveryNudges: true,
    dayPlanningNudges: true,
    quietHours: { ...DEFAULT_QUIET_HOURS },
    maxPerDay: DEFAULT_MAX_PER_DAY,
    channels: { ...DEFAULT_CHANNELS },
  };
}

export function ensureNotificationPreferences(raw) {
  const defaults = buildDefaultNotificationPreferences();
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    enabled: normalizeBoolean(source.enabled, defaults.enabled),
    blockReminders: normalizeBoolean(source.blockReminders, defaults.blockReminders),
    recoveryNudges: normalizeBoolean(source.recoveryNudges, defaults.recoveryNudges),
    dayPlanningNudges: normalizeBoolean(source.dayPlanningNudges, defaults.dayPlanningNudges),
    quietHours: normalizeQuietHours(source.quietHours),
    maxPerDay: normalizeMaxPerDay(source.maxPerDay),
    channels: normalizeChannels(source.channels),
  };
}

