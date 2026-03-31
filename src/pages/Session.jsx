import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import FocusSessionView from "../components/session/FocusSessionView";
import { GateButton } from "../shared/ui/gate/Gate";
import { addDaysLocal, minutesToTimeStr, normalizeLocalDateKey, parseTimeToMinutes, todayLocalKey } from "../utils/datetime";
import { resolveExecutableOccurrence } from "../logic/sessionResolver";
import { updateOccurrence } from "../logic/occurrences";
import { applySessionRuntimeTransition, isRuntimeSessionOpen } from "../logic/sessionRuntime";
import { emitSessionRuntimeNotificationHook } from "../logic/sessionRuntimeNotifications";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryUiVars } from "../utils/categoryAccent";
import { resolveCategoryColor } from "../utils/categoryPalette";
import { resolveConflictNearest } from "../logic/occurrencePlanner";
import { normalizeActiveSessionForUI, normalizeOccurrenceForUI } from "../logic/compat";
import { withExecutionActiveCategoryId } from "../domain/categoryVisibility";
import { computeStreakDays } from "../logic/habits";
import { useBehaviorFeedback } from "../feedback/BehaviorFeedbackContext";
import { deriveBehaviorFeedbackSignal, deriveSessionBehaviorCue } from "../feedback/feedbackDerivers";
import "../features/session/session.css";

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

export default function Session({
  data,
  setData,
  onBack,
  onOpenLibrary,
  dateKey,
  occurrenceId,
  categoryId,
  setTab,
}) {
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
  const [tick, setTick] = useState(Date.now());
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackLevel, setFeedbackLevel] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [reportMode, setReportMode] = useState(false);

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
  const accent = resolveCategoryColor(category, getAccentForPage(safeData, "home"));
  const catAccentVars = getCategoryUiVars(category || accent, { level: "focus" });

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

  function startTimer() {
    if (!selectedOccurrence?.id || typeof setData !== "function") return;
    const selectedOccurrenceId = selectedOccurrence.id;
    const selectedGoalId = selectedOccurrence.goalId || "";
    setData((prev) => {
      const current = prev?.ui?.activeSession;
      let next = prev;
      if (!current || !isRuntimeSessionOpen(current) || current.occurrenceId !== selectedOccurrenceId) {
        next = applySessionRuntimeTransition(next, {
          type: "start",
          occurrenceId: selectedOccurrenceId,
          dateKey: selectedOccurrence.date || effectiveDateKey,
          objectiveId: null,
          habitIds: selectedGoalId ? [selectedGoalId] : [],
        });
      }
      return applySessionRuntimeTransition(next, {
        type: "resume",
        occurrenceId: selectedOccurrenceId,
        dateKey: selectedOccurrence.date || effectiveDateKey,
        durationSec: 0,
      });
    });
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
    setTab?.("planning");
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
      <ScreenShell
        accent={getAccentForPage(safeData, "home")}
        headerTitle={<span>Session</span>}
        headerSubtitle={<span>Exécution</span>}
      >
        <div className="col" style={{ gap: 12 }}>
          <div className="small2">Aucune occurrence sélectionnée.</div>
          <div className="row" style={{ gap: 8 }}>
            <GateButton variant="ghost" className="GatePressable" onClick={onBack}>← Retour</GateButton>
            {onOpenLibrary ? <GateButton variant="ghost" className="GatePressable" onClick={onOpenLibrary}>Ouvrir Bibliothèque</GateButton> : null}
          </div>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={category?.wallpaper || safeData?.profile?.whyImage || ""}
      headerTitle={<span>{goal?.title || "Session"}</span>}
      headerSubtitle={
        <div className="stack stackGap12">
        <div>{category?.name || "Catégorie"}</div>
          <GateButton variant="ghost" className="btnBackCompact backBtn GatePressable" onClick={onBack}>
            ← Retour
          </GateButton>
        </div>
      }
    >
      <div style={catAccentVars}>
        <FocusSessionView
          title={goal?.title || "Session"}
          categoryName={category?.name || "Catégorie"}
          behaviorCue={sessionBehaviorCue}
          plannedDurationLabel={Number.isFinite(plannedMinutes) ? `${plannedMinutes} min` : ""}
          elapsedLabel={formatElapsed(elapsedSec * 1000)}
          remainingLabel={remainingSec != null ? formatElapsed(remainingSec * 1000) : ""}
          viewState={viewState}
          canStart={Boolean(selectedOccurrence?.id) && (viewState === "idle" || viewState === "paused")}
          canPause={viewState === "running"}
          canComplete={Boolean(session?.occurrenceId) && isRuntimeSessionOpen(session)}
          onStart={viewState === "paused" ? resumeTimer : startTimer}
          onPause={pauseTimer}
          onComplete={() => setShowFeedback(true)}
          onBlock={blockSession}
          onOpenReport={() => setReportMode((current) => !current)}
          showFeedback={showFeedback}
          feedbackLevel={feedbackLevel}
          feedbackText={feedbackText}
          onFeedbackLevelChange={setFeedbackLevel}
          onFeedbackTextChange={setFeedbackText}
          onFeedbackSubmit={endSession}
          reportMode={reportMode}
          onChooseReport={applyQuickReport}
        />
      </div>
    </ScreenShell>
  );
}
