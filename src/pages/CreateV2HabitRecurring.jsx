import React, { useEffect } from "react";
import CreateV2Habits from "./CreateV2Habits";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";

// App convention: 1 = Monday ... 7 = Sunday
function appDowFromDate(d) {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function sameArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Planned recurring action entry point.
 *
 * Invariants for this route:
 * - habitType = RECURRING
 * - repeat = weekly
 * - at least 1 day selected (daysOfWeek)
 * - not flexible-anytime
 * - never uses oneOffDate
 *
 * The detailed UI is handled in CreateV2Habits; this page only seeds/locks draft invariants
 * without pre-creating any habit item.
 */
export default function CreateV2HabitRecurring(props) {
  const { setData } = props;

  useEffect(() => {
    if (typeof setData !== "function") return;

    setData((prev) => {
      const ui = prev?.ui || {};
      const current = normalizeCreationDraft(ui.createDraft);

      const currentDays = Array.isArray(current.daysOfWeek) ? current.daysOfWeek : [];
      const defaultDays = currentDays.length ? currentDays : [appDowFromDate(new Date())];

      const nextDraft = {
        ...current,
        step: STEP_HABITS,
        habitType: "RECURRING",

        // Keep this flag for forward-compat (harmless if unused)
        uxV2: true,

        // Never flexible here
        anytimeFlexible: false,

        // Unified model: recurring is always weekly (days-driven)
        repeat: "weekly",
        daysOfWeek: defaultDays,

        // Never one-off date in recurring flows
        oneOffDate: "",

        // Never overwrite user-entered items.
        habits: Array.isArray(current.habits) ? current.habits : [],

        // Provide safe defaults if missing; do not force choices.
        scheduleMode: current.scheduleMode || "STANDARD",
        timeMode: current.timeMode || "NONE",
        timeSlots: Array.isArray(current.timeSlots) ? current.timeSlots : [],
        startTime: typeof current.startTime === "string" ? current.startTime : "",
      };

      const noChange =
        current.step === nextDraft.step &&
        current.habitType === nextDraft.habitType &&
        (current.uxV2 || false) === (nextDraft.uxV2 || false) &&
        (current.anytimeFlexible || false) === (nextDraft.anytimeFlexible || false) &&
        (current.repeat || "") === (nextDraft.repeat || "") &&
        sameArray(current.daysOfWeek || [], nextDraft.daysOfWeek || []) &&
        (current.oneOffDate || "") === (nextDraft.oneOffDate || "") &&
        (current.scheduleMode || "") === (nextDraft.scheduleMode || "") &&
        (current.timeMode || "") === (nextDraft.timeMode || "") &&
        (typeof current.startTime === "string" ? current.startTime : "") === nextDraft.startTime &&
        Array.isArray(current.habits) &&
        Array.isArray(nextDraft.habits) &&
        current.habits.length === nextDraft.habits.length &&
        Array.isArray(current.timeSlots) &&
        Array.isArray(nextDraft.timeSlots) &&
        current.timeSlots.length === nextDraft.timeSlots.length;

      if (noChange) return prev;

      return {
        ...prev,
        ui: {
          ...ui,
          createDraft: nextDraft,
        },
      };
    });
  }, [setData]);

  return <CreateV2Habits {...props} createVariant="RECURRING" />;
}