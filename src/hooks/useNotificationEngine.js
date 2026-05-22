import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildNotificationCandidates } from "../features/notifications/notificationCandidates";
import { chooseNotificationChannel } from "../features/notifications/notificationChannels";
import {
  clickNotification,
  dismissNotification,
  recordNotificationDelivery,
} from "../features/notifications/notificationHistory";
import { ensureNotificationPreferences } from "../features/notifications/notificationPreferences";
import { applyNotificationPolicy } from "../features/notifications/notificationPolicy";
import { NOTIFICATION_CHANNEL, NOTIFICATION_TYPE } from "../features/notifications/notificationTypes";

const DEFAULT_ENGINE_POLL_MS = 60_000;
const ACTIVE_SESSION_PHASES = new Set(["in_progress", "paused"]);
const LEGACY_REMINDER_DUPLICATE_TYPES = new Set([
  NOTIFICATION_TYPE.BLOCK_START_SOON,
  NOTIFICATION_TYPE.BLOCK_START_NOW,
]);

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeVisibility(value) {
  return value === "hidden" ? "hidden" : "visible";
}

function getDocumentVisibility() {
  if (typeof document === "undefined") return "visible";
  return normalizeVisibility(document.visibilityState);
}

function tabToCurrentRoute(tab) {
  const normalized = safeString(tab);
  if (!normalized || normalized === "today" || normalized === "home") return "/";
  if (normalized === "timeline" || normalized === "planning") return "/timeline";
  if (normalized === "adjust" || normalized === "insights" || normalized === "pilotage") return "/adjust";
  if (normalized === "coach") return "/coach";
  if (normalized === "session") return "/session";
  return `/${normalized}`;
}

function getActiveSession(data) {
  const activeSession = data?.ui?.activeSession || data?.activeSession || null;
  return activeSession && typeof activeSession === "object" ? activeSession : null;
}

function getActiveSessionOccurrenceId(data) {
  const activeSession = getActiveSession(data);
  return safeString(activeSession?.occurrenceId) || safeString(activeSession?.occurrence?.id);
}

function isOpenActiveSession(data) {
  const activeSession = getActiveSession(data);
  if (!activeSession) return false;
  const phase = safeString(activeSession.runtimePhase).toLowerCase();
  if (ACTIVE_SESSION_PHASES.has(phase)) return true;
  if (safeString(activeSession.status).toLowerCase() === "partial") return true;
  return activeSession.timerRunning === true;
}

function filterActiveSessionCandidates(candidates, data) {
  if (!isOpenActiveSession(data)) return candidates;
  const activeOccurrenceId = getActiveSessionOccurrenceId(data);
  if (!activeOccurrenceId) return [];
  return candidates.filter((candidate) => candidate?.targetType === "occurrence" && candidate?.targetId === activeOccurrenceId);
}

function filterLegacyReminderDuplicates(candidates, activeReminder) {
  if (!activeReminder) return candidates;
  return candidates.filter((candidate) => !LEGACY_REMINDER_DUPLICATE_TYPES.has(candidate?.type));
}

function filterSuppressedIds(candidates, suppressedIds) {
  if (!suppressedIds?.size) return candidates;
  return candidates.filter((candidate) => !suppressedIds.has(candidate?.id));
}

