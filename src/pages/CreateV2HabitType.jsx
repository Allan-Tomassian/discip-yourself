import React, { useEffect } from "react";
import ScreenShell from "./_ScreenShell";
import { Button } from "../components/UI";
import FlowShell from "../ui/create/FlowShell";
import { GateSection } from "../shared/ui/gate/Gate";
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
      <GateSection title="Type d’action" description="Choisis le planning" collapsible={false}>
        <div className="small2 textMuted">
          Choisis le type. Tu configures le planning à l’étape suivante.
        </div>

        <Button onClick={() => setType("ONE_OFF")} data-testid="create-type-oneoff">
          Ponctuelle (une fois)
        </Button>
        <Button onClick={() => setType("RECURRING")} data-testid="create-type-recurring">
          Récurrente (planifiée)
        </Button>
        <Button onClick={() => setType("ANYTIME")} data-testid="create-type-anytime">
          Anytime (sans planification)
        </Button>

        {draft?.habitType ? (
          <div className="small2 textMuted">Sélection actuelle : {draft.habitType}</div>
        ) : null}
      </GateSection>
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
          <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </Button>
        ) : null}
        <FlowShell>{content}</FlowShell>
      </div>
    </ScreenShell>
  );
}
