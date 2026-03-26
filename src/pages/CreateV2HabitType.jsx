import React, { useEffect } from "react";
import ScreenShell from "./_ScreenShell";
import FlowShell from "../ui/create/FlowShell";
import CreateSection from "../ui/create/CreateSection";
import { CreateButton, CreateChoiceCard } from "../ui/create/CreateFormPrimitives";
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
  const selectedTypeLabel =
    draft?.habitType === "ONE_OFF"
      ? "Ponctuelle"
      : draft?.habitType === "ANYTIME"
        ? "Flexible"
        : draft?.habitType === "RECURRING"
          ? "Planifiée"
          : "";

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
      <CreateSection title="Quel type d’action ?" description="Choisis le niveau de cadrage." collapsible={false}>
        <div className="small2 textMuted">
          Commence simple. Tu pourras régler le détail juste après.
        </div>

        <CreateChoiceCard
          title="Ponctuelle"
          description="Une seule occurrence, avec ou sans heure fixe."
          selected={draft?.habitType === "ONE_OFF"}
          onClick={() => setType("ONE_OFF")}
          data-testid="create-type-oneoff"
        />
        <CreateChoiceCard
          title="Planifiée"
          description="Des jours précis, puis un moment commun ou des créneaux par jour."
          selected={draft?.habitType === "RECURRING"}
          onClick={() => setType("RECURRING")}
          data-testid="create-type-recurring"
        />
        <CreateChoiceCard
          title="Flexible"
          description="Une présence régulière, sans horaire imposé."
          selected={draft?.habitType === "ANYTIME"}
          onClick={() => setType("ANYTIME")}
          data-testid="create-type-anytime"
        />

        {selectedTypeLabel ? (
          <div className="small2 textMuted">Sélection actuelle : {selectedTypeLabel}</div>
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
