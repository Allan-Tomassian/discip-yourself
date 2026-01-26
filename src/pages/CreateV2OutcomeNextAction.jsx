import React, { useEffect, useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { SYSTEM_INBOX_ID } from "../logic/state";
import { resolveGoalType } from "../domain/goalType";

export default function CreateV2OutcomeNextAction({ data, setData, onCreateAction, onDone }) {
  const safeData = data && typeof data === "object" ? data : {};
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const outcomeId = draft.createdOutcomeId || draft.activeOutcomeId || "";
  const outcome = goals.find((g) => g && g.id === outcomeId && resolveGoalType(g) === "OUTCOME") || null;
  const categoryId = outcome?.categoryId || (draft.category?.mode === "existing" ? draft.category.id : "") || SYSTEM_INBOX_ID;

  function clearDraftAndExit() {
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
  }

  useEffect(() => {
    if (!outcomeId) clearDraftAndExit();
  }, [outcomeId]);

  if (!outcomeId) return null;

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
    >
      <div className="stack stackGap12">
        <Card accentBorder>
          <div className="p18 col gap12">
            <div className="small2">Créer une première action pour cet objectif ?</div>
            <div className="small textMuted">
              {outcome?.title || "Objectif"} · {categoryId === SYSTEM_INBOX_ID ? "Général" : "Catégorie choisie"}
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
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
