import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppToast, StatusBadge } from "../shared/ui/app";
import { getCategoryUiVars } from "../utils/categoryAccent";
import { resolveCategoryColor } from "../utils/categoryPalette";
import {
  BEHAVIOR_FEEDBACK_MOTION,
  createBehaviorFeedbackSignal,
  isBehaviorFeedbackSignal,
} from "./feedbackSignals";
import "./behaviorFeedback.css";

const BehaviorFeedbackContext = createContext({
  currentSignal: null,
  emitBehaviorFeedback: () => false,
  dismissBehaviorFeedback: () => {},
});

function useTimersRef() {
  return useRef({
    enterFrameId: 0,
    visibleTimerId: 0,
    exitTimerId: 0,
  });
}

function clearTimers(timersRef) {
  const timers = timersRef.current;
  if (timers.enterFrameId && typeof window !== "undefined") {
    window.cancelAnimationFrame(timers.enterFrameId);
  }
  if (timers.visibleTimerId && typeof window !== "undefined") {
    window.clearTimeout(timers.visibleTimerId);
  }
  if (timers.exitTimerId && typeof window !== "undefined") {
    window.clearTimeout(timers.exitTimerId);
  }
  timers.enterFrameId = 0;
  timers.visibleTimerId = 0;
  timers.exitTimerId = 0;
}

export function BehaviorFeedbackProvider({ children }) {
  const [currentSignal, setCurrentSignal] = useState(null);
  const [phase, setPhase] = useState("idle");
  const timersRef = useTimersRef();
  const currentSignalRef = useRef(null);
  const cooldownRef = useRef(new Map());

  const dismissBehaviorFeedback = useCallback(() => {
    if (!currentSignalRef.current || typeof window === "undefined") {
      currentSignalRef.current = null;
      setCurrentSignal(null);
      setPhase("idle");
      return;
    }
    clearTimers(timersRef);
    setPhase("exit");
    timersRef.current.exitTimerId = window.setTimeout(() => {
      currentSignalRef.current = null;
      setCurrentSignal(null);
      setPhase("idle");
      timersRef.current.exitTimerId = 0;
    }, BEHAVIOR_FEEDBACK_MOTION.exitMs);
  }, [timersRef]);

  const mountSignal = useCallback(
    (inputSignal) => {
      if (!inputSignal || typeof window === "undefined") return false;
      clearTimers(timersRef);
      currentSignalRef.current = inputSignal;
      setCurrentSignal(inputSignal);
      setPhase("enter");
      timersRef.current.enterFrameId = window.requestAnimationFrame(() => {
        setPhase("visible");
        timersRef.current.enterFrameId = 0;
      });
      timersRef.current.visibleTimerId = window.setTimeout(() => {
        dismissBehaviorFeedback();
        timersRef.current.visibleTimerId = 0;
      }, BEHAVIOR_FEEDBACK_MOTION.visibleMs);
      return true;
    },
    [dismissBehaviorFeedback, timersRef]
  );

  const emitBehaviorFeedback = useCallback(
    (candidate) => {
      const signal = isBehaviorFeedbackSignal(candidate)
        ? candidate
        : createBehaviorFeedbackSignal(candidate);
      if (!signal) return false;
      const now = Date.now();
      const cooldownKey = signal.cooldownKey || signal.message;
      const lastSeenAt = cooldownRef.current.get(cooldownKey) || 0;
      if (lastSeenAt && now - lastSeenAt < BEHAVIOR_FEEDBACK_MOTION.cooldownMs) {
        return false;
      }

      const current = currentSignalRef.current;
      if (current && signal.priority <= current.priority) {
        return false;
      }

      cooldownRef.current.set(cooldownKey, now);
      return mountSignal(signal);
    },
    [mountSignal]
  );

  useEffect(() => () => clearTimers(timersRef), [timersRef]);

  const value = useMemo(
    () => ({
      currentSignal,
      phase,
      emitBehaviorFeedback,
      dismissBehaviorFeedback,
    }),
    [currentSignal, dismissBehaviorFeedback, emitBehaviorFeedback, phase]
  );

  return <BehaviorFeedbackContext.Provider value={value}>{children}</BehaviorFeedbackContext.Provider>;
}

export function useBehaviorFeedback() {
  return useContext(BehaviorFeedbackContext);
}

export function BehaviorFeedbackHost({ categories = [] }) {
  const { currentSignal, phase } = useBehaviorFeedback();
  if (!currentSignal || typeof document === "undefined") return null;
  const category =
    Array.isArray(categories) && currentSignal.categoryId
      ? categories.find((entry) => entry?.id === currentSignal.categoryId) || null
      : null;
  const accentVars = category ? getCategoryUiVars(category, { level: "surface" }) : null;

  return createPortal(
    <div className="behaviorFeedbackViewport" aria-live="polite" aria-atomic="true">
      <AppToast
        className={`behaviorFeedbackToast is-${phase}${category ? " hasCategory" : ""}`}
        role="status"
        style={accentVars || undefined}
      >
        <div className="behaviorFeedbackToastInner">
          <span className="behaviorFeedbackCheck" aria-hidden="true">
            ✓
          </span>
          <span className="behaviorFeedbackMessage">{currentSignal.message}</span>
        </div>
      </AppToast>
    </div>,
    document.body
  );
}

export function BehaviorCue({ cue, category = null, className = "" }) {
  const message = typeof cue === "string" ? cue.trim() : cue?.message || "";
  if (!message) return null;
  return (
    <StatusBadge
      tone="info"
      className={`behaviorCue behaviorCue--${cue?.cueKind || "structure"}${className ? ` ${className}` : ""}`}
      style={category ? { "--behaviorCueAccent": resolveCategoryColor(category, "#4F7CFF") } : undefined}
    >
      <span className="behaviorCueDot" aria-hidden="true" />
      <span>{message}</span>
    </StatusBadge>
  );
}
