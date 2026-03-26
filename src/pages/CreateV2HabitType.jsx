import React, { useEffect } from "react";
import ScreenShell from "./_ScreenShell";
import FlowShell from "../ui/create/FlowShell";
import CreateSection from "../ui/create/CreateSection";
import { CreateButton } from "../ui/create/CreateFormPrimitives";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_HABIT_TYPE, STEP_HABITS } from "../creation/creationSchema";

export default function CreateV2HabitType({
  data,
  setData,
  onBack,
  onNext,
  embedded = false,
  hideBack = false,
  skin = "",
}) {
  const isGate = skin === "gate";
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

  const content = (
    <div className="flowShellBody col gap12">
      <CreateSection title="Type d’action" description="Choisis le planning" collapsible={false}>
        <div className="small2 textMuted">
          Choisis le type. Tu configures le planning à l’étape suivante.
        </div>

        <CreateButton onClick={() => setType("ONE_OFF")} data-testid="create-type-oneoff">
          Ponctuelle (une fois)
        </CreateButton>
        <CreateButton onClick={() => setType("RECURRING")} data-testid="create-type-recurring">
          Récurrente (planifiée)
        </CreateButton>
        <CreateButton onClick={() => setType("ANYTIME")} data-testid="create-type-anytime">
          Anytime (sans planification)
        </CreateButton>

        {draft?.habitType ? (
          <div className="small2 textMuted">Sélection actuelle : {draft.habitType}</div>
        ) : null}
      </CreateSection>
    </div>
  );

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
      embedded={embedded || isGate}
    >
      <div className="stack stackGap12">
        {!hideBack && !isGate ? (
          <CreateButton variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </CreateButton>
        ) : null}
        <FlowShell>{content}</FlowShell>
      </div>
    </ScreenShell>
  );
}
