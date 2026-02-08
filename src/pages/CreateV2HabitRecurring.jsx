import React, { useEffect } from "react";
import CreateV2Habits from "./CreateV2Habits";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";
import { addDaysLocal, appDowFromDate, toLocalDateKey } from "../utils/datetime";
import { sameArray } from "../utils/helpers";

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

        // V3: mandatory period for actions (PROCESS)
        lifecycleMode: current.lifecycleMode || "FIXED",
        activeFrom: typeof current.activeFrom === "string" && current.activeFrom ? current.activeFrom : toLocalDateKey(new Date()),
        activeTo:
          typeof current.activeTo === "string" && current.activeTo
            ? current.activeTo
            : addDaysLocal(
                typeof current.activeFrom === "string" && current.activeFrom ? current.activeFrom : toLocalDateKey(new Date()),
                29
              ),

        // Completion semantics (defaults; can be refined in CreateV2Habits UI later)
        completionMode: current.completionMode || "ONCE",
        completionTarget: current.completionMode === "ONCE" ? null : current.completionTarget ?? null,
        missPolicy: current.missPolicy || "LENIENT",
        graceMinutes: typeof current.graceMinutes === "number" ? current.graceMinutes : 0,

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
        (current.lifecycleMode || "") === (nextDraft.lifecycleMode || "") &&
        (current.activeFrom || "") === (nextDraft.activeFrom || "") &&
        (current.activeTo || "") === (nextDraft.activeTo || "") &&
        (current.completionMode || "") === (nextDraft.completionMode || "") &&
        (current.completionTarget ?? null) === (nextDraft.completionTarget ?? null) &&
        (current.missPolicy || "") === (nextDraft.missPolicy || "") &&
        (current.graceMinutes ?? 0) === (nextDraft.graceMinutes ?? 0) &&
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

  return <CreateV2Habits {...props} createVariant="RECURRING" skin={props.skin || ""} />;
}
