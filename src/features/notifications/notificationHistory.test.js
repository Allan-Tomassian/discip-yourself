import { describe, expect, it } from "vitest";
import {
  clickNotification,
  buildNotificationCenterItems,
  dismissNotification,
  ensureNotificationHistory,
  getUnreadNotificationCount,
  markNotificationsRead,
  recordNotificationDelivery,
} from "./notificationHistory";
import { NOTIFICATION_CHANNEL, NOTIFICATION_PRIORITY, NOTIFICATION_TYPE } from "./notificationTypes";

const NOW = new Date("2026-05-22T09:00:00");

function candidate(overrides = {}) {
  return {
    id: "block_start_now:occ-1:2026-05-22",
    type: NOTIFICATION_TYPE.BLOCK_START_NOW,
    priority: NOTIFICATION_PRIORITY.HIGH,
    targetRoute: "/session/occ-1",
    targetType: "occurrence",
    targetId: "occ-1",
    title: "C’est le moment",
    body: "Démarre Deep work ou ajuste le bloc.",
    scheduledFor: NOW.toISOString(),
    createdAt: NOW.toISOString(),
    cooldownKey: "block_start_now:occ-1",
    sourceSignalIds: ["signal-1"],
    ...overrides,
  };
}

describe("notificationHistory", () => {
  it("normalizes malformed history", () => {
    const history = ensureNotificationHistory({
      delivered: [{ id: "legacy-id", deliveredAt: NOW.toISOString() }, {}],
      dismissed: "bad",
      clicked: [{ notificationId: "clicked-id" }],
      read: undefined,
      cooldowns: {
        "cooldown-1": { lastAt: NOW.toISOString(), count: 2 },
        "bad-cooldown": { lastAt: "not-date" },
      },
    });

    expect(history.delivered).toHaveLength(1);
    expect(history.delivered[0].notificationId).toBe("legacy-id");
    expect(history.dismissed).toEqual([]);
    expect(history.clicked).toHaveLength(1);
    expect(history.read).toEqual([]);
    expect(history.cooldowns["cooldown-1"]).toEqual({ lastAt: NOW.toISOString(), count: 2 });
    expect(history.cooldowns["bad-cooldown"]).toBeUndefined();
  });

  it("records delivered notifications and cooldowns without mutating history", () => {
    const original = ensureNotificationHistory();
    const history = recordNotificationDelivery({
      history: original,
      candidate: candidate(),
      channel: NOTIFICATION_CHANNEL.IN_APP,
      now: NOW,
    });

    expect(original.delivered).toEqual([]);
    expect(history.delivered).toHaveLength(1);
    expect(history.delivered[0]).toMatchObject({
      notificationId: "block_start_now:occ-1:2026-05-22",
      channel: NOTIFICATION_CHANNEL.IN_APP,
      deliveredDateKey: "2026-05-22",
      targetId: "occ-1",
      title: "C’est le moment",
      body: "Lance ton bloc.",
      scheduledFor: NOW.toISOString(),
      createdAt: NOW.toISOString(),
    });
    expect(history.cooldowns["block_start_now:occ-1"]).toEqual({ lastAt: NOW.toISOString(), count: 1 });
  });

  it("records dismissed and clicked notifications", () => {
    const delivered = recordNotificationDelivery({
      history: ensureNotificationHistory(),
      candidate: candidate(),
      channel: NOTIFICATION_CHANNEL.IN_APP,
      now: NOW,
    });
    const dismissed = dismissNotification({ history: delivered, notificationId: candidate().id, now: NOW });
    const clicked = clickNotification({ history: dismissed, notificationId: candidate().id, now: NOW });

    expect(clicked.dismissed[0]).toEqual({ notificationId: candidate().id, dismissedAt: NOW.toISOString() });
    expect(clicked.clicked[0]).toEqual({ notificationId: candidate().id, clickedAt: NOW.toISOString() });
  });

  it("marks notifications as read without duplicates", () => {
    const history = markNotificationsRead({
      history: ensureNotificationHistory(),
      notificationIds: ["a", "a", "b", ""],
      now: NOW,
    });
    const repeated = markNotificationsRead({
      history,
      notificationIds: ["a"],
      now: NOW,
    });

    expect(history.read).toEqual([
      { notificationId: "a", readAt: NOW.toISOString() },
      { notificationId: "b", readAt: NOW.toISOString() },
    ]);
    expect(repeated.read).toHaveLength(2);
  });

  it("builds recent center items from stored metadata and fallback copy", () => {
    const delivered = recordNotificationDelivery({
      history: ensureNotificationHistory(),
      candidate: candidate({ title: "", body: "" }),
      channel: NOTIFICATION_CHANNEL.IN_APP,
      now: NOW,
      display: { title: "Toast compact", body: "Copie courte.", ctaLabel: "Voir" },
    });
    const legacy = {
      ...delivered,
      delivered: [
        ...delivered.delivered,
        {
          notificationId: "legacy-empty-day",
          type: NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY,
          deliveredAt: "2026-05-22T06:00:00.000Z",
          targetRoute: "/coach",
        },
      ],
    };

    const items = buildNotificationCenterItems({ history: legacy });

    expect(items.find((entry) => entry.notificationId === candidate().id)).toMatchObject({
      notificationId: candidate().id,
      title: "Toast compact",
      body: "Copie courte.",
      ctaLabel: "Voir",
      status: "unread",
    });
    expect(items.find((entry) => entry.notificationId === "legacy-empty-day")).toMatchObject({
      notificationId: "legacy-empty-day",
      title: "Prochain bloc",
      body: "Ta journée a un espace libre.",
      ctaLabel: "Créer",
    });
  });

  it("excludes clicked, dismissed, and read notifications from unread count", () => {
    const delivered = {
      delivered: [
        { notificationId: "unread", type: NOTIFICATION_TYPE.BLOCK_START_NOW, deliveredAt: NOW.toISOString() },
        { notificationId: "clicked", type: NOTIFICATION_TYPE.BLOCK_START_NOW, deliveredAt: NOW.toISOString() },
        { notificationId: "dismissed", type: NOTIFICATION_TYPE.BLOCK_START_NOW, deliveredAt: NOW.toISOString() },
        { notificationId: "read", type: NOTIFICATION_TYPE.BLOCK_START_NOW, deliveredAt: NOW.toISOString() },
      ],
      clicked: [{ notificationId: "clicked", clickedAt: NOW.toISOString() }],
      dismissed: [{ notificationId: "dismissed", dismissedAt: NOW.toISOString() }],
      read: [{ notificationId: "read", readAt: NOW.toISOString() }],
      cooldowns: {},
    };

    expect(getUnreadNotificationCount(delivered)).toBe(1);
  });
});
