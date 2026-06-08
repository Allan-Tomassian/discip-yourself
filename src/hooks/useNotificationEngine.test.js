import { describe, expect, it } from "vitest";
import {
  buildInAppNudgeModel,
  createNotificationEngineModel,
  FIRST_HOME_NOTIFICATION_GRACE_FIELD,
  isFirstHomeNotificationGraceActive,
  NOTIFICATION_TOAST_AUTO_DISMISS_MS,
  NOTIFICATION_TOAST_DELAY_MS,
  resolveNotificationTargetNavigation,
} from "./useNotificationEngine";
import { NOTIFICATION_CHANNEL, NOTIFICATION_TYPE } from "../features/notifications/notificationTypes";

const DATE = "2026-05-22";
const NOW = new Date(`${DATE}T09:00:00`);

function occurrence(overrides = {}) {
  return {
    id: "occ-1",
    date: DATE,
    start: "09:00",
    status: "planned",
    title: "Deep work",
    ...overrides,
  };
}

function data(overrides = {}) {
  return {
    occurrences: [occurrence()],
    sessionHistory: [],
    ui: { activeSession: null },
    notification_preferences_v1: {
      enabled: true,
      blockReminders: true,
      recoveryNudges: true,
      dayPlanningNudges: true,
      quietHours: { enabled: false, start: "22:00", end: "08:00" },
      maxPerDay: 3,
      channels: { in_app: true, push: false, ios_local: false, ios_remote: false },
    },
    notification_history_v1: { delivered: [], dismissed: [], clicked: [], read: [], cooldowns: {} },
    ...overrides,
  };
}

