import { describe, expect, it } from "vitest";
import { buildDefaultNotificationPreferences, ensureNotificationPreferences } from "./notificationPreferences";
import { NOTIFICATION_CHANNEL } from "./notificationTypes";

describe("notificationPreferences", () => {
  it("builds safe default preferences", () => {
    const preferences = buildDefaultNotificationPreferences();

    expect(preferences.enabled).toBe(true);
    expect(preferences.blockReminders).toBe(true);
    expect(preferences.recoveryNudges).toBe(true);
    expect(preferences.dayPlanningNudges).toBe(true);
    expect(preferences.maxPerDay).toBe(3);
    expect(preferences.channels[NOTIFICATION_CHANNEL.IN_APP]).toBe(true);
    expect(preferences.channels[NOTIFICATION_CHANNEL.PUSH]).toBe(false);
    expect(preferences.channels[NOTIFICATION_CHANNEL.IOS_LOCAL]).toBe(false);
    expect(preferences.channels[NOTIFICATION_CHANNEL.IOS_REMOTE]).toBe(false);
  });

  it("normalizes malformed preferences without enabling native channels", () => {
    const preferences = ensureNotificationPreferences({
      enabled: "yes",
      blockReminders: false,
      recoveryNudges: "no",
      quietHours: { enabled: true, start: "25:00", end: "7:5" },
      maxPerDay: 99,
      channels: {
        in_app: false,
        push: "yes",
        ios_local: true,
      },
    });

    expect(preferences.enabled).toBe(true);
    expect(preferences.blockReminders).toBe(false);
    expect(preferences.recoveryNudges).toBe(true);
    expect(preferences.quietHours.start).toBe("22:00");
    expect(preferences.quietHours.end).toBe("07:05");
    expect(preferences.maxPerDay).toBe(10);
    expect(preferences.channels[NOTIFICATION_CHANNEL.IN_APP]).toBe(false);
    expect(preferences.channels[NOTIFICATION_CHANNEL.PUSH]).toBe(false);
    expect(preferences.channels[NOTIFICATION_CHANNEL.IOS_LOCAL]).toBe(true);
  });
});

