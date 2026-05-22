import { describe, expect, it } from "vitest";
import { chooseNotificationChannel } from "./notificationChannels";
import { buildDefaultNotificationPreferences } from "./notificationPreferences";
import { NOTIFICATION_CHANNEL, NOTIFICATION_TYPE } from "./notificationTypes";

const candidate = {
  id: "candidate-1",
  type: NOTIFICATION_TYPE.BLOCK_START_NOW,
};

describe("notificationChannels", () => {
  it("selects in-app when the app is visible", () => {
    expect(chooseNotificationChannel({ candidate, appVisibility: "visible" })).toBe(NOTIFICATION_CHANNEL.IN_APP);
  });

  it("selects no channel when the app is hidden and no capabilities are supported", () => {
    expect(chooseNotificationChannel({ candidate, appVisibility: "hidden" })).toBe(NOTIFICATION_CHANNEL.NONE);
  });

  it("does not fake in-app delivery when the in-app capability is unavailable", () => {
    expect(
      chooseNotificationChannel({
        candidate,
        appVisibility: "visible",
        platformCapabilities: { in_app: false },
      }),
    ).toBe(NOTIFICATION_CHANNEL.NONE);
  });

  it("selects push only when hidden, supported, and enabled", () => {
    const preferences = buildDefaultNotificationPreferences();
    preferences.channels.push = true;

    expect(
      chooseNotificationChannel({
        candidate,
        appVisibility: "hidden",
        preferences,
        platformCapabilities: { push: true },
      }),
    ).toBe(NOTIFICATION_CHANNEL.PUSH);
  });

  it("falls back to iOS placeholder channels only when explicitly enabled", () => {
    const preferences = buildDefaultNotificationPreferences();
    preferences.channels.in_app = false;
    preferences.channels.ios_local = true;

    expect(
      chooseNotificationChannel({
        candidate,
        appVisibility: "hidden",
        preferences,
        platformCapabilities: { ios_local: true },
      }),
    ).toBe(NOTIFICATION_CHANNEL.IOS_LOCAL);
  });
});
