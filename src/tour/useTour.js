import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useTour({ data, setData, steps, tourVersion }) {
  const safeSteps = useMemo(() => (Array.isArray(steps) ? steps.filter(Boolean) : []), [steps]);
  const totalSteps = safeSteps.length;
  const ui = data?.ui || {};
  const onboardingCompleted = Boolean(ui.onboardingCompleted);
  const isDragging = Boolean(ui.isDragging);

  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const stepIndexRef = useRef(0);
  const missingCountRef = useRef(0);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    if (!onboardingCompleted || totalSteps === 0) {
      setIsActive(false);
      return;
    }
    if (isDragging) {
      setIsActive(false);
      return;
    }
    const seenVersion = typeof ui.tourSeenVersion === "number" ? ui.tourSeenVersion : 0;
    const shouldStart = ui.tourForceStart === true || seenVersion < tourVersion;
    if (!shouldStart) {
      setIsActive(false);
      return;
    }
    const startIndex = typeof ui.tourStepIndex === "number" ? ui.tourStepIndex : 0;
    const clamped = Math.min(Math.max(0, startIndex), totalSteps - 1);
    setStepIndex(clamped);
    setIsActive(true);
  }, [
    onboardingCompleted,
    totalSteps,
    isDragging,
    ui.tourForceStart,
    ui.tourSeenVersion,
    ui.tourStepIndex,
    tourVersion,
  ]);

  useEffect(() => {
    if (!isActive || typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      if (prevUi.tourStepIndex === stepIndex) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          tourStepIndex: stepIndex,
        },
      };
    });
  }, [isActive, stepIndex, setData]);

  const end = useCallback(() => {
    setIsActive(false);
    setStepIndex(0);
    missingCountRef.current = 0;
    if (typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: {
        ...(prev.ui || {}),
        tourSeenVersion: tourVersion,
        tourForceStart: false,
        tourStepIndex: 0,
      },
    }));
  }, [setData, tourVersion]);

  const next = useCallback(() => {
    const current = stepIndexRef.current;
    if (current + 1 >= totalSteps) {
      end();
      return;
    }
    missingCountRef.current = 0;
    setStepIndex(current + 1);
  }, [end, totalSteps]);

  const prev = useCallback(() => {
    const current = stepIndexRef.current;
    const nextIndex = Math.max(0, current - 1);
    missingCountRef.current = 0;
    setStepIndex(nextIndex);
  }, []);

  const skip = useCallback(() => {
    end();
  }, [end]);

  const handleMissingAnchor = useCallback(
    (step) => {
      if (step?.anchor || step?.id) {
        // eslint-disable-next-line no-console
        console.warn(`[tour] anchor not found`, { id: step?.id, anchor: step?.anchor });
      }
      missingCountRef.current += 1;
      if (missingCountRef.current >= 5) {
        end();
        return;
      }
      next();
    },
    [end, next]
  );

  const handleAnchorFound = useCallback(() => {
    missingCountRef.current = 0;
  }, []);

  const step = safeSteps[stepIndex] || null;
  useEffect(() => {
    if (!isActive || !step) return;
    const debug = typeof window !== "undefined" && window.__debugTour;
    if (debug) {
      // eslint-disable-next-line no-console
      console.debug("[tour] resolve", {
        id: step.id,
        anchor: step.anchor,
        index: stepIndex,
        total: totalSteps,
      });
    }
  }, [isActive, step, stepIndex, totalSteps]);

  return {
    isActive,
    step,
    stepIndex,
    totalSteps,
    next,
    prev,
    skip,
    end,
    handleMissingAnchor,
    handleAnchorFound,
  };
}
