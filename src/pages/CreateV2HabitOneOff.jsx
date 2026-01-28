import React, { useEffect } from "react";
import CreateV2Habits from "./CreateV2Habits";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";

function localDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
 * One-off (ponctuelle) action entry point.
 *
 * Invariants for this route:
 * - habitType = ONE_OFF
 * - repeat = none
 * - oneOffDate required by the UI (we seed to today if empty, but never overwrite a chosen date)
 * - never uses daysOfWeek
 * - time is optional (handled by CreateV2Habits) but we do not force any time mode here
 * - never seeds/forces a habit item; CreateV2Habits owns draft item creation
 */
export default function CreateV2HabitOneOff(props) {
  const { setData } = props;

  useEffect(() => {
    if (typeof setData !== "function") return;

    setData((prev) => {
      const ui = prev?.ui || {};
      const current = normalizeCreationDraft(ui.createDraft);

      const seededOneOffDate = typeof current.oneOffDate === "string" ? current.oneOffDate : "";
      const nextOneOffDate = seededOneOffDate || localDateKey(new Date());

      const nextDraft = {
        ...current,
        step: STEP_HABITS,
        habitType: "ONE_OFF",

        // Mark as v2-capable (harmless even if not used everywhere)
        uxV2: true,

        // One-off model
        repeat: "none",
        daysOfWeek: [],
        oneOffDate: nextOneOffDate,

        // V3: mandatory lifecycle period for actions (PROCESS)
        lifecycleMode: "FIXED",
        activeFrom: nextOneOffDate,
        activeTo: nextOneOffDate,

        // Completion semantics (defaults; can be refined in CreateV2Habits UI later)
        completionMode: current.completionMode || "ONCE",
        completionTarget: current.completionMode === "ONCE" ? null : current.completionTarget ?? null,
        missPolicy: current.missPolicy || "LENIENT",
        graceMinutes: typeof current.graceMinutes === "number" ? current.graceMinutes : 0,

        // Never flexible here
        anytimeFlexible: false,

        // Do not force schedule/time choices; keep user's fields if already set.
        scheduleMode: current.scheduleMode || "STANDARD",
        timeMode: current.timeMode || "NONE",
        timeSlots: Array.isArray(current.timeSlots) ? current.timeSlots : [],
        startTime: typeof current.startTime === "string" ? current.startTime : "",
        weeklySlotsByDay: current.weeklySlotsByDay && typeof current.weeklySlotsByDay === "object" ? current.weeklySlotsByDay : {},

        // Preserve any existing draft items (do NOT auto-create one here)
        habits: Array.isArray(current.habits) ? current.habits : [],
      };

      const noChange =
        current.step === nextDraft.step &&
        current.habitType === nextDraft.habitType &&
        (current.uxV2 || false) === (nextDraft.uxV2 || false) &&
        (current.repeat || "") === (nextDraft.repeat || "") &&
        sameArray(current.daysOfWeek || [], nextDraft.daysOfWeek || []) &&
        (current.oneOffDate || "") === (nextDraft.oneOffDate || "") &&
        (current.lifecycleMode || "") === (nextDraft.lifecycleMode || "") &&
        (current.activeFrom || "") === (nextDraft.activeFrom || "") &&
        (current.activeTo || "") === (nextDraft.activeTo || "") &&
        (current.completionMode || "") === (nextDraft.completionMode || "") &&
        (current.completionTarget ?? null) === (nextDraft.completionTarget ?? null) &&
        (current.missPolicy || "") === (nextDraft.missPolicy || "") &&
        (current.graceMinutes ?? 0) === (nextDraft.graceMinutes ?? 0) &&
        (current.anytimeFlexible || false) === (nextDraft.anytimeFlexible || false) &&
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

  return <CreateV2Habits {...props} createVariant="ONE_OFF" />;
}