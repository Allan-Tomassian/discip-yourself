import React, { useEffect } from "react";
import CreateV2Habits from "./CreateV2Habits";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";
import { addDaysLocal, appDowFromDate, toLocalDateKey } from "../utils/datetime";
import { sameArray } from "../utils/helpers";

/**
 * Flexible action entry point.
 *
 * Invariants for this route:
 * - habitType = ANYTIME
 * - never uses scheduling/time (timeMode NONE, no startTime, no timeSlots)
 * - never uses oneOffDate
 * - recurrence is still weekly-based when days are provided (daysOfWeek), but may be empty when "Flexible".
 *
 * NOTE: The detailed UI is handled in CreateV2Habits; this page only seeds/locks draft invariants.
 */
export default function CreateV2HabitAnytime(props) {
  const { setData } = props;

  useEffect(() => {
    if (typeof setData !== "function") return;

    setData((prev) => {
      const ui = prev?.ui || {};
      const current = normalizeCreationDraft(ui.createDraft);

      // Keep user-entered draft data when possible, only enforce invariants.
      const currentDays = Array.isArray(current.daysOfWeek) ? current.daysOfWeek : [];
      const defaultDays = currentDays.length ? currentDays : [appDowFromDate(new Date())];

      const nextDraft = {
        ...current,
        step: STEP_HABITS,
        habitType: "ANYTIME",

        // V3: mandatory period for actions (PROCESS)
        lifecycleMode: current.lifecycleMode || "FIXED",
        activeFrom:
          typeof current.activeFrom === "string" && current.activeFrom ? current.activeFrom : toLocalDateKey(new Date()),
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

        // If we already have a flag on the draft, preserve it. Otherwise default to false.
        anytimeFlexible: typeof current.anytimeFlexible === "boolean" ? current.anytimeFlexible : false,

        // Legacy mirrors used elsewhere in the app:
        repeat: "weekly",
        daysOfWeek: typeof current.anytimeFlexible === "boolean" && current.anytimeFlexible ? [] : defaultDays,

        // Never allow one-off date in flexible flows
        oneOffDate: "",

        // Never allow time/scheduling in this route
        timeMode: "NONE",
        startTime: "",
        timeSlots: [],
        scheduleMode: "STANDARD",
        weeklySlotsByDay: {},

        // Mark as v2-capable (harmless even if not used)
        uxV2: true,
      };

      const noChange =
        current.step === nextDraft.step &&
        current.habitType === nextDraft.habitType &&
        (current.uxV2 || false) === (nextDraft.uxV2 || false) &&
        (current.lifecycleMode || "") === (nextDraft.lifecycleMode || "") &&
        (current.activeFrom || "") === (nextDraft.activeFrom || "") &&
        (current.activeTo || "") === (nextDraft.activeTo || "") &&
        (current.completionMode || "") === (nextDraft.completionMode || "") &&
        (current.completionTarget ?? null) === (nextDraft.completionTarget ?? null) &&
        (current.missPolicy || "") === (nextDraft.missPolicy || "") &&
        (current.graceMinutes ?? 0) === (nextDraft.graceMinutes ?? 0) &&
        (current.anytimeFlexible || false) === (nextDraft.anytimeFlexible || false) &&
        (current.repeat || "") === (nextDraft.repeat || "") &&
        sameArray(current.daysOfWeek || [], nextDraft.daysOfWeek || []) &&
        (current.oneOffDate || "") === (nextDraft.oneOffDate || "") &&
        (current.timeMode || "") === (nextDraft.timeMode || "") &&
        (current.startTime || "") === (nextDraft.startTime || "") &&
        Array.isArray(current.timeSlots || []) &&
        Array.isArray(nextDraft.timeSlots || []) &&
        (current.timeSlots || []).length === (nextDraft.timeSlots || []).length &&
        (current.scheduleMode || "") === (nextDraft.scheduleMode || "");

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

  return <CreateV2Habits {...props} createVariant="ANYTIME" skin={props.skin || ""} />;
}
