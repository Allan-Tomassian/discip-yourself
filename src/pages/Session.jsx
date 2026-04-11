import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import FocusSessionView from "../components/session/FocusSessionView";
import SessionAdjustSheet from "../components/session/SessionAdjustSheet";
import SessionLaunchView from "../components/session/SessionLaunchView";
import SessionToolResultSheet from "../components/session/SessionToolResultSheet";
import SessionToolsSheet from "../components/session/SessionToolsSheet";
import SessionToolTray from "../components/session/SessionToolTray";
import { addDaysLocal, minutesToTimeStr, normalizeLocalDateKey, parseTimeToMinutes, todayLocalKey } from "../utils/datetime";
import { resolveExecutableOccurrence } from "../logic/sessionResolver";
import { updateOccurrence } from "../logic/occurrences";
import { applySessionRuntimeTransition, isRuntimeSessionOpen } from "../logic/sessionRuntime";
import { emitSessionRuntimeNotificationHook } from "../logic/sessionRuntimeNotifications";
import { resolveConflictNearest } from "../logic/occurrencePlanner";
import { normalizeActiveSessionForUI, normalizeOccurrenceForUI } from "../logic/compat";
import { withExecutionActiveCategoryId } from "../domain/categoryVisibility";
import { computeStreakDays } from "../logic/habits";
import { useBehaviorFeedback } from "../feedback/behaviorFeedbackStore";
import { deriveBehaviorFeedbackSignal, deriveSessionBehaviorCue } from "../feedback/feedbackDerivers";
import { AppCard, AppScreen, GhostButton } from "../shared/ui/app";
import { deriveActionProtocol } from "../features/action-protocol/actionProtocol";
import {
  buildSessionRunbookV1,
  normalizePreparedSessionRunbook,
  normalizeSessionBlueprintSnapshot,
  normalizeSessionRunbook,
} from "../features/session/sessionRunbook";
import {
  activateGuidedSpatialState,
  areGuidedSpatialStatesEqual,
  advanceGuidedSpatialStep,
  createGuidedSpatialState,
  deriveGuidedSpatialPlan,
  normalizeGuidedSpatialState,
  rebaseGuidedSpatialState,
  returnGuidedSpatialToActive,
  setGuidedSpatialViewedStep,
  syncGuidedSpatialStateWithElapsed,
  toggleGuidedSpatialChecklistItem,
} from "../features/session/sessionSpatialRuntime";
import {
  applyGuidedAdjustmentLocally,
  applyStandardAdjustmentLocally,
  buildGuidedAdjustmentOptions,
  buildStandardAdjustmentOptions,
  SESSION_ADJUST_CAUSES,
} from "../features/session/sessionAdjustments";
import {
  buildSessionToolPlan,
  createEmptySessionToolState,
  deriveActiveSessionToolUtilitySnapshot,
  deriveRecommendedSessionTools,
  executeLocalSessionTool,
  normalizePreparedSessionToolPlan,
  normalizePreparedSessionToolResult,
  normalizeSessionToolPlan,
  normalizeSessionToolState,
  pauseSessionToolUtility,
  resetSessionToolUtility,
  startSessionToolUtility,
  toggleSessionToolUtilityCollapse,
} from "../features/session/sessionTools";
import { requestAiSessionGuidance } from "../infra/aiSessionGuidanceClient";
import { saveState } from "../utils/storage";
import "../features/session/session.css";
import "../features/session/session-guided.css";

function formatElapsed(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalSec = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readOccurrenceIdFromPath() {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/session\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function roundUpToQuarterHour(base = new Date()) {
  const totalMinutes = base.getHours() * 60 + base.getMinutes();
  const rounded = Math.ceil((totalMinutes + 1) / 15) * 15;
  return minutesToTimeStr(Math.min(Math.max(rounded, 5 * 60), 22 * 60));
}

function resolveFinalViewState(session) {
  const phase = session?.runtimePhase || "";
  if (phase === "done") return "completed";
  if (phase === "blocked") return "blocked";
  if (phase === "reported") return "reported";
  return "completed";
}

function normalizePositiveMinutes(value, fallback = 1) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Math.max(1, Math.round(next));
}

function readSessionGuidanceRunbookPayload(payload, fallbackRunbook = null) {
  if (!payload || typeof payload !== "object") return null;
  return normalizePreparedSessionRunbook(
    payload.sessionRunbook || payload.runbook || payload,
    { fallbackRunbook }
  );
}

function readSessionGuidanceToolPlanPayload(payload, sessionRunbook = null) {
  if (!payload || typeof payload !== "object") return null;
  return normalizePreparedSessionToolPlan(payload.sessionToolPlan || payload.toolPlan || null, {
    sessionRunbook,
  });
}

function readSessionGuidanceToolResultPayload(payload, toolId = "") {
  if (!payload || typeof payload !== "object") return null;
  return normalizePreparedSessionToolResult(payload, { toolId });
}

function readGoalSessionNotes(goal) {
  return [goal?.notes, goal?.note, goal?.description, goal?.summary]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, 400);
}

function normalizeGuidedRuntimeSnapshot(rawValue, { occurrenceId = null } = {}) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : null;
  const sessionRunbook = normalizeSessionRunbook(source?.sessionRunbook || null);
  if (!sessionRunbook) return null;
  const guidedSpatialState = normalizeGuidedSpatialState(source?.guidedSpatialState || null, {
    sessionRunbook,
  });
  if (!guidedSpatialState) return null;
  return {
    version: 1,
    occurrenceId: source?.occurrenceId || occurrenceId || null,
    sessionRunbook,
    sessionToolPlan: normalizeSessionToolPlan(source?.sessionToolPlan || null, {
      sessionRunbook,
    }),
    guidedAdjustment: source?.guidedAdjustment || null,
    guidedSpatialState,
  };
}

function buildGuidedRuntimeSnapshot({
  occurrenceId = null,
  sessionRunbook = null,
  sessionToolPlan = null,
  guidedAdjustment = null,
  guidedSpatialState = null,
} = {}) {
  return normalizeGuidedRuntimeSnapshot(
    {
      version: 1,
      occurrenceId,
      sessionRunbook,
      sessionToolPlan,
      guidedAdjustment,
      guidedSpatialState,
    },
    { occurrenceId }
  );
}

function areGuidedRuntimeSnapshotsEqual(a, b) {
  const left = normalizeGuidedRuntimeSnapshot(a);
  const right = normalizeGuidedRuntimeSnapshot(b);
  if (!left || !right) return left === right;
  return (
    left.occurrenceId === right.occurrenceId &&
    areGuidedSpatialStatesEqual(left.guidedSpatialState, right.guidedSpatialState, {
      sessionRunbook: left.sessionRunbook,
    }) &&
    JSON.stringify(left.sessionRunbook) === JSON.stringify(right.sessionRunbook) &&
    JSON.stringify(left.sessionToolPlan || null) === JSON.stringify(right.sessionToolPlan || null) &&
    JSON.stringify(left.guidedAdjustment || null) === JSON.stringify(right.guidedAdjustment || null)
  );
}

function persistActiveGuidedRuntime(prevState, { occurrenceId = null, snapshot = null } = {}) {
  if (!snapshot || !occurrenceId) return prevState;
  const prev = prevState && typeof prevState === "object" ? prevState : {};
  const prevUi = prev.ui && typeof prev.ui === "object" ? prev.ui : {};
  const currentSession =
    prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
  if (!currentSession || currentSession.occurrenceId !== occurrenceId) return prevState;
  const currentSnapshot = normalizeGuidedRuntimeSnapshot(currentSession.guidedRuntimeV1 || null, {
    occurrenceId: currentSession.occurrenceId || null,
  });
  if (currentSession.experienceMode === "guided" && areGuidedRuntimeSnapshotsEqual(currentSnapshot, snapshot)) {
    return prevState;
  }
  return {
    ...prev,
    ui: {
      ...prevUi,
      activeSession: {
        ...currentSession,
        experienceMode: "guided",
        guidedRuntimeV1: snapshot,
      },
    },
  };
}

function SessionTopChrome({ isPrelaunch = false, categoryName = "", onBack }) {
  return (
    <div
      className={`sessionTopChrome${isPrelaunch ? " sessionTopChrome--launch" : " sessionTopChrome--runtime"}`}
      data-testid="session-top-chrome"
    >
      <GhostButton
        type="button"
        className={`sessionChromeButton${isPrelaunch ? " sessionChromeButton--back" : " sessionChromeButton--close"}`}
        onClick={onBack}
        aria-label="Retour"
      >
        {isPrelaunch ? "← Retour" : "×"}
      </GhostButton>
      {!isPrelaunch && categoryName ? (
        <div className="sessionTopChromeMeta">{String(categoryName).toUpperCase()}</div>
      ) : null}
    </div>
  );
}