export function buildInAppNudgeModel({ candidate, channel = NOTIFICATION_CHANNEL.IN_APP } = {}) {
  if (!candidate || typeof candidate !== "object") return null;
  const type = candidate.type;
  const minutesUntilStart = (() => {
    const scheduled = Date.parse(candidate.scheduledFor);
    const created = Date.parse(candidate.createdAt);
    if (!Number.isFinite(scheduled) || !Number.isFinite(created)) return null;
    const minutes = Math.round((scheduled - created) / 60_000);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  })();
  const displayCopy = {
    [NOTIFICATION_TYPE.EMPTY_DAY_WITH_AVAILABILITY]: {
      title: "Prochain bloc",
      body: "Ta journée a un espace libre.",
      ctaLabel: "Créer",
    },
    [NOTIFICATION_TYPE.BLOCK_START_SOON]: {
      title: "Bloc bientôt prêt",
      body: minutesUntilStart ? `Commence dans ${minutesUntilStart} min.` : "Commence bientôt.",
      ctaLabel: "Voir",
    },
    [NOTIFICATION_TYPE.BLOCK_START_NOW]: {
      title: "C’est le moment",
      body: "Lance ton bloc.",
      ctaLabel: "Démarrer",
    },
    [NOTIFICATION_TYPE.BLOCK_OVERDUE_RECOVERY]: {
      title: "Bloc à récupérer",
      body: "Passe en version courte.",
      ctaLabel: "Ajuster",
    },
    [NOTIFICATION_TYPE.MISSED_BLOCK_RECOVERY]: {
      title: "Bloc manqué",
      body: "Reprends sans dette.",
      ctaLabel: "Ajuster",
    },
  }[type] || {
    title: candidate.title,
    body: candidate.body,
    ctaLabel: "Ouvrir",
  };

  return {
    id: candidate.id,
    type,
    priority: candidate.priority,
    title: displayCopy.title,
    body: displayCopy.body,
    ctaLabel: displayCopy.ctaLabel,
    targetRoute: candidate.targetRoute,
    targetType: candidate.targetType,
    targetId: candidate.targetId,
    channel,
    candidate,
  };
}

export function resolveNotificationTargetNavigation(candidate) {
  const route = safeString(candidate?.targetRoute);
  if (!route) return null;

  if (route.startsWith("/session")) {
    const occurrenceId = route.split("/").filter(Boolean)[1] || safeString(candidate?.targetId);
    return {
      tab: "session",
      options: {
        sessionOccurrenceId: occurrenceId || null,
        sessionCategoryId: null,
        sessionDateKey: null,
      },
    };
  }
  if (route.startsWith("/adjust")) return { tab: "adjust", options: {} };
  if (route.startsWith("/coach")) return { tab: "coach", options: {} };
  if (route.startsWith("/timeline") || route.startsWith("/planning")) return { tab: "timeline", options: {} };
  if (route === "/" || route.startsWith("/home") || route.startsWith("/today")) return { tab: "today", options: {} };

  return null;
}

export function createNotificationEngineModel({
  data = {},
  now = new Date(),
  appVisibility = "visible",
  currentRoute = "/",
  platformCapabilities = { in_app: true },
  activeReminder = null,
  suppressedIds = new Set(),
  enabled = true,
} = {}) {
  if (!enabled) {
    return {
      candidates: [],
      allowedCandidates: [],
      selectedCandidate: null,
      selectedChannel: NOTIFICATION_CHANNEL.NONE,
      nudge: null,
      policy: { candidates: [], suppressed: [] },
    };
  }

  const preferences = ensureNotificationPreferences(data?.notification_preferences_v1);
  const builtCandidates = buildNotificationCandidates({ state: data, now });
  const runtimeCandidates = filterSuppressedIds(
    filterLegacyReminderDuplicates(filterActiveSessionCandidates(builtCandidates, data), activeReminder),
    suppressedIds,
  );
  const policy = applyNotificationPolicy({
    candidates: runtimeCandidates,
    preferences,
    history: data?.notification_history_v1,
    now,
    appVisibility,
    currentRoute,
  });

  const selectedCandidate =
    policy.candidates.find((candidate) => {
      const channel = chooseNotificationChannel({
        candidate,
        platformCapabilities,
        appVisibility,
        preferences,
      });
      return channel === NOTIFICATION_CHANNEL.IN_APP;
    }) || null;
  const selectedChannel = selectedCandidate ? NOTIFICATION_CHANNEL.IN_APP : NOTIFICATION_CHANNEL.NONE;

  return {
    candidates: builtCandidates,
    allowedCandidates: policy.candidates,
    selectedCandidate,
    selectedChannel,
    nudge: buildInAppNudgeModel({ candidate: selectedCandidate, channel: selectedChannel }),
    policy,
  };
}

function persistNotificationHistory(setData, updater) {
  if (typeof setData !== "function") return;
  setData((previous) => {
    const safePrevious = previous && typeof previous === "object" ? previous : {};
    return {
      ...safePrevious,
      notification_history_v1: updater(safePrevious.notification_history_v1),
    };
  });
}

export function useNotificationEngine({
  data = {},
  setData,
  tab = "today",
  setTab,
  activeReminder = null,
  enabled = true,
  now: fixedNow = null,
  pollMs = DEFAULT_ENGINE_POLL_MS,
  appVisibility: appVisibilityOverride = null,
} = {}) {
  const [engineNow, setEngineNow] = useState(() =>
    fixedNow instanceof Date && !Number.isNaN(fixedNow.getTime()) ? fixedNow : new Date(),
  );
  const [appVisibility, setAppVisibility] = useState(() => appVisibilityOverride || getDocumentVisibility());
  const [activeNudge, setActiveNudge] = useState(null);
  const [suppressedIds, setSuppressedIds] = useState(() => new Set());
  const deliveredKeysRef = useRef(new Set());

  useEffect(() => {
    if (fixedNow instanceof Date && !Number.isNaN(fixedNow.getTime())) {
      setEngineNow(fixedNow);
    }
  }, [fixedNow]);

  useEffect(() => {
    if (fixedNow || !pollMs || typeof window === "undefined") return undefined;
    const id = window.setInterval(() => setEngineNow(new Date()), pollMs);
    return () => window.clearInterval(id);
  }, [fixedNow, pollMs]);

  useEffect(() => {
    if (appVisibilityOverride) {
      setAppVisibility(normalizeVisibility(appVisibilityOverride));
      return undefined;
    }
    if (typeof document === "undefined") return undefined;
    const update = () => setAppVisibility(getDocumentVisibility());
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [appVisibilityOverride]);

  const currentRoute = tabToCurrentRoute(tab);
  const model = useMemo(
    () =>
      createNotificationEngineModel({
        data,
        now: engineNow,
        appVisibility,
        currentRoute,
        platformCapabilities: { in_app: true },
        activeReminder,
        suppressedIds,
        enabled,
      }),
    [activeReminder, appVisibility, currentRoute, data, enabled, engineNow, suppressedIds],
  );

  useEffect(() => {
    if (!enabled) {
      setActiveNudge(null);
      return;
    }

    if (activeNudge) return;
    const nudge = model.nudge;
    if (!nudge?.candidate || model.selectedChannel !== NOTIFICATION_CHANNEL.IN_APP) return;

    const deliveryKey = `${nudge.id}:${model.selectedChannel}`;
    setActiveNudge(nudge);
    if (deliveredKeysRef.current.has(deliveryKey)) return;
    deliveredKeysRef.current.add(deliveryKey);
    persistNotificationHistory(setData, (history) =>
      recordNotificationDelivery({
        history,
        candidate: nudge.candidate,
        channel: model.selectedChannel,
        now: engineNow,
      }),
    );
  }, [activeNudge, enabled, engineNow, model.nudge, model.selectedChannel, setData]);

  const visibleNudge = activeNudge || model.nudge;

  const dismissNudge = useCallback(() => {
    const nudge = activeNudge || model.nudge;
    if (!nudge?.id) return;
    setSuppressedIds((previous) => new Set([...previous, nudge.id]));
    setActiveNudge(null);
    persistNotificationHistory(setData, (history) =>
      dismissNotification({
        history,
        notificationId: nudge.id,
        now: engineNow,
      }),
    );
  }, [activeNudge, engineNow, model.nudge, setData]);

  const clickNudge = useCallback(() => {
    const nudge = activeNudge || model.nudge;
    if (!nudge?.id) return;
    setSuppressedIds((previous) => new Set([...previous, nudge.id]));
    setActiveNudge(null);
    persistNotificationHistory(setData, (history) =>
      clickNotification({
        history,
        notificationId: nudge.id,
        now: engineNow,
      }),
    );

    const target = resolveNotificationTargetNavigation(nudge.candidate || nudge);
    if (target && typeof setTab === "function") {
      setTab(target.tab, target.options);
    }
  }, [activeNudge, engineNow, model.nudge, setData, setTab]);

  return {
    nudge: visibleNudge,
    selectedCandidate: visibleNudge?.candidate || null,
    selectedChannel: visibleNudge?.channel || NOTIFICATION_CHANNEL.NONE,
    dismissNudge,
    clickNudge,
    policy: model.policy,
    candidates: model.candidates,
  };
}
