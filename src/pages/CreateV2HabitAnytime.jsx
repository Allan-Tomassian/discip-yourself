import React, { useEffect } from "react";
import CreateV2Habits from "./CreateV2Habits";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";

// App convention: 1 = Monday ... 7 = Sunday
function appDowFromDate(d) {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

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

      // Avoid useless writes
      const sameArray = (a, b) =>
        Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

      const noChange =
        current.step === nextDraft.step &&
        current.habitType === nextDraft.habitType &&
        (current.uxV2 || false) === (nextDraft.uxV2 || false) &&
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

  return <CreateV2Habits {...props} createVariant="ANYTIME" />;
}