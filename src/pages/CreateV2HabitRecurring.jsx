import React, { useEffect } from "react";
import CreateV2Habits from "./CreateV2Habits";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABITS } from "../creation/creationSchema";

export default function CreateV2HabitRecurring(props) {
  const { data, setData } = props;
  const safeData = data && typeof data === "object" ? data : {};
  const draft = normalizeCreationDraft(safeData?.ui?.createDraft);

  useEffect(() => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const ui = prev.ui || {};
      const current = normalizeCreationDraft(ui.createDraft);

      const next = {
        ...current,
        step: STEP_HABITS,
        habitType: "RECURRING",
      };

      if (current.step === next.step && current.habitType === next.habitType) return prev;
      return { ...prev, ui: { ...ui, createDraft: next } };
    });
  }, [setData]);

  return <CreateV2Habits {...props} />;
}