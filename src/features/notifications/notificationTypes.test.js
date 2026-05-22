import { describe, expect, it } from "vitest";
import {
  getNotificationTypePreferenceKey,
  isNotificationType,
  normalizeNotificationChannel,
  normalizeNotificationPriority,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PREFERENCE_KEY,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
} from "./notificationTypes";

describe("notificationTypes", () => {
  it("recognizes supported notification types", () => {
    expect(isNotificationType(NOTIFICATION_TYPE.BLOCK_START_SOON)).toBe(true);
    expect(isNotificationType("legacy_reminder")).toBe(false);
  });

  it("maps notification types to preference categories", () => {
    expect(getNotificationTypePreferenceKey(NOTIFICATION_TYPE.BLOCK_START_NOW)).toBe(
      NOTIFICATION_PREFERENCE_KEY.BLOCK_REMINDERS,
    );
    expect(getNotificationTypePreferenceKey(NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY)).toBe(
      NOTIFICATION_PREFERENCE_KEY.RECOVERY_NUDGES,
    );
    expect(getNotificationTypePreferenceKey(NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY)).toBe(
      NOTIFICATION_PREFERENCE_KEY.DAY_PLANNING_NUDGES,
    );
  });

  it("normalizes priority and channel values", () => {
    expect(normalizeNotificationPriority("unknown")).toBe(NOTIFICATION_PRIORITY.MEDIUM);
    expect(normalizeNotificationPriority(NOTIFICATION_PRIORITY.CRITICAL)).toBe(NOTIFICATION_PRIORITY.CRITICAL);
    expect(normalizeNotificationChannel("unknown")).toBe(NOTIFICATION_CHANNEL.NONE);
    expect(normalizeNotificationChannel(NOTIFICATION_CHANNEL.IN_APP)).toBe(NOTIFICATION_CHANNEL.IN_APP);
  });
});

