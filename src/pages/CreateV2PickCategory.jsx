import React, { useState } from "react";
import ScreenShell from "./_ScreenShell";
import FlowShell from "../ui/create/FlowShell";
import CreateSection from "../ui/create/CreateSection";
import {
  CreateButton,
  CreateSelect,
} from "../ui/create/CreateFormPrimitives";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { getFirstVisibleCategoryId, getVisibleCategories } from "../domain/categoryVisibility";
import { safeUpdateGoal } from "../logic/goalGuards";

export default function CreateV2PickCategory({
  data,
  setData,
  onDone,
  onOpenPaywall,
  embedded = false,
  skin = "",
}) {
  const isGate = skin === "gate";
  const safeData = data && typeof data === "object" ? data : {};
  const categories = getVisibleCategories(safeData.categories);
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = normalizeCreationDraft(safeData?.ui?.createDraft);
  const createdActionIds = Array.isArray(draft.createdActionIds) ? draft.createdActionIds : [];
  const actions = goals.filter((g) => g && createdActionIds.includes(g.id));
  const linkedOutcomeId = draft?.activeOutcomeId ? String(draft.activeOutcomeId) : "";
  const createdOutcomeId = draft?.createdOutcomeId ? String(draft.createdOutcomeId) : "";
  const outcomeIds = [linkedOutcomeId, createdOutcomeId].filter(Boolean);
  const options = categories.slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

  const initialCategoryId =
    (actions[0]?.categoryId && options.some((c) => c.id === actions[0].categoryId)
      ? actions[0].categoryId
      : draft.pendingCategoryId && options.some((c) => c.id === draft.pendingCategoryId)
        ? draft.pendingCategoryId
        : getFirstVisibleCategoryId(options)) || "";
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId);

  function finalize() {
    if (typeof setData !== "function") return;
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
    if (typeof onDone === "function") onDone();
  }

  function applyCategory() {
    if (!actions.length) {
      finalize();
      return;
    }
    if (typeof setData !== "function") return;
    const nextCategoryId = selectedCategoryId || initialCategoryId || getFirstVisibleCategoryId(options) || "";
    if (nextCategoryId && !options.some((c) => c.id === nextCategoryId)) {
      setSelectedCategoryId(getFirstVisibleCategoryId(options) || "");
      return;
    }
    setData((prev) => {
      let next = prev;
      const idsToUpdate = [...createdActionIds, ...outcomeIds].filter(Boolean);
      const seen = new Set();
      for (const id of idsToUpdate) {
        if (seen.has(id)) continue;
        seen.add(id);
        const result = safeUpdateGoal(next, id, { categoryId: nextCategoryId }, { onOpenPaywall });
        next = result.state;
      }
      const prevUi = next.ui || {};
      return {
        ...next,
        ui: {
          ...prevUi,
          createDraft: createEmptyDraft(),
          createDraftWasCompleted: true,
          createDraftWasCanceled: false,
        },
      };
    });
    if (typeof onDone === "function") onDone();
  }

  const content = (
    <div className="flowShellBody col gap12">
      <CreateSection title="Catégorie" description="Dernière étape" collapsible={false}>
        <div className="small2">Dans quelle catégorie veux-tu agir ?</div>
        <CreateSelect value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} disabled={!options.length}>
          {options.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name || "Catégorie"}
            </option>
          ))}
        </CreateSelect>
        {!options.length ? <div className="small">Crée d&apos;abord une catégorie dans la bibliothèque.</div> : null}
      </CreateSection>
      <div className="createInlineActions">
        <CreateButton variant="ghost" onClick={finalize}>
          Plus tard
        </CreateButton>
        <CreateButton onClick={applyCategory} disabled={!options.length || !selectedCategoryId}>Terminer</CreateButton>
      </div>
    </div>
  );

  return (
    <ScreenShell
      data={safeData}
      pageId="create-pick-category"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span className="textMuted2">3.</span> Catégorie
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
