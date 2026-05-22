import { describe, expect, it } from "vitest";
import { applyNotificationPolicy } from "./notificationPolicy";
import { buildDefaultNotificationPreferences } from "./notificationPreferences";
import { NOTIFICATION_PRIORITY, NOTIFICATION_TYPE } from "./notificationTypes";

const NOW = new Date("2026-05-22T09:00:00");

function candidate(overrides = {}) {
  return {
    id: "block_start_now:occ-1:2026-05-22",
    type: NOTIFICATION_TYPE.BLOCK_START_NOW,
    priority: NOTIFICATION_PRIORITY.HIGH,
    title: "C’est le moment",
    body: "Démarre le bloc ou ajuste le bloc.",
    targetRoute: "/session/occ-1",
    targetType: "occurrence",
    targetId: "occ-1",
    scheduledFor: NOW.toISOString(),
    cooldownKey: "block_start_now:occ-1",
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("notificationPolicy", () => {
  it("allows useful candidates by default", () => {
    const result = applyNotificationPolicy({
      candidates: [candidate()],
      now: NOW,
      appVisibility: "hidden",
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.suppressed).toEqual([]);
  });

  it("suppresses all candidates when notifications are globally disabled", () => {
    const preferences = buildDefaultNotificationPreferences();
    preferences.enabled = false;

    const result = applyNotificationPolicy({
      candidates: [candidate()],
      preferences,
      now: NOW,
    });

    expect(result.candidates).toEqual([]);
    expect(result.suppressed[0].reason).toBe("notifications_disabled");
  });

  it("suppresses candidates over the max-per-day limit", () => {
    const history = {
      delivered: [
        { notificationId: "a", deliveredAt: NOW.toISOString() },
        { notificationId: "b", deliveredAt: NOW.toISOString() },
        { notificationId: "c", deliveredAt: NOW.toISOString() },
      ],
      dismissed: [],
      clicked: [],
      cooldowns: {},
    };

    const result = applyNotificationPolicy({
      candidates: [candidate()],
      history,
      now: NOW,
    });

    expect(result.candidates).toEqual([]);
    expect(result.suppressed[0].reason).toBe("max_per_day_reached");
  });

  it("suppresses non-critical candidates during quiet hours", () => {
    const result = applyNotificationPolicy({
      candidates: [candidate()],
      now: new Date("2026-05-22T23:00:00"),
    });

    expect(result.candidates).toEqual([]);
    expect(result.suppressed[0].reason).toBe("quiet_hours");
  });

  it("keeps critical candidates during quiet hours", () => {
    const result = applyNotificationPolicy({
      candidates: [candidate({ priority: NOTIFICATION_PRIORITY.CRITICAL })],
      now: new Date("2026-05-22T23:00:00"),
    });

    expect(result.candidates).toHaveLength(1);
  });

  it("suppresses duplicate candidates by cooldown key", () => {
    const result = applyNotificationPolicy({
      candidates: [candidate()],
      history: {
        delivered: [],
        dismissed: [],
        clicked: [],
        cooldowns: {
          "block_start_now:occ-1": { lastAt: NOW.toISOString(), count: 1 },
        },
      },
      now: NOW,
    });

    expect(result.candidates).toEqual([]);
    expect(result.suppressed[0].reason).toBe("cooldown");
  });

  it("suppresses candidates whose category preference is disabled", () => {
    const preferences = buildDefaultNotificationPreferences();
    preferences.blockReminders = false;

    const result = applyNotificationPolicy({
      candidates: [candidate()],
      preferences,
      now: NOW,
    });

    expect(result.candidates).toEqual([]);
    expect(result.suppressed[0].reason).toBe("blockReminders_disabled");
  });

  it("suppresses candidates when the visible app is already on the target route", () => {
    const result = applyNotificationPolicy({
      candidates: [candidate()],
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/session/occ-1",
    });

    expect(result.candidates).toEqual([]);
    expect(result.suppressed[0].reason).toBe("current_route");
  });

  it("suppresses guilt or shame copy", () => {
    const result = applyNotificationPolicy({
      candidates: [candidate({ title: "Tu es coupable", body: "Reprends." })],
      now: NOW,
    });

    expect(result.candidates).toEqual([]);
    expect(result.suppressed[0].reason).toBe("unsafe_copy");
  });
});