describe("useNotificationEngine pure model", () => {
  it("builds and exposes one in-app nudge candidate", () => {
    const model = createNotificationEngineModel({
      data: data(),
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/",
    });

    expect(model.selectedChannel).toBe(NOTIFICATION_CHANNEL.IN_APP);
    expect(model.nudge).toMatchObject({
      type: NOTIFICATION_TYPE.BLOCK_START_NOW,
      title: "C’est le moment",
      body: "Lance ton bloc.",
      ctaLabel: "Démarrer",
      targetRoute: "/session/occ-1",
    });
  });

  it("suppresses during quiet hours through policy", () => {
    const model = createNotificationEngineModel({
      data: data({
        occurrences: [occurrence({ start: "23:00" })],
        notification_preferences_v1: {
          ...data().notification_preferences_v1,
          quietHours: { enabled: true, start: "22:00", end: "08:00" },
        },
      }),
      now: new Date(`${DATE}T23:00:00`),
      appVisibility: "visible",
      currentRoute: "/",
    });

    expect(model.nudge).toBeNull();
    expect(model.policy.suppressed[0].reason).toBe("quiet_hours");
  });

  it("suppresses when max per day is reached", () => {
    const model = createNotificationEngineModel({
      data: data({
        notification_history_v1: {
          delivered: [
            { notificationId: "a", deliveredAt: NOW.toISOString() },
            { notificationId: "b", deliveredAt: NOW.toISOString() },
            { notificationId: "c", deliveredAt: NOW.toISOString() },
          ],
          dismissed: [],
          clicked: [],
          read: [],
          cooldowns: {},
        },
      }),
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/",
    });

    expect(model.nudge).toBeNull();
    expect(model.policy.suppressed[0].reason).toBe("max_per_day_reached");
  });

  it("suppresses when the current route already handles the target state", () => {
    const model = createNotificationEngineModel({
      data: data(),
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/session/occ-1",
    });

    expect(model.nudge).toBeNull();
    expect(model.policy.suppressed[0].reason).toBe("current_route");
  });

  it("suppresses disabled preferences", () => {
    const model = createNotificationEngineModel({
      data: data({
        notification_preferences_v1: {
          ...data().notification_preferences_v1,
          blockReminders: false,
        },
      }),
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/",
    });

    expect(model.nudge).toBeNull();
    expect(model.policy.suppressed[0].reason).toBe("blockReminders_disabled");
  });

  it("does not select native or push channels for in-app V1B", () => {
    const model = createNotificationEngineModel({
      data: data(),
      now: NOW,
      appVisibility: "hidden",
      currentRoute: "/",
      platformCapabilities: { push: true, ios_local: true, ios_remote: true },
    });

    expect(model.selectedChannel).toBe(NOTIFICATION_CHANNEL.NONE);
    expect(model.nudge).toBeNull();
  });

  it("suppresses unrelated nudges while an active session is open", () => {
    const model = createNotificationEngineModel({
      data: data({
        ui: { activeSession: { occurrenceId: "other-occurrence", runtimePhase: "in_progress" } },
      }),
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/",
    });

    expect(model.nudge).toBeNull();
  });

  it("suppresses legacy reminder duplicates for block start notifications", () => {
    const model = createNotificationEngineModel({
      data: data(),
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/",
      activeReminder: { reminder: { goalId: "goal-1" } },
    });

    expect(model.nudge).toBeNull();
  });

  it("suppresses the first Home toast during first-run arrival grace without removing candidates", () => {
    const graceUntil = new Date(NOW.getTime() + 20_000).toISOString();
    const model = createNotificationEngineModel({
      data: data({
        ui: {
          activeSession: null,
          [FIRST_HOME_NOTIFICATION_GRACE_FIELD]: graceUntil,
        },
      }),
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/",
    });

    expect(isFirstHomeNotificationGraceActive({ ui: { [FIRST_HOME_NOTIFICATION_GRACE_FIELD]: graceUntil } }, NOW)).toBe(true);
    expect(model.toastGraceActive).toBe(true);
    expect(model.candidates.length).toBeGreaterThan(0);
    expect(model.allowedCandidates.length).toBeGreaterThan(0);
    expect(model.selectedCandidate).toBeNull();
    expect(model.selectedChannel).toBe(NOTIFICATION_CHANNEL.NONE);
    expect(model.nudge).toBeNull();
  });

  it("allows the notification toast after the first Home grace window expires", () => {
    const graceUntil = new Date(NOW.getTime() + 20_000).toISOString();
    const model = createNotificationEngineModel({
      data: data({
        ui: {
          activeSession: null,
          [FIRST_HOME_NOTIFICATION_GRACE_FIELD]: graceUntil,
        },
      }),
      now: new Date(NOW.getTime() + 21_000),
      appVisibility: "visible",
      currentRoute: "/",
    });

    expect(model.toastGraceActive).toBe(false);
    expect(model.nudge).toMatchObject({
      type: NOTIFICATION_TYPE.BLOCK_START_NOW,
    });
  });

  it("keeps normal recovery notifications active outside first Home grace", () => {
    const model = createNotificationEngineModel({
      data: data({
        occurrences: [occurrence({ start: "08:00" })],
      }),
      now: NOW,
      appVisibility: "visible",
      currentRoute: "/",
    });

    expect(model.toastGraceActive).toBe(false);
    expect(model.nudge).toMatchObject({
      type: NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY,
      title: "Bloc à récupérer",
    });
  });

  it("maps notification target routes to app navigation calls", () => {
    expect(resolveNotificationTargetNavigation({ targetRoute: "/session/occ-1", targetId: "occ-1" })).toEqual({
      tab: "session",
      options: {
        sessionOccurrenceId: "occ-1",
        sessionCategoryId: null,
        sessionDateKey: null,
      },
    });
    expect(resolveNotificationTargetNavigation({ targetRoute: "/adjust" })).toEqual({ tab: "adjust", options: {} });
    expect(resolveNotificationTargetNavigation({ targetRoute: "/coach" })).toEqual({ tab: "coach", options: {} });
    expect(resolveNotificationTargetNavigation({ targetRoute: "/unknown" })).toBeNull();
  });

  it("builds CTA labels from candidate type", () => {
    expect(
      buildInAppNudgeModel({
        candidate: {
          id: "1",
          type: NOTIFICATION_TYPE.BLOCK_START_SOON,
          scheduledFor: "2026-05-22T09:10:00.000Z",
          createdAt: "2026-05-22T09:00:00.000Z",
        },
      }),
    ).toMatchObject({
      title: "Bloc bientôt prêt",
      body: "Commence dans 10 min.",
      ctaLabel: "Voir",
    });
    expect(buildInAppNudgeModel({ candidate: { id: "2", type: NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY } }).ctaLabel).toBe(
      "Créer",
    );
    expect(buildInAppNudgeModel({ candidate: { id: "3", type: NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY } }).ctaLabel).toBe(
      "Ajuster",
    );
  });

  it("publishes toast timing constants for the hook presentation layer", () => {
    expect(NOTIFICATION_TOAST_DELAY_MS).toBe(1200);
    expect(NOTIFICATION_TOAST_AUTO_DISMISS_MS).toBe(5000);
  });

  it("compacts displayed copy without changing candidate payloads", () => {
    const empty = buildInAppNudgeModel({
      candidate: {
        id: "empty",
        type: NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY,
        title: "Construis ton prochain bloc",
        body: "Ta journée a un espace libre.",
      },
    });
    const overdue = buildInAppNudgeModel({
      candidate: {
        id: "overdue",
        type: NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY,
        title: "Bloc à récupérer",
        body: "Repars avec une version plus simple.",
      },
    });
    const missed = buildInAppNudgeModel({
      candidate: {
        id: "missed",
        type: NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY,
        title: "Bloc manqué",
        body: "Reprends sans dette avec un ajustement simple.",
      },
    });

    expect(empty).toMatchObject({ title: "Prochain bloc", body: "Ta journée a un espace libre.", ctaLabel: "Créer" });
    expect(empty.candidate.title).toBe("Construis ton prochain bloc");
    expect(overdue).toMatchObject({ title: "Bloc à récupérer", body: "Passe en version courte.", ctaLabel: "Ajuster" });
    expect(missed).toMatchObject({ title: "Bloc manqué", body: "Reprends sans dette.", ctaLabel: "Ajuster" });
  });
});