export default function Session({
  data,
  setData,
  sessionLaunchState = null,
  setSessionLaunchState = null,
  onBack,
  onOpenLibrary,
  dateKey,
  occurrenceId,
  categoryId,
  setTab,
}) {
  const { session: authSession } = useAuth();
  const accessToken = authSession?.access_token || "";
  const { emitBehaviorFeedback } = useBehaviorFeedback();
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const occurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];
  const sessionHistory = Array.isArray(safeData.sessionHistory) ? safeData.sessionHistory : [];
  void sessionHistory;
  const rawActiveSession =
    safeData?.ui && typeof safeData.ui === "object" && safeData.ui.activeSession && typeof safeData.ui.activeSession === "object"
      ? safeData.ui.activeSession
      : null;
  const activeSession = useMemo(() => normalizeActiveSessionForUI(rawActiveSession), [rawActiveSession]);
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlDateKey = urlParams?.get("date") || null;
  const urlCategoryId = urlParams?.get("cat") || null;
  const routeOccurrenceId = occurrenceId || readOccurrenceIdFromPath() || null;
  const effectiveDateKey =
    normalizeLocalDateKey(dateKey) ||
    normalizeLocalDateKey(urlDateKey) ||
    normalizeLocalDateKey(safeData?.ui?.selectedDateKey) ||
    normalizeLocalDateKey(safeData?.ui?.selectedDate) ||
    todayLocalKey();
  const effectiveCategoryId = categoryId || urlCategoryId || null;
  const [tick, setTick] = useState(() => Date.now());
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackLevel, setFeedbackLevel] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [reportMode, setReportMode] = useState(false);
  const [preparationTimerId, setPreparationTimerId] = useState(0);
  const [adjustSheetMode, setAdjustSheetMode] = useState("");
  const [adjustCause, setAdjustCause] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolTick, setToolTick] = useState(() => Date.now());
  const prepareRequestRef = useRef(0);
  const adjustRequestRef = useRef(0);
  const toolRequestRef = useRef(0);

  const routeOccurrence = useMemo(
    () => normalizeOccurrenceForUI(occurrences.find((occurrenceItem) => occurrenceItem?.id === routeOccurrenceId) || null),
    [occurrences, routeOccurrenceId]
  );
  const categoryGoalIds = useMemo(
    () =>
      goals
        .filter((goal) => !effectiveCategoryId || goal?.categoryId === effectiveCategoryId)
        .map((goal) => goal?.id)
        .filter(Boolean),
    [effectiveCategoryId, goals]
  );
  const fallbackOccurrence = useMemo(() => {
    if (routeOccurrence) return null;
    if (!categoryGoalIds.length) return null;
    const resolved = resolveExecutableOccurrence(
      { occurrences },
      { dateKey: effectiveDateKey, goalIds: categoryGoalIds }
    );
    if (resolved.kind !== "ok" || !resolved.occurrenceId) return null;
    return normalizeOccurrenceForUI(occurrences.find((occurrenceItem) => occurrenceItem?.id === resolved.occurrenceId) || null);
  }, [categoryGoalIds, effectiveDateKey, occurrences, routeOccurrence]);
  const sessionMatchesRoute =
    activeSession &&
    (!routeOccurrenceId || activeSession?.occurrenceId === routeOccurrenceId) &&
    normalizeLocalDateKey(activeSession?.dateKey || activeSession?.date || effectiveDateKey) === effectiveDateKey;
  const session = sessionMatchesRoute ? activeSession : null;
  const selectedOccurrence = useMemo(() => {
    if (session?.occurrenceId) {
      return normalizeOccurrenceForUI(occurrences.find((occurrenceItem) => occurrenceItem?.id === session.occurrenceId) || null);
    }
    return routeOccurrence || fallbackOccurrence || null;
  }, [fallbackOccurrence, occurrences, routeOccurrence, session?.occurrenceId]);
  const goal = useMemo(() => {
    const selectedGoalId = selectedOccurrence?.goalId || session?.habitIds?.[0] || null;
    return goals.find((item) => item?.id === selectedGoalId) || null;
  }, [goals, selectedOccurrence?.goalId, session?.habitIds]);
  const category = categories.find((item) => item?.id === goal?.categoryId) || null;
  const blueprintSnapshot = useMemo(
    () => normalizeSessionBlueprintSnapshot(goal?.sessionBlueprintV1),
    [goal?.sessionBlueprintV1]
  );
  useEffect(() => {
    const isRunning = Boolean(session && isRuntimeSessionOpen(session) && session?.timerRunning);
    if (!isRunning) return undefined;
    const timerId = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [session]);

  useEffect(() => {
    if (!session || isRuntimeSessionOpen(session)) return;
    setReportMode(false);
    setShowFeedback(false);
  }, [session]);

  const timerAccumulatedSec = Number.isFinite(session?.timerAccumulatedSec) ? session.timerAccumulatedSec : 0;
  const startedAtMs = session?.timerStartedAt ? new Date(session.timerStartedAt).getTime() : NaN;
  const runningDeltaSec =
    session?.timerRunning && Number.isFinite(startedAtMs)
      ? Math.max(0, Math.floor((tick - startedAtMs) / 1000))
      : 0;
  const elapsedSec = Math.max(0, timerAccumulatedSec + runningDeltaSec);
  const plannedMinutes = Number.isFinite(selectedOccurrence?.durationMinutes)
    ? selectedOccurrence.durationMinutes
    : Number.isFinite(goal?.sessionMinutes)
      ? goal.sessionMinutes
      : null;
  const remainingSec =
    Number.isFinite(plannedMinutes) ? Math.max(Math.round(plannedMinutes * 60) - elapsedSec, 0) : null;

  const viewState = (() => {
    if (session && !isRuntimeSessionOpen(session)) return resolveFinalViewState(session);
    if (!session) return "idle";
    if (session?.timerRunning) return "running";
    if (session?.runtimePhase === "paused") return "paused";
    return "idle";
  })();
  const sessionBehaviorCue = useMemo(
    () =>
      deriveSessionBehaviorCue({
        viewState,
        plannedMinutes,
        categoryId: category?.id || effectiveCategoryId || null,
      }),
    [category?.id, effectiveCategoryId, plannedMinutes, viewState]
  );
  const actionProtocol = useMemo(() => {
    const protocolTitle = goal?.title || "";
    if (!protocolTitle || protocolTitle === "Session") return null;

    return deriveActionProtocol({
      title: protocolTitle,
      categoryName: category?.name || "",
      durationMinutes: plannedMinutes || 0,
      isHabitLike: Boolean(goal?.cadence),
    });
  }, [category?.name, goal?.cadence, goal?.title, plannedMinutes]);
  const currentLaunchState = sessionLaunchState && typeof sessionLaunchState === "object" ? sessionLaunchState : null;
  const occurrenceStatus = String(selectedOccurrence?.status || "");
  const isLaunchableOccurrence =
    occurrenceStatus === "planned" || occurrenceStatus === "in_progress" || occurrenceStatus === "missed";
  const launchStateMatchesOccurrence = Boolean(
    currentLaunchState?.occurrenceId &&
      selectedOccurrence?.id &&
      currentLaunchState.occurrenceId === selectedOccurrence.id
  );
  const launchPhase =
    launchStateMatchesOccurrence
      ? currentLaunchState?.phase || "ready"
      : !session && Boolean(selectedOccurrence?.id) && Boolean(blueprintSnapshot) && isLaunchableOccurrence
        ? "ready"
        : "";
  const shouldShowLaunchSurface =
    !session &&
    Boolean(blueprintSnapshot) &&
    isLaunchableOccurrence &&
    (launchPhase === "ready" || launchPhase === "preparing");
  const launchMode = launchStateMatchesOccurrence ? currentLaunchState?.launchMode || null : null;
  const launchRunbook = useMemo(
    () => normalizeSessionRunbook(currentLaunchState?.sessionRunbook || null),
    [currentLaunchState?.sessionRunbook]
  );
  const launchSpatialState = useMemo(
    () => normalizeGuidedSpatialState(currentLaunchState?.guidedSpatialState || null, { sessionRunbook: launchRunbook }),
    [currentLaunchState?.guidedSpatialState, launchRunbook]
  );
  const launchToolPlan = useMemo(
    () => normalizeSessionToolPlan(currentLaunchState?.sessionToolPlan || null, { sessionRunbook: launchRunbook }),
    [currentLaunchState?.sessionToolPlan, launchRunbook]
  );
  const launchToolState = useMemo(
    () => normalizeSessionToolState(currentLaunchState?.sessionToolState || null),
    [currentLaunchState?.sessionToolState]
  );
  const persistedGuidedRuntime = useMemo(
    () =>
      normalizeGuidedRuntimeSnapshot(session?.guidedRuntimeV1 || null, {
        occurrenceId: session?.occurrenceId || null,
      }),
    [session?.guidedRuntimeV1, session?.occurrenceId]
  );
  const hasPersistedGuidedRuntime = Boolean(
    session &&
      isRuntimeSessionOpen(session) &&
      persistedGuidedRuntime &&
      selectedOccurrence?.id &&
      session.occurrenceId === selectedOccurrence.id
  );
  const guidedRunbook = useMemo(() => {
    if (launchStateMatchesOccurrence && launchMode === "guided") return launchRunbook;
    return hasPersistedGuidedRuntime ? persistedGuidedRuntime.sessionRunbook : null;
  }, [
    hasPersistedGuidedRuntime,
    launchMode,
    launchRunbook,
    launchStateMatchesOccurrence,
    persistedGuidedRuntime,
  ]);
  const resolvedLaunchSpatialState = useMemo(() => {
    if (!launchStateMatchesOccurrence || launchMode !== "guided" || !guidedRunbook || !launchSpatialState) {
      return launchSpatialState;
    }
    if (!session || !isRuntimeSessionOpen(session) || launchSpatialState.mode === "active") {
      return launchSpatialState;
    }
    return activateGuidedSpatialState({
      guidedSpatialState: launchSpatialState,
      sessionRunbook: guidedRunbook,
      elapsedSec,
    });
  }, [
    elapsedSec,
    guidedRunbook,
    launchMode,
    launchSpatialState,
    launchStateMatchesOccurrence,
    session,
  ]);
  const effectiveGuidedSpatialState = useMemo(() => {
    if (launchStateMatchesOccurrence && launchMode === "guided") return resolvedLaunchSpatialState;
    return hasPersistedGuidedRuntime ? persistedGuidedRuntime.guidedSpatialState : null;
  }, [
    hasPersistedGuidedRuntime,
    launchMode,
    launchStateMatchesOccurrence,
    persistedGuidedRuntime,
    resolvedLaunchSpatialState,
  ]);
  const effectiveLaunchMode =
    launchStateMatchesOccurrence && launchMode
      ? launchMode
      : hasPersistedGuidedRuntime
        ? "guided"
        : null;
  const guidedMode =
    effectiveLaunchMode === "guided"
      ? effectiveGuidedSpatialState?.mode ||
        (launchPhase === "guided_active" || (session && isRuntimeSessionOpen(session)) ? "active" : "preview")
      : "";
  const syncedGuidedSpatialState = useMemo(
    () =>
      syncGuidedSpatialStateWithElapsed({
        sessionRunbook: guidedRunbook,
        guidedSpatialState: effectiveGuidedSpatialState,
        elapsedSec,
      }),
    [elapsedSec, effectiveGuidedSpatialState, guidedRunbook]
  );
  const guidedPlan = useMemo(
    () =>
      deriveGuidedSpatialPlan({
        sessionRunbook: guidedRunbook,
        guidedSpatialState: syncedGuidedSpatialState,
        elapsedSec,
      }),
    [elapsedSec, guidedRunbook, syncedGuidedSpatialState]
  );
  const guidedToolPlan = useMemo(() => {
    if (launchStateMatchesOccurrence && launchMode === "guided") return launchToolPlan;
    return hasPersistedGuidedRuntime ? persistedGuidedRuntime.sessionToolPlan : null;
  }, [
    hasPersistedGuidedRuntime,
    launchMode,
    launchStateMatchesOccurrence,
    launchToolPlan,
    persistedGuidedRuntime,
  ]);
  const guidedTools = useMemo(
    () =>
      deriveRecommendedSessionTools({
        sessionToolPlan: guidedToolPlan,
        guidedPlan,
        accessToken,
      }),
    [accessToken, guidedPlan, guidedToolPlan]
  );
  const activeToolUtility =
    launchStateMatchesOccurrence && launchMode === "guided" ? launchToolState.activeUtility : null;
  const activeToolUtilitySnapshot = useMemo(
    () => deriveActiveSessionToolUtilitySnapshot(activeToolUtility, toolTick),
    [activeToolUtility, toolTick]
  );
  const activeToolArtifact =
    launchStateMatchesOccurrence && launchMode === "guided" && launchToolState.openArtifactToolId
      ? launchToolState.artifactsByToolId?.[launchToolState.openArtifactToolId] || null
      : null;
  const standardAdjustment =
    launchStateMatchesOccurrence && effectiveLaunchMode !== "guided" && currentLaunchState?.standardAdjustment
      ? currentLaunchState.standardAdjustment
      : null;
  const guidedAdjustment = useMemo(() => {
    if (launchStateMatchesOccurrence && launchMode === "guided") {
      return currentLaunchState?.guidedAdjustment || null;
    }
    return hasPersistedGuidedRuntime ? persistedGuidedRuntime.guidedAdjustment || null : null;
  }, [
    currentLaunchState,
    hasPersistedGuidedRuntime,
    launchMode,
    launchStateMatchesOccurrence,
    persistedGuidedRuntime,
  ]);
  const effectiveActionProtocol = useMemo(() => {
    if (!standardAdjustment?.protocolOverride) return actionProtocol;
    return {
      ...(actionProtocol || {}),
      ...standardAdjustment.protocolOverride,
    };
  }, [actionProtocol, standardAdjustment?.protocolOverride]);
  const effectivePlannedMinutes =
    normalizePositiveMinutes(
      guidedRunbook?.durationMinutes ??
        guidedAdjustment?.adjustedDurationMinutes ??
        standardAdjustment?.adjustedDurationMinutes ??
        plannedMinutes,
      plannedMinutes || 20
    );
  const currentAdjustmentSummary = guidedAdjustment?.summary || standardAdjustment?.summary || "";
  const currentAdjustmentLabel = guidedAdjustment?.label || standardAdjustment?.label || "";
  const canAdjustStandard = Boolean(selectedOccurrence?.id) && effectiveLaunchMode !== "guided";
  const canAdjustGuided = Boolean(
    guidedPlan && !shouldShowLaunchSurface && effectiveLaunchMode === "guided" && guidedMode === "active"
  );
  const canOpenGuidedTools = Boolean(
    guidedPlan &&
      !shouldShowLaunchSurface &&
      effectiveLaunchMode === "guided" &&
      guidedMode === "active" &&
      guidedTools.length
  );
  const sessionTimingLabel =
    selectedOccurrence?.start && selectedOccurrence.start !== "00:00" ? selectedOccurrence.start : "Dans la journée";
  const isPrelaunchPhase = shouldShowLaunchSurface;
  const sessionScreenClassName = isPrelaunchPhase ? "sessionScreen sessionScreen--launch" : "sessionScreen";
  const adjustCauses = useMemo(
    () =>
      SESSION_ADJUST_CAUSES.map((entry) => ({
        ...entry,
        description:
          entry.id === "less_time"
            ? "Réduis le bloc sans perdre ce qui compte."
            : entry.id === "less_energy"
              ? "Baisse l’intensité sans casser l’objectif."
              : entry.id === "running_late"
                ? "Recolle au timing depuis l’endroit où tu es."
                : "Repars sur une relance crédible.",
      })),
    []
  );
  const remainingMinutesForAdjustment =
    remainingSec != null ? Math.max(1, Math.ceil(remainingSec / 60)) : effectivePlannedMinutes;
  const standardAdjustOptions = useMemo(
    () =>
      buildStandardAdjustmentOptions({
        cause: adjustCause,
        plannedMinutes: effectivePlannedMinutes,
        remainingMinutes: remainingMinutesForAdjustment,
        actionProtocol: effectiveActionProtocol,
      }),
    [adjustCause, effectiveActionProtocol, effectivePlannedMinutes, remainingMinutesForAdjustment]
  );
  const guidedAdjustOptions = useMemo(
    () =>
      buildGuidedAdjustmentOptions({
        cause: adjustCause,
        sessionRunbook: guidedRunbook,
        guidedSpatialState: syncedGuidedSpatialState,
        elapsedSec,
      }),
    [adjustCause, elapsedSec, guidedRunbook, syncedGuidedSpatialState]
  );
  const activeAdjustOptions = adjustSheetMode === "guided" ? guidedAdjustOptions : standardAdjustOptions;
  const readLaunchStateBase = useCallback(
    (current = null) => {
      const currentValue =
        current && selectedOccurrence?.id && current.occurrenceId === selectedOccurrence.id ? current : null;
      const runtimeGuidedBase = hasPersistedGuidedRuntime ? persistedGuidedRuntime : null;
      const currentPhase = currentValue?.phase || "";
      const currentLaunchMode = currentValue?.launchMode || null;
      return {
        version: 1,
        entryId: currentValue?.entryId || `session-${selectedOccurrence?.id || "current"}`,
        phase:
          currentLaunchMode === "guided"
            ? currentPhase || "guided_active"
            : runtimeGuidedBase
              ? "guided_active"
              : currentPhase || "ready",
        launchMode: currentLaunchMode || (runtimeGuidedBase ? "guided" : null),
        sourceSurface: currentValue?.sourceSurface || "unknown",
        occurrenceId: selectedOccurrence?.id || null,
        actionId: goal?.id || selectedOccurrence?.goalId || currentValue?.actionId || null,
        dateKey: selectedOccurrence?.date || effectiveDateKey || currentValue?.dateKey || null,
        categoryId: category?.id || goal?.categoryId || effectiveCategoryId || currentValue?.categoryId || null,
        blueprintSnapshot: blueprintSnapshot || currentValue?.blueprintSnapshot || null,
        sessionRunbook: currentValue?.sessionRunbook || runtimeGuidedBase?.sessionRunbook || null,
        standardAdjustment: currentValue?.standardAdjustment || null,
        guidedAdjustment: currentValue?.guidedAdjustment || runtimeGuidedBase?.guidedAdjustment || null,
        sessionToolPlan: currentValue?.sessionToolPlan || runtimeGuidedBase?.sessionToolPlan || null,
        sessionToolState: currentValue?.sessionToolState || null,
        guidedSpatialState: currentValue?.guidedSpatialState || runtimeGuidedBase?.guidedSpatialState || null,
        openedAtMs: currentValue?.openedAtMs || Date.now(),
      };
    },
    [
      blueprintSnapshot,
      category?.id,
      effectiveCategoryId,
      effectiveDateKey,
      goal?.categoryId,
      goal?.id,
      hasPersistedGuidedRuntime,
      persistedGuidedRuntime,
      selectedOccurrence?.date,
      selectedOccurrence?.goalId,
      selectedOccurrence?.id,
    ]
  );

  const closeAdjustSheet = () => {
    adjustRequestRef.current += 1;
    setAdjustLoading(false);
    setAdjustCause("");
    setAdjustSheetMode("");
  };

  const closeToolsSheet = () => {
    toolRequestRef.current += 1;
    setToolsLoading(false);
    setToolsSheetOpen(false);
  };

  const updateGuidedToolState = (updater) => {
    if (typeof setSessionLaunchState !== "function" || !selectedOccurrence?.id) return;
    setSessionLaunchState((current) => {
      const base = readLaunchStateBase(current);
      const currentToolState = normalizeSessionToolState(base.sessionToolState);
      const nextToolState =
        typeof updater === "function" ? updater(currentToolState) : updater;
      return {
        ...base,
        sessionToolState: nextToolState || createEmptySessionToolState(),
      };
    });
  };

  const updateGuidedSpatialState = (updater) => {
    if (typeof setSessionLaunchState !== "function" || !selectedOccurrence?.id) return;
    setSessionLaunchState((current) => {
      const base = readLaunchStateBase(current);
      const currentSpatialState = normalizeGuidedSpatialState(base.guidedSpatialState, {
        sessionRunbook: base.sessionRunbook,
      });
      const nextSpatialState = typeof updater === "function" ? updater(currentSpatialState) : updater;
      return {
        ...base,
        guidedSpatialState: nextSpatialState || null,
      };
    });
  };

  useEffect(() => {
    if (typeof setSessionLaunchState !== "function") return;
    if (!selectedOccurrence?.id) return;
    setSessionLaunchState((current) => {
      if (!current || current.occurrenceId !== selectedOccurrence.id) return current;
      const nextDateKey = selectedOccurrence.date || effectiveDateKey || current.dateKey || null;
      const nextCategoryId = category?.id || goal?.categoryId || effectiveCategoryId || current.categoryId || null;
      const nextActionId = goal?.id || current.actionId || null;
      if (
        current.actionId === nextActionId &&
        current.categoryId === nextCategoryId &&
        current.dateKey === nextDateKey &&
        current.blueprintSnapshot === blueprintSnapshot
      ) {
        return current;
      }
      return {
        ...current,
        actionId: nextActionId,
        categoryId: nextCategoryId,
        dateKey: nextDateKey,
        blueprintSnapshot: blueprintSnapshot || null,
      };
    });
  }, [
    blueprintSnapshot,
    category?.id,
    effectiveCategoryId,
    effectiveDateKey,
    goal?.categoryId,
    goal?.id,
    selectedOccurrence?.date,
    selectedOccurrence?.id,
    setSessionLaunchState,
  ]);

  useEffect(() => {
    if (!preparationTimerId) return undefined;
    return () => window.clearTimeout(preparationTimerId);
  }, [preparationTimerId]);

  useEffect(() => {
    if (activeToolUtilitySnapshot?.state !== "running") return undefined;
    const timerId = window.setInterval(() => setToolTick(Date.now()), 500);
    return () => window.clearInterval(timerId);
  }, [activeToolUtilitySnapshot?.state]);

  useEffect(() => {
    if (typeof setSessionLaunchState !== "function") return;
    if (!activeToolUtility || activeToolUtility.state !== "running") return;
    if (activeToolUtilitySnapshot?.state !== "done") return;
    setSessionLaunchState((current) => {
      const base = readLaunchStateBase(current);
      const currentToolState = normalizeSessionToolState(base.sessionToolState);
      return {
        ...base,
        sessionToolState: {
          ...currentToolState,
          activeUtility: {
            ...activeToolUtilitySnapshot,
            state: "done",
            startedAtMs: null,
          },
        },
      };
    });
  }, [
    activeToolUtility,
    activeToolUtilitySnapshot,
    readLaunchStateBase,
    setSessionLaunchState,
  ]);

  useEffect(() => {
    if (typeof setSessionLaunchState !== "function") return;
    if (!launchStateMatchesOccurrence || launchMode !== "guided") return;
    if (!guidedRunbook || !launchSpatialState || !syncedGuidedSpatialState) return;
    if (
      areGuidedSpatialStatesEqual(syncedGuidedSpatialState, launchSpatialState, {
        sessionRunbook: guidedRunbook,
      })
    ) {
      return;
    }
    setSessionLaunchState((current) => {
      const base = readLaunchStateBase(current);
      if (base.occurrenceId !== selectedOccurrence?.id) return current;
      if (
        areGuidedSpatialStatesEqual(base.guidedSpatialState, syncedGuidedSpatialState, {
          sessionRunbook: guidedRunbook,
        }) &&
        base.phase === (syncedGuidedSpatialState.mode === "active" ? "guided_active" : "guided_preview")
      ) {
        return current;
      }
      return {
        ...base,
        phase: syncedGuidedSpatialState.mode === "active" ? "guided_active" : "guided_preview",
        guidedSpatialState: syncedGuidedSpatialState,
      };
    });
  }, [
    guidedRunbook,
    launchMode,
    launchSpatialState,
    launchStateMatchesOccurrence,
    readLaunchStateBase,
    selectedOccurrence?.id,
    setSessionLaunchState,
    syncedGuidedSpatialState,
  ]);

  const activeGuidedRuntimeSnapshot = useMemo(
    () =>
      effectiveLaunchMode === "guided" && guidedMode === "active"
        ? buildGuidedRuntimeSnapshot({
            occurrenceId: selectedOccurrence?.id || null,
            sessionRunbook: guidedRunbook,
            sessionToolPlan: guidedToolPlan,
            guidedAdjustment,
            guidedSpatialState: syncedGuidedSpatialState,
          })
        : null,
    [
      effectiveLaunchMode,
      guidedAdjustment,
      guidedMode,
      guidedRunbook,
      guidedToolPlan,
      selectedOccurrence?.id,
      syncedGuidedSpatialState,
    ]
  );

  useEffect(() => {
    if (typeof setData !== "function") return;
    if (!session || !isRuntimeSessionOpen(session)) return;
    if (!selectedOccurrence?.id || !activeGuidedRuntimeSnapshot) return;
    setData((prev) =>
      persistActiveGuidedRuntime(prev, {
        occurrenceId: selectedOccurrence.id,
        snapshot: activeGuidedRuntimeSnapshot,
      })
    );
  }, [
    activeGuidedRuntimeSnapshot,
    selectedOccurrence?.id,
    session,
    setData,
  ]);

  useEffect(
    () => () => {
      prepareRequestRef.current += 1;
      adjustRequestRef.current += 1;
      toolRequestRef.current += 1;
    },
    []
  );

  useEffect(() => {
    if (typeof setSessionLaunchState !== "function") return;
    if (!sessionLaunchState) return;
    if (selectedOccurrence?.id && sessionLaunchState.occurrenceId && sessionLaunchState.occurrenceId !== selectedOccurrence.id) {
      window.clearTimeout(preparationTimerId);
      setPreparationTimerId(0);
      closeAdjustSheet();
      closeToolsSheet();
      setSessionLaunchState(null);
    }
  }, [preparationTimerId, selectedOccurrence?.id, sessionLaunchState, setSessionLaunchState]);

  const handleLaunchStandard = () => {
    if (typeof setSessionLaunchState !== "function" || !selectedOccurrence?.id) return;
    prepareRequestRef.current += 1;
    window.clearTimeout(preparationTimerId);
    setPreparationTimerId(0);
    closeAdjustSheet();
    closeToolsSheet();
    setSessionLaunchState((current) => ({
      ...readLaunchStateBase(current),
      phase: "launched_standard",
      launchMode: "standard",
      sessionRunbook: null,
      standardAdjustment: null,
      guidedAdjustment: null,
      sessionToolPlan: null,
      sessionToolState: null,
      guidedSpatialState: null,
    }));
  };

  const handlePrepareGuided = async () => {
    if (typeof setSessionLaunchState !== "function" || !selectedOccurrence?.id || !goal || !blueprintSnapshot) return;
    const fallbackRunbook = buildSessionRunbookV1({
      blueprintSnapshot,
      occurrence: selectedOccurrence,
      action: goal,
      category,
    });
    if (!fallbackRunbook) {
      handleLaunchStandard();
      return;
    }
    prepareRequestRef.current += 1;
    const requestId = prepareRequestRef.current;
    const startedAtMs = Date.now();
    window.clearTimeout(preparationTimerId);
    setPreparationTimerId(0);
    closeAdjustSheet();
    closeToolsSheet();
    setSessionLaunchState((current) => ({
      ...readLaunchStateBase(current),
      phase: "preparing",
      launchMode: "guided",
      sessionRunbook: null,
      standardAdjustment: null,
      guidedAdjustment: null,
      sessionToolPlan: null,
      sessionToolState: null,
      guidedSpatialState: null,
    }));

    let nextRunbook = fallbackRunbook;
    let nextToolPlan = buildSessionToolPlan({ sessionRunbook: fallbackRunbook });
    if (accessToken) {
      const prepareResult = await requestAiSessionGuidance({
        accessToken,
        payload: {
          mode: "prepare",
          dateKey: selectedOccurrence.date || effectiveDateKey,
          occurrenceId: selectedOccurrence.id,
          actionId: goal.id,
          categoryId: category?.id || goal?.categoryId || effectiveCategoryId || null,
          blueprintSnapshot,
          fallbackRunbook,
          notes: readGoalSessionNotes(goal),
        },
      });
      const preparedRunbook = readSessionGuidanceRunbookPayload(prepareResult?.payload, fallbackRunbook);
      if (prepareResult?.ok && preparedRunbook) nextRunbook = preparedRunbook;
      const preparedToolPlan = readSessionGuidanceToolPlanPayload(prepareResult?.payload, preparedRunbook || nextRunbook);
      if (prepareResult?.ok && preparedToolPlan) nextToolPlan = preparedToolPlan;
    }

    const remainingMs = Math.max(0, 800 - (Date.now() - startedAtMs));
    if (remainingMs > 0) {
      await new Promise((resolve) => {
        const timerId = window.setTimeout(() => {
          setPreparationTimerId(0);
          resolve();
        }, remainingMs);
        setPreparationTimerId(timerId);
      });
    }

    if (prepareRequestRef.current !== requestId) return;
    setSessionLaunchState((current) => {
      const base = readLaunchStateBase(current);
      if (!base.occurrenceId || base.occurrenceId !== selectedOccurrence.id) return current;
      return {
        ...base,
        phase: "guided_preview",
        launchMode: "guided",
        sessionRunbook: nextRunbook,
        standardAdjustment: null,
        guidedAdjustment: null,
        sessionToolPlan: nextToolPlan,
        sessionToolState: createEmptySessionToolState(),
        guidedSpatialState: createGuidedSpatialState({
          sessionRunbook: nextRunbook,
          mode: "preview",
        }),
      };
    });
  };

  const handleRevertToStandard = () => {
    if (typeof setSessionLaunchState !== "function" || !selectedOccurrence?.id) return;
    prepareRequestRef.current += 1;
    window.clearTimeout(preparationTimerId);
    setPreparationTimerId(0);
    closeAdjustSheet();
    closeToolsSheet();
    setSessionLaunchState((current) => ({
      ...readLaunchStateBase(current),
      phase: "ready",
      launchMode: null,
      sessionRunbook: null,
      standardAdjustment: null,
      guidedAdjustment: null,
      sessionToolPlan: null,
      sessionToolState: null,
      guidedSpatialState: null,
    }));
  };

  const handleStartGuidedSession = () => {
    if (typeof setSessionLaunchState !== "function" || !selectedOccurrence?.id || !launchRunbook) return;
    prepareRequestRef.current += 1;
    window.clearTimeout(preparationTimerId);
    setPreparationTimerId(0);
    closeAdjustSheet();
    closeToolsSheet();
    const nextToolPlan = launchToolPlan || buildSessionToolPlan({ sessionRunbook: launchRunbook });
    const nextGuidedSpatialState = activateGuidedSpatialState({
      guidedSpatialState: effectiveGuidedSpatialState,
      sessionRunbook: launchRunbook,
      elapsedSec,
    });
    const nextGuidedRuntimeSnapshot = buildGuidedRuntimeSnapshot({
      occurrenceId: selectedOccurrence.id,
      sessionRunbook: launchRunbook,
      sessionToolPlan: nextToolPlan,
      guidedAdjustment: null,
      guidedSpatialState: nextGuidedSpatialState,
    });
    setSessionLaunchState((current) => {
      const base = readLaunchStateBase(current);
      if (!base.occurrenceId || !launchRunbook) return current;
      return {
        ...base,
        phase: "guided_active",
        launchMode: "guided",
        sessionRunbook: launchRunbook,
        standardAdjustment: null,
        guidedAdjustment: null,
        sessionToolPlan: nextToolPlan,
        sessionToolState: createEmptySessionToolState(),
        guidedSpatialState: nextGuidedSpatialState,
      };
    });
    startTimer({ guidedRuntimeSnapshot: nextGuidedRuntimeSnapshot });
  };

  const handleRegenerateGuided = async () => {
    if (
      typeof setSessionLaunchState !== "function" ||
      !selectedOccurrence?.id ||
      !goal ||
      !blueprintSnapshot ||
      !launchRunbook ||
      guidedMode !== "preview"
    ) {
      return;
    }

    prepareRequestRef.current += 1;
    const requestId = prepareRequestRef.current;
    updateGuidedSpatialState((currentSpatialState) => ({
      ...(currentSpatialState || createGuidedSpatialState({ sessionRunbook: launchRunbook, mode: "preview" })),
      isRegenerating: true,
    }));

    const fallbackRunbook = buildSessionRunbookV1({
      blueprintSnapshot,
      occurrence: selectedOccurrence,
      action: goal,
      category,
    });

    let nextRunbook = launchRunbook;
    let nextToolPlan = launchToolPlan || buildSessionToolPlan({ sessionRunbook: launchRunbook });

    if (accessToken && fallbackRunbook) {
      const prepareResult = await requestAiSessionGuidance({
        accessToken,
        payload: {
          mode: "prepare",
          variant: "regenerate",
          dateKey: selectedOccurrence.date || effectiveDateKey,
          occurrenceId: selectedOccurrence.id,
          actionId: goal.id,
          categoryId: category?.id || goal?.categoryId || effectiveCategoryId || null,
          blueprintSnapshot,
          fallbackRunbook,
          notes: readGoalSessionNotes(goal),
        },
      });
      const preparedRunbook = readSessionGuidanceRunbookPayload(prepareResult?.payload, fallbackRunbook);
      if (prepareResult?.ok && preparedRunbook) {
        nextRunbook = preparedRunbook;
      }
      const preparedToolPlan = readSessionGuidanceToolPlanPayload(
        prepareResult?.payload,
        preparedRunbook || nextRunbook
      );
      if (prepareResult?.ok && preparedToolPlan) {
        nextToolPlan = preparedToolPlan;
      }
    }

    if (prepareRequestRef.current !== requestId) return;
    setSessionLaunchState((current) => {
      const base = readLaunchStateBase(current);
      if (base.occurrenceId !== selectedOccurrence.id) return current;
      return {
        ...base,
        phase: "guided_preview",
        launchMode: "guided",
        sessionRunbook: nextRunbook,
        guidedAdjustment: null,
        sessionToolPlan: nextToolPlan,
        sessionToolState: createEmptySessionToolState(),
        guidedSpatialState: {
          ...createGuidedSpatialState({
            sessionRunbook: nextRunbook,
            mode: "preview",
          }),
          isRegenerating: false,
        },
      };
    });
  };

  const handleViewGuidedStep = (stepIndex) => {
    if (!guidedRunbook) return;
    updateGuidedSpatialState((currentSpatialState) =>
      setGuidedSpatialViewedStep({
        guidedSpatialState: currentSpatialState,
        sessionRunbook: guidedRunbook,
        stepIndex,
      })
    );
  };

  const handleReturnToActiveGuidedStep = () => {
    if (!guidedRunbook) return;
    updateGuidedSpatialState((currentSpatialState) =>
      returnGuidedSpatialToActive({
        guidedSpatialState: currentSpatialState,
        sessionRunbook: guidedRunbook,
      })
    );
  };

  const handleToggleGuidedChecklistItem = (stepId, itemId) => {
    if (!guidedRunbook) return;
    updateGuidedSpatialState((currentSpatialState) =>
      toggleGuidedSpatialChecklistItem({
        guidedSpatialState: currentSpatialState,
        sessionRunbook: guidedRunbook,
        stepId,
        itemId,
      })
    );
  };

  const handleAdvanceGuidedStep = () => {
    if (!guidedRunbook) return;
    updateGuidedSpatialState((currentSpatialState) =>
      advanceGuidedSpatialStep({
        guidedSpatialState: currentSpatialState,
        sessionRunbook: guidedRunbook,
        elapsedSec,
      })
    );
  };

  const openStandardAdjust = () => {
    if (!canAdjustStandard) return;
    closeToolsSheet();
    setAdjustCause("");
    setAdjustLoading(false);
    setAdjustSheetMode("standard");
  };

  const openGuidedAdjust = () => {
    if (!canAdjustGuided) return;
    closeToolsSheet();
    handleCloseToolResult();
    setAdjustCause("");
    setAdjustLoading(false);
    setAdjustSheetMode("guided");
  };

  const openGuidedTools = () => {
    if (!canOpenGuidedTools) return;
    closeAdjustSheet();
    handleCloseToolResult();
    setToolsLoading(false);
    setToolsSheetOpen(true);
  };

  const handleCloseToolResult = () => {
    updateGuidedToolState((currentToolState) => ({
      ...currentToolState,
      openArtifactToolId: null,
    }));
  };

  const handleCopyToolResult = async () => {
    if (!activeToolArtifact?.copyText || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(activeToolArtifact.copyText);
    } catch {
      // no-op
    }
  };

  const handleExecuteTool = async (tool, { forceRegenerate = false } = {}) => {
    if (!tool || typeof setSessionLaunchState !== "function" || !selectedOccurrence?.id || !guidedRunbook || !guidedPlan) return;
    const cachedArtifact = !forceRegenerate ? launchToolState.artifactsByToolId?.[tool.toolId] || null : null;
    if (cachedArtifact && tool.outputKind === "support_artifact") {
      updateGuidedToolState((currentToolState) => ({
        ...currentToolState,
        lastToolId: tool.toolId,
        openArtifactToolId: tool.toolId,
      }));
      setToolsSheetOpen(false);
      return;
    }

    const requestId = toolRequestRef.current + 1;
    toolRequestRef.current = requestId;
    setToolsLoading(true);

    let nextResult = null;
    if (tool.executionMode === "ai" && accessToken) {
      const aiResult = await requestAiSessionGuidance({
        accessToken,
        payload: {
          mode: "tool",
          dateKey: selectedOccurrence.date || effectiveDateKey,
          occurrenceId: selectedOccurrence.id,
          actionId: goal?.id || selectedOccurrence.goalId || "",
          categoryId: category?.id || goal?.categoryId || effectiveCategoryId || null,
          blueprintSnapshot,
          sessionRunbook: guidedRunbook,
          toolId: tool.toolId,
          notes: readGoalSessionNotes(goal),
          runtimeContext: {
            currentStepId: guidedPlan.currentStep?.id || null,
            currentItemId: guidedPlan.currentItem?.id || null,
            elapsedSec,
            remainingSec: remainingSec ?? 0,
          },
        },
        timeoutMs: 1200,
      });
      if (aiResult?.ok) {
        nextResult = readSessionGuidanceToolResultPayload(aiResult.payload, tool.toolId);
      }
    }

    if (!nextResult) {
      nextResult = executeLocalSessionTool({
        toolId: tool.toolId,
        sessionRunbook: guidedRunbook,
        guidedPlan,
      });
    }

    if (toolRequestRef.current !== requestId) return;

    if (nextResult?.kind === "artifact" && nextResult.artifact) {
      updateGuidedToolState((currentToolState) => ({
        ...currentToolState,
        lastToolId: tool.toolId,
        openArtifactToolId: tool.toolId,
        artifactsByToolId: {
          ...currentToolState.artifactsByToolId,
          [tool.toolId]: nextResult.artifact,
        },
      }));
      setToolsSheetOpen(false);
      setToolsLoading(false);
      return;
    }

    if (nextResult?.kind === "utility" && nextResult.utility) {
      updateGuidedToolState((currentToolState) => ({
        ...currentToolState,
        lastToolId: tool.toolId,
        openArtifactToolId: null,
        activeUtility: nextResult.utility,
      }));
      setToolsSheetOpen(false);
      setToolsLoading(false);
      return;
    }

    setToolsLoading(false);
  };

  const handleRegenerateToolResult = () => {
    const toolId = launchToolState.openArtifactToolId;
    if (!toolId) return;
    const tool = guidedTools.find((entry) => entry.toolId === toolId) || guidedToolPlan?.catalog?.find((entry) => entry.toolId === toolId) || null;
    if (!tool) return;
    handleExecuteTool(tool, { forceRegenerate: true });
  };

  const handleStartToolUtility = () => {
    updateGuidedToolState((currentToolState) => {
      const activeUtility = currentToolState.activeUtility;
      const restartedUtility =
        activeToolUtilitySnapshot?.state === "done" ? resetSessionToolUtility(activeUtility) : activeUtility;
      return {
        ...currentToolState,
        activeUtility: startSessionToolUtility(restartedUtility, Date.now()),
      };
    });
  };

  const handlePauseToolUtility = () => {
    updateGuidedToolState((currentToolState) => ({
      ...currentToolState,
      activeUtility: pauseSessionToolUtility(currentToolState.activeUtility, Date.now()),
    }));
  };

  const handleResetToolUtility = () => {
    updateGuidedToolState((currentToolState) => ({
      ...currentToolState,
      activeUtility: resetSessionToolUtility(currentToolState.activeUtility),
    }));
  };

  const handleCloseToolUtility = () => {
    updateGuidedToolState((currentToolState) => ({
      ...currentToolState,
      activeUtility: null,
    }));
  };

  const handleToggleToolUtility = () => {
    updateGuidedToolState((currentToolState) => ({
      ...currentToolState,
      activeUtility: toggleSessionToolUtilityCollapse(currentToolState.activeUtility),
    }));
  };

  const handleApplyAdjustment = async (option) => {
    if (!option || typeof setSessionLaunchState !== "function" || !selectedOccurrence?.id) return;
    const requestId = adjustRequestRef.current + 1;
    adjustRequestRef.current = requestId;
    setAdjustLoading(true);

    if (adjustSheetMode === "standard") {
      const nextAdjustment = applyStandardAdjustmentLocally({
        cause: adjustCause,
        strategyId: option.strategyId,
        plannedMinutes: effectivePlannedMinutes,
        remainingMinutes: remainingMinutesForAdjustment,
        actionProtocol: effectiveActionProtocol,
      });
      if (adjustRequestRef.current !== requestId) return;
      if (nextAdjustment) {
        setSessionLaunchState((current) => {
          const base = readLaunchStateBase(current);
          return {
            ...base,
            phase: "launched_standard",
            launchMode: "standard",
            sessionRunbook: null,
            standardAdjustment: nextAdjustment,
            guidedAdjustment: null,
            sessionToolPlan: null,
            sessionToolState: null,
          };
        });
      }
      setAdjustLoading(false);
      setAdjustCause("");
      setAdjustSheetMode("");
      return;
    }

    const localGuidedResult = applyGuidedAdjustmentLocally({
      cause: adjustCause,
      strategyId: option.strategyId,
      sessionRunbook: guidedRunbook,
      guidedSpatialState: syncedGuidedSpatialState,
      elapsedSec,
    });
    if (!localGuidedResult) {
      setAdjustLoading(false);
      return;
    }

    let nextRunbook = localGuidedResult.sessionRunbook;
    let nextAdjustment = localGuidedResult.adjustment;
    let nextToolPlan = buildSessionToolPlan({ sessionRunbook: nextRunbook });

    if (option.aiPreferred && accessToken && guidedRunbook) {
      const adjustResult = await requestAiSessionGuidance({
        accessToken,
        payload: {
          mode: "adjust",
          dateKey: selectedOccurrence.date || effectiveDateKey,
          occurrenceId: selectedOccurrence.id,
          actionId: goal?.id || selectedOccurrence.goalId || "",
          categoryId: category?.id || goal?.categoryId || effectiveCategoryId || null,
          blueprintSnapshot,
          sessionRunbook: guidedRunbook,
          cause: adjustCause,
          strategyId: option.strategyId,
          runtimeContext: {
            currentStepId: guidedPlan?.currentStep?.id || null,
            currentItemId: guidedPlan?.currentItem?.id || null,
            elapsedSec,
            remainingSec: remainingSec ?? 0,
          },
        },
      });
      const preparedRunbook = readSessionGuidanceRunbookPayload(adjustResult?.payload, nextRunbook);
      if (adjustResult?.ok && preparedRunbook) {
        nextRunbook = preparedRunbook;
        nextToolPlan = buildSessionToolPlan({ sessionRunbook: preparedRunbook });
        nextAdjustment = {
          ...nextAdjustment,
          adjustedDurationMinutes: preparedRunbook.durationMinutes,
          runbookPatch: {
            version: preparedRunbook.version,
            stepCount: preparedRunbook.steps.length,
            itemCount: preparedRunbook.steps.reduce((count, step) => count + step.items.length, 0),
          },
        };
      }
    }

    if (adjustRequestRef.current !== requestId) return;
    setSessionLaunchState((current) => {
      const base = readLaunchStateBase(current);
      if (!base.occurrenceId) return current;
      return {
        ...base,
        phase: "guided_active",
        launchMode: "guided",
        sessionRunbook: nextRunbook,
        standardAdjustment: null,
        guidedAdjustment: nextAdjustment,
        sessionToolPlan: nextToolPlan,
        sessionToolState: createEmptySessionToolState(),
        guidedSpatialState: rebaseGuidedSpatialState({
          guidedSpatialState: base.guidedSpatialState,
          previousRunbook: guidedRunbook,
          nextRunbook,
          mode: "active",
          elapsedSec,
        }),
      };
    });
    setAdjustLoading(false);
    setAdjustCause("");
    setAdjustSheetMode("");
  };

  const buildStartedRuntimeState = useCallback(
    (sourceState, guidedRuntimeSnapshot = null) => {
      if (!selectedOccurrence?.id) return sourceState;
      const selectedOccurrenceId = selectedOccurrence.id;
      const selectedGoalId = selectedOccurrence.goalId || "";
      const current = sourceState?.ui?.activeSession;
      let next = sourceState;
      if (!current || !isRuntimeSessionOpen(current) || current.occurrenceId !== selectedOccurrenceId) {
        next = applySessionRuntimeTransition(next, {
          type: "start",
          occurrenceId: selectedOccurrenceId,
          dateKey: selectedOccurrence.date || effectiveDateKey,
          objectiveId: null,
          habitIds: selectedGoalId ? [selectedGoalId] : [],
        });
      }
      const resumed = applySessionRuntimeTransition(next, {
        type: "resume",
        occurrenceId: selectedOccurrenceId,
        dateKey: selectedOccurrence.date || effectiveDateKey,
        durationSec: 0,
      });
      return guidedRuntimeSnapshot
        ? persistActiveGuidedRuntime(resumed, {
            occurrenceId: selectedOccurrenceId,
            snapshot: guidedRuntimeSnapshot,
          })
        : resumed;
    },
    [effectiveDateKey, selectedOccurrence?.date, selectedOccurrence?.goalId, selectedOccurrence?.id]
  );

  function startTimer({ guidedRuntimeSnapshot = null } = {}) {
    if (!selectedOccurrence?.id || typeof setData !== "function") return;
    const selectedOccurrenceId = selectedOccurrence.id;
    const nextRuntimeState = buildStartedRuntimeState(safeData, guidedRuntimeSnapshot);
    saveState(nextRuntimeState);
    setData((prev) => buildStartedRuntimeState(prev, guidedRuntimeSnapshot));
    emitSessionRuntimeNotificationHook("resume", {
      occurrenceId: selectedOccurrenceId,
      dateKey: selectedOccurrence.date || effectiveDateKey,
      runtimePhase: "in_progress",
      source: "session_start_timer",
    });
  }

  function pauseTimer() {
    if (!session?.occurrenceId || typeof setData !== "function") return;
    setData((prev) =>
      applySessionRuntimeTransition(prev, {
        type: "pause",
        occurrenceId: session.occurrenceId,
        dateKey: selectedOccurrence?.date || effectiveDateKey,
        durationSec: elapsedSec,
      })
    );
    emitSessionRuntimeNotificationHook("pause", {
      occurrenceId: session.occurrenceId,
      dateKey: selectedOccurrence?.date || effectiveDateKey,
      runtimePhase: "paused",
      source: "session_pause_timer",
    });
  }

  function resumeTimer() {
    if (!session?.occurrenceId || typeof setData !== "function") return;
    setData((prev) =>
      applySessionRuntimeTransition(prev, {
        type: "resume",
        occurrenceId: session.occurrenceId,
        dateKey: selectedOccurrence?.date || effectiveDateKey,
        durationSec: elapsedSec,
      })
    );
    emitSessionRuntimeNotificationHook("resume", {
      occurrenceId: session.occurrenceId,
      dateKey: selectedOccurrence?.date || effectiveDateKey,
      runtimePhase: "in_progress",
      source: "session_resume_timer",
    });
  }

  function endSession() {
    if (!session?.occurrenceId || typeof setData !== "function" || !feedbackLevel) return;
    const occurrenceGoalId = selectedOccurrence?.goalId || "";
    let feedbackSignal = null;
    setData((prev) =>
      {
        const next = applySessionRuntimeTransition(prev, {
          type: "finish",
          occurrenceId: session.occurrenceId,
          dateKey: selectedOccurrence?.date || effectiveDateKey,
          doneHabitIds: occurrenceGoalId ? [occurrenceGoalId] : [],
          durationSec: elapsedSec,
          feedbackLevel,
          feedbackText,
        });
        feedbackSignal = deriveBehaviorFeedbackSignal({
          intent: "finish_session",
          payload: {
            surface: "session",
            categoryId: category?.id || goal?.categoryId || effectiveCategoryId || null,
            streakDays: computeStreakDays(next, new Date()),
          },
        });
        return next;
      }
    );
    setShowFeedback(false);
    if (feedbackSignal) emitBehaviorFeedback(feedbackSignal);
    emitSessionRuntimeNotificationHook("finish", {
      occurrenceId: session.occurrenceId,
      dateKey: selectedOccurrence?.date || effectiveDateKey,
      runtimePhase: "done",
      source: "session_manual_finish",
    });
  }

  function cancelSession() {
    if (!session?.occurrenceId || typeof setData !== "function") return;
    setData((prev) =>
      applySessionRuntimeTransition(prev, {
        type: "cancel",
        occurrenceId: session.occurrenceId,
        dateKey: selectedOccurrence?.date || effectiveDateKey,
        durationSec: elapsedSec,
      })
    );
  }
  void cancelSession;

  const blockSession = () => {
    if (!session?.occurrenceId || typeof setData !== "function") return;
    setData((prev) =>
      applySessionRuntimeTransition(prev, {
        type: "block",
        occurrenceId: session.occurrenceId,
        dateKey: selectedOccurrence?.date || effectiveDateKey,
        durationSec: elapsedSec,
      })
    );
    emitSessionRuntimeNotificationHook("cancel", {
      occurrenceId: session.occurrenceId,
      dateKey: selectedOccurrence?.date || effectiveDateKey,
      runtimePhase: "blocked",
      source: "session_blocked",
    });
  };

  const openPlanningForReschedule = () => {
    if (!selectedOccurrence?.id || typeof setData !== "function") return;
    const targetDateKey = normalizeLocalDateKey(selectedOccurrence?.date) || todayLocalKey();
    const targetCategoryId = category?.id || null;
    setData((prev) => {
      const reported = session?.occurrenceId
        ? applySessionRuntimeTransition(prev, {
            type: "report",
            occurrenceId: session.occurrenceId,
            dateKey: selectedOccurrence?.date || effectiveDateKey,
            durationSec: elapsedSec,
          })
        : prev;
      return {
        ...reported,
        ui: withExecutionActiveCategoryId(
          {
            ...(reported?.ui || {}),
            selectedDateKey: targetDateKey,
            selectedDate: targetDateKey,
            planningPendingOccurrenceId: selectedOccurrence.id,
            planningPendingIntent: "reschedule",
          },
          targetCategoryId
        ),
      };
    });
    setReportMode(false);
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: "reschedule_action",
        payload: {
          surface: "session",
          categoryId: targetCategoryId,
        },
      })
    );
    setTab?.("timeline");
  };

  const applyQuickReport = (target) => {
    if (!selectedOccurrence?.id || typeof setData !== "function") return;
    if (target === "planning") {
      openPlanningForReschedule();
      return;
    }
    const nextDateKey = target === "tomorrow" ? addDaysLocal(todayLocalKey(), 1) : todayLocalKey();
    const preferredStart =
      target === "later_today"
        ? roundUpToQuarterHour(new Date())
        : selectedOccurrence?.start || minutesToTimeStr(Math.max(parseTimeToMinutes(selectedOccurrence?.start || "09:00") || 540, 540));
    const resolved = resolveConflictNearest(
      occurrences.filter((occurrenceItem) => occurrenceItem?.id !== selectedOccurrence.id),
      nextDateKey,
      preferredStart,
      plannedMinutes || 30,
      []
    );
    if (resolved?.conflict) {
      openPlanningForReschedule();
      return;
    }
    setData((prev) => {
      const nextOccurrences = updateOccurrence(
        selectedOccurrence.id,
        {
          date: nextDateKey,
          start: resolved.start,
          slotKey: resolved.start,
          status: "planned",
        },
        prev
      );
      const next = { ...prev, occurrences: nextOccurrences };
      return session?.occurrenceId
        ? applySessionRuntimeTransition(next, {
            type: "report",
            occurrenceId: session.occurrenceId,
            dateKey: selectedOccurrence?.date || effectiveDateKey,
            durationSec: elapsedSec,
          })
        : next;
    });
    setReportMode(false);
    emitBehaviorFeedback(
      deriveBehaviorFeedbackSignal({
        intent: "reschedule_action",
        payload: {
          surface: "session",
          categoryId: category?.id || effectiveCategoryId || null,
        },
      })
    );
  };

  if (!selectedOccurrence && !session) {
    return (
      <AppScreen
        pageId="session"
        headerTitle={<span>Session</span>}
        headerSubtitle={<span>Exécution</span>}
      >
        <AppCard className="sessionFallbackCard">
          <div className="sessionFallbackBody">
            <div className="sessionMeta">Aucune occurrence sélectionnée.</div>
            <div className="sessionActions">
              <GhostButton className="sessionActionButton" onClick={onBack}>← Retour</GhostButton>
              {onOpenLibrary ? (
                <GhostButton className="sessionActionButton" onClick={onOpenLibrary}>
                  Ouvrir Objectifs
                </GhostButton>
              ) : null}
            </div>
          </div>
        </AppCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      className={`${sessionScreenClassName} sessionScreen--immersive`}
      pageId="session"
      headerTitle={null}
      headerSubtitle={null}
      headerRight={null}
    >
      <div className={`sessionScreenBody${isPrelaunchPhase ? " sessionScreenBody--launch" : " sessionScreenBody--runtime"}`}>
        <SessionTopChrome
          isPrelaunch={isPrelaunchPhase}
          categoryName={category?.name || ""}
          onBack={onBack}
        />
        {shouldShowLaunchSurface ? (
          <SessionLaunchView
            phase={launchPhase}
            categoryName={category?.name || "Catégorie"}
            title={goal?.title || "Session"}
            timingLabel={sessionTimingLabel}
            durationLabel={Number.isFinite(effectivePlannedMinutes) ? `${effectivePlannedMinutes} min` : ""}
            why={blueprintSnapshot?.why || ""}
            firstStep={blueprintSnapshot?.firstStep || ""}
            onStartStandard={handleLaunchStandard}
            onPrepareGuided={handlePrepareGuided}
          />
        ) : (
          <FocusSessionView
            title={goal?.title || "Session"}
            categoryName={category?.name || "Catégorie"}
            actionProtocol={effectiveActionProtocol}
            guidedPlan={effectiveLaunchMode === "guided" ? guidedPlan : null}
            guidedMode={effectiveLaunchMode === "guided" ? guidedMode : ""}
            adjustmentLabel={currentAdjustmentLabel}
            adjustmentSummary={currentAdjustmentSummary}
            behaviorCue={sessionBehaviorCue}
            plannedDurationLabel={Number.isFinite(effectivePlannedMinutes) ? `${effectivePlannedMinutes} min` : ""}
            elapsedLabel={formatElapsed(elapsedSec * 1000)}
            remainingLabel={remainingSec != null ? formatElapsed(remainingSec * 1000) : ""}
            timerLabel={
              viewState === "completed" || viewState === "blocked" || viewState === "reported"
                ? formatElapsed(elapsedSec * 1000)
                : remainingSec != null
                  ? formatElapsed(remainingSec * 1000)
                  : formatElapsed(elapsedSec * 1000)
            }
            viewState={viewState}
            canStart={Boolean(selectedOccurrence?.id) && (viewState === "idle" || viewState === "paused")}
            canPause={viewState === "running"}
            canComplete={Boolean(session?.occurrenceId) && isRuntimeSessionOpen(session)}
            onStart={
              guidedMode === "preview"
                ? handleStartGuidedSession
                : viewState === "paused"
                  ? resumeTimer
                  : startTimer
            }
            onPause={pauseTimer}
            onComplete={() => setShowFeedback(true)}
            onBlock={blockSession}
            onOpenReport={() => setReportMode((current) => !current)}
            onOpenAdjust={canAdjustGuided ? openGuidedAdjust : openStandardAdjust}
            onOpenTools={openGuidedTools}
            onRegenerateGuided={handleRegenerateGuided}
            onRevertToStandard={handleRevertToStandard}
            onViewGuidedStep={handleViewGuidedStep}
            onReturnToActiveGuidedStep={handleReturnToActiveGuidedStep}
            onToggleGuidedChecklistItem={handleToggleGuidedChecklistItem}
            onAdvanceGuidedStep={handleAdvanceGuidedStep}
            showAdjust={viewState !== "completed" && viewState !== "blocked" && viewState !== "reported" && (canAdjustGuided || canAdjustStandard)}
            showTools={viewState !== "completed" && viewState !== "blocked" && viewState !== "reported" && canOpenGuidedTools}
            adjustMode={canAdjustGuided ? "guided" : "standard"}
            guidedRegenerating={syncedGuidedSpatialState?.isRegenerating === true}
            toolTray={
              guidedMode === "active" && activeToolUtilitySnapshot ? (
                <SessionToolTray
                  utility={activeToolUtilitySnapshot}
                  onStart={handleStartToolUtility}
                  onPause={handlePauseToolUtility}
                  onReset={handleResetToolUtility}
                  onClose={handleCloseToolUtility}
                  onToggleCollapse={handleToggleToolUtility}
                />
              ) : null
            }
            showFeedback={showFeedback}
            feedbackLevel={feedbackLevel}
            feedbackText={feedbackText}
            onFeedbackLevelChange={setFeedbackLevel}
            onFeedbackTextChange={setFeedbackText}
            onFeedbackSubmit={endSession}
            reportMode={reportMode}
            onChooseReport={applyQuickReport}
          />
        )}
      </div>
      <SessionAdjustSheet
        open={Boolean(adjustSheetMode)}
        mode={adjustSheetMode || "standard"}
        causes={adjustCauses}
        selectedCause={adjustCause}
        options={activeAdjustOptions}
        currentSummary={currentAdjustmentSummary}
        loading={adjustLoading}
        onClose={closeAdjustSheet}
        onSelectCause={setAdjustCause}
        onResetCause={() => setAdjustCause("")}
        onApply={handleApplyAdjustment}
      />
      <SessionToolsSheet
        open={toolsSheetOpen}
        tools={guidedTools}
        loading={toolsLoading}
        activeStepLabel={guidedPlan?.currentStep?.label || ""}
        viewedStepIsActive={guidedPlan?.isViewedStepActive !== false}
        onClose={closeToolsSheet}
        onSelectTool={handleExecuteTool}
      />
      <SessionToolResultSheet
        open={Boolean(activeToolArtifact)}
        artifact={activeToolArtifact}
        loading={toolsLoading}
        onClose={handleCloseToolResult}
        onCopy={handleCopyToolResult}
        onRegenerate={handleRegenerateToolResult}
      />
    </AppScreen>
  );
}
