import React, { useEffect, useMemo, useRef, useState } from "react";
import TourOverlay from "./TourOverlay";
import { useTour } from "./useTour";
import { useTourContext } from "./TourContext";

const RESOLVE_RETRY_MS = 350;
const RESOLVE_RETRIES = 3;

function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  return "PROCESS";
}

function countGoals(data, type) {
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  return goals.filter((g) => resolveGoalType(g) === type).length;
}

function getHomeCategory(data) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const ui = data?.ui || {};
  const id = ui.selectedCategoryByView?.home || ui.selectedCategoryId || categories[0]?.id || null;
  return categories.find((c) => c.id === id) || null;
}

function resolveAnchor(step, resolveTick) {
  if (!step) return { id: null, el: null };
  const list = Array.isArray(step.anchor) ? step.anchor : step.anchor ? [step.anchor] : [];
  for (const id of list) {
    if (!id || typeof document === "undefined") continue;
    const el = document.querySelector(`[data-tour-id="${id}"]`);
    if (el) return { id, el };
  }
  return { id: null, el: null };
}

export default function TourRunner({ data, setData, tab, setTab, steps, tourVersion }) {
  const tourState = useTourContext();
  const tour = useTour({ data, setData, steps, tourVersion, tourState });
  const { isActive, step, stepIndex, totalSteps, next, prev, skip, end, handleMissingAnchor, handleAnchorFound } = tour;

  const baselineRef = useRef(null);
  const lastAutoAdvanceRef = useRef(null);
  const lastNavigateRef = useRef(null);
  const retryRef = useRef(0);
  const [resolveTick, setResolveTick] = useState(0);
  const [, setValueTick] = useState(0);
  const getAnchorValue = useMemo(
    () => (anchorId) => {
      if (!anchorId || typeof document === "undefined") return "";
      const el = document.querySelector(`[data-tour-id="${anchorId}"]`);
      if (!el) return "";
      if ("value" in el) return String(el.value || "");
      return "";
    },
    []
  );

  useEffect(() => {
    if (!isActive) {
      baselineRef.current = null;
      lastAutoAdvanceRef.current = null;
      lastNavigateRef.current = null;
      retryRef.current = 0;
      return;
    }
    if (!baselineRef.current) {
      baselineRef.current = {
        categories: Array.isArray(data?.categories) ? data.categories.length : 0,
        outcomes: countGoals(data, "OUTCOME"),
        actions: countGoals(data, "PROCESS"),
      };
    }
  }, [isActive, data]);

  const ctx = useMemo(
    () => ({
      data,
      tab,
      baseline: baselineRef.current || { categories: 0, outcomes: 0, actions: 0 },
      homeCategory: getHomeCategory(data),
      getAnchorValue,
    }),
    [data, tab, getAnchorValue]
  );

  const canContinue = step?.isComplete ? Boolean(step.isComplete(ctx)) : true;

  useEffect(() => {
    if (!isActive || !step || !step.navigate || typeof setTab !== "function") return;
    if (lastNavigateRef.current === step.id) return;
    const targetTab = step.navigate?.tab;
    if (targetTab && tab !== targetTab) {
      lastNavigateRef.current = step.id;
      setTab(targetTab);
    }
  }, [isActive, step, tab, setTab]);

  const resolved = useMemo(() => resolveAnchor(step, resolveTick), [step, resolveTick, tab]);

  useEffect(() => {
    if (!isActive || typeof window === "undefined") return;
    const bump = () => setValueTick((v) => v + 1);
    window.addEventListener("input", bump, true);
    window.addEventListener("change", bump, true);
    return () => {
      window.removeEventListener("input", bump, true);
      window.removeEventListener("change", bump, true);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !step) return;
    if (!resolved.el) {
      if (retryRef.current >= RESOLVE_RETRIES) {
        retryRef.current = 0;
        handleMissingAnchor(step);
        return;
      }
      const id = window.setTimeout(() => {
        retryRef.current += 1;
        setResolveTick((v) => v + 1);
      }, RESOLVE_RETRY_MS);
      return () => window.clearTimeout(id);
    }
    retryRef.current = 0;
    handleAnchorFound(step);
  }, [isActive, step, resolved.el, handleMissingAnchor, handleAnchorFound]);

  useEffect(() => {
    if (!isActive || !step || !step.autoAdvanceOnComplete) return;
    if (!canContinue) return;
    if (lastAutoAdvanceRef.current === step.id) return;
    lastAutoAdvanceRef.current = step.id;
    if (stepIndex + 1 >= totalSteps) {
      end();
      return;
    }
    next();
  }, [isActive, step, canContinue, stepIndex, totalSteps, end, next]);

  if (!isActive || !step) return null;

  return (
    <TourOverlay
      isActive={isActive}
      step={step}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      anchorEl={resolved.el}
      onNext={next}
      onPrev={prev}
      onSkip={skip}
      disableNext={!canContinue}
    />
  );
}
