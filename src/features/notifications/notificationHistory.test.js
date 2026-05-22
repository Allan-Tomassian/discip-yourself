import { describe, expect, it } from "vitest";
import {
  clickNotification,
  dismissNotification,
  ensureNotificationHistory,
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
      cooldowns: {
        "cooldown-1": { lastAt: NOW.toISOString(), count: 2 },
        "bad-cooldown": { lastAt: "not-date" },
      },
    });

    expect(history.delivered).toHaveLength(1);
    expect(history.delivered[0].notificationId).toBe("legacy-id");
    expect(history.dismissed).toEqual([]);
    expect(history.clicked).toHaveLength(1);
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
});

