import React, { useEffect } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABIT_TYPE, STEP_HABITS } from "../creation/creationSchema";

export default function CreateV2HabitType({ data, setData, onBack, onNext }) {
  const safeData = data && typeof data === "object" ? data : {};
  const draft = normalizeCreationDraft(safeData?.ui?.createDraft);

  useEffect(() => {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const ui = prev.ui || {};
      const current = normalizeCreationDraft(ui.createDraft);
      if (current.step === STEP_HABIT_TYPE) return prev;
      return { ...prev, ui: { ...ui, createDraft: { ...current, step: STEP_HABIT_TYPE } } };
    });
  }, [setData]);

  function setType(type) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const ui = prev.ui || {};
      const nextDraft = {
        ...normalizeCreationDraft(ui.createDraft),
        step: STEP_HABITS,
        habitType: type, // "ONE_OFF" | "RECURRING" | "ANYTIME"
      };
      return { ...prev, ui: { ...ui, createDraft: nextDraft, createDraftWasCompleted: false } };
    });

    if (typeof onNext === "function") onNext(type);
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="create-habit-type"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">1.</span> Type d’action
        </>
      }
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="stack stackGap12">
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>

        <Card accentBorder>
          <div className="p18 col gap12">
            <div className="small2 textMuted">
              Choisis le type. Tu configures le planning à l’étape suivante.
            </div>

            <Button onClick={() => setType("ONE_OFF")}>Ponctuelle (une fois)</Button>
            <Button onClick={() => setType("RECURRING")}>Récurrente (planifiée)</Button>
            <Button onClick={() => setType("ANYTIME")}>Anytime (sans planification)</Button>

            {draft?.habitType ? (
              <div className="small2 textMuted">Sélection actuelle : {draft.habitType}</div>
            ) : null}
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}