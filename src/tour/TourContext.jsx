import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "discp.tour.v1";

const DEFAULT_STATE = {
  status: "idle",
  hasSeenTour: false,
  stepIndex: 0,
};

function loadState() {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      status: parsed?.status || "idle",
      hasSeenTour: Boolean(parsed?.hasSeenTour),
      stepIndex: Number.isFinite(parsed?.stepIndex) ? parsed.stepIndex : 0,
    };
  } catch (_) {
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // Ignore storage failures.
  }
}

const TourContext = createContext(null);

export function TourProvider({ children }) {
  const [status, setStatus] = useState(DEFAULT_STATE.status);
  const [hasSeenTour, setHasSeenTour] = useState(DEFAULT_STATE.hasSeenTour);
  const [stepIndex, setStepIndex] = useState(DEFAULT_STATE.stepIndex);

  useEffect(() => {
    const stored = loadState();
    setStatus(stored.status);
    setHasSeenTour(stored.hasSeenTour);
    setStepIndex(stored.stepIndex);
  }, []);

  useEffect(() => {
    saveState({ status, hasSeenTour, stepIndex });
  }, [status, hasSeenTour, stepIndex]);

  const value = useMemo(
    () => ({
      status,
      setStatus,
      hasSeenTour,
      setHasSeenTour,
      stepIndex,
      setStepIndex,
    }),
    [status, hasSeenTour, stepIndex]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTourContext() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTourContext must be used within TourProvider");
  }
  return ctx;
}
