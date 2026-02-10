import React, { useCallback, useEffect, useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button } from "../components/UI";
import FlowShell from "../ui/create/FlowShell";
import { GateSection } from "../shared/ui/gate/Gate";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { SYSTEM_INBOX_ID } from "../logic/state";
import { resolveGoalType } from "../domain/goalType";
import { LABELS } from "../ui/labels";

export default function CreateV2OutcomeNextAction({
  data,
  setData,
  onCreateAction,
  onDone,
  embedded = false,
  skin = "",
}) {
  const isGate = skin === "gate";
  const safeData = data && typeof data === "object" ? data : {};
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const outcomeId = draft.createdOutcomeId || draft.activeOutcomeId || "";
  const outcome = goals.find((g) => g && g.id === outcomeId && resolveGoalType(g) === "OUTCOME") || null;
  const categoryId = outcome?.categoryId || (draft.category?.mode === "existing" ? draft.category.id : "") || SYSTEM_INBOX_ID;

  const clearDraftAndExit = useCallback(() => {
    if (typeof setData === "function") {
      setData((prev) => {
        const prevUi = prev.ui || {};
        return {
          ...prev,
          ui: {
            ...prevUi,
            createDraft: createEmptyDraft(),
            createDraftWasCompleted: true,
            createDraftWasCanceled: false,
          },
        };
      });
    }
    if (typeof onDone === "function") onDone();
  }, [onDone, setData]);

  useEffect(() => {
    if (!outcomeId) clearDraftAndExit();
  }, [outcomeId, clearDraftAndExit]);

  if (!outcomeId) return null;

  const content = (
    <div className="flowShellBody col gap12">
      <GateSection title="Première action" description="Optionnel" collapsible={false}>
        <div className="small2">Créer une première action pour ce {LABELS.goalLower} ?</div>
        <div className="small textMuted">
          {outcome?.title || LABELS.goal} · {categoryId === SYSTEM_INBOX_ID ? "Général" : "Catégorie choisie"}
        </div>
        <div className="row rowBetween">
          <Button variant="ghost" onClick={clearDraftAndExit}>
            Plus tard
          </Button>
          <Button
            onClick={() => {
              if (typeof onCreateAction === "function") {
                onCreateAction(outcomeId, categoryId || SYSTEM_INBOX_ID);
              }
            }}
          >
            Créer 1ère action
          </Button>
        </div>
        <div className="small2 textMuted2">
          Le {LABELS.goalLower} sera en brouillon tant qu’aucune action n’est liée.
        </div>
      </GateSection>
    </div>
  );

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">2.</span> 1ère action
        </>
      }
      backgroundImage={safeData?.profile?.whyImage || ""}
      embedded={embedded || isGate}
    >
      <div className="stack stackGap12">
        <FlowShell>{content}</FlowShell>
      </div>
    </ScreenShell>
  );
}
