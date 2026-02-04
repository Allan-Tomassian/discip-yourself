import React, { useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import Select from "../ui/select/Select";
import CreateSection from "../ui/create/CreateSection";
import { createEmptyDraft, normalizeCreationDraft } from "../creation/creationDraft";
import { safeUpdateGoal } from "../logic/goalGuards";
import { ensureSystemInboxCategory, SYSTEM_INBOX_ID } from "../logic/state";

export default function CreateV2PickCategory({ data, setData, onDone, onOpenPaywall }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const draft = normalizeCreationDraft(safeData?.ui?.createDraft);
  const createdActionIds = Array.isArray(draft.createdActionIds) ? draft.createdActionIds : [];
  const actions = goals.filter((g) => g && createdActionIds.includes(g.id));
  const linkedOutcomeId = draft?.activeOutcomeId ? String(draft.activeOutcomeId) : "";
  const createdOutcomeId = draft?.createdOutcomeId ? String(draft.createdOutcomeId) : "";
  const outcomeIds = [linkedOutcomeId, createdOutcomeId].filter(Boolean);
  const sys = categories.find((c) => c?.id === SYSTEM_INBOX_ID) || { id: SYSTEM_INBOX_ID, name: "Général" };
  const rest = categories.filter((c) => c?.id !== SYSTEM_INBOX_ID);
  rest.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  const options = [sys, ...rest];
  if (!options.length) options.push({ id: SYSTEM_INBOX_ID, name: "Général" });

  const initialCategoryId =
    (actions[0]?.categoryId && options.some((c) => c.id === actions[0].categoryId)
      ? actions[0].categoryId
      : draft.pendingCategoryId && options.some((c) => c.id === draft.pendingCategoryId)
        ? draft.pendingCategoryId
        : sys.id) || SYSTEM_INBOX_ID;
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
    const nextCategoryId = selectedCategoryId || initialCategoryId || SYSTEM_INBOX_ID;
    if (nextCategoryId && !options.some((c) => c.id === nextCategoryId)) {
      // No category creation in this flow: fallback to system inbox.
      setSelectedCategoryId(SYSTEM_INBOX_ID);
      return;
    }
    setData((prev) => {
      let next = prev;
      if (nextCategoryId === SYSTEM_INBOX_ID) {
        next = ensureSystemInboxCategory(next).state;
      }
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
    >
      <div className="stack stackGap12">
        <Card accentBorder>
          <div className="p18 col gap12">
            <CreateSection title="Catégorie" description="Dernière étape" collapsible={false}>
              <div className="small2">Dans quelle catégorie veux-tu agir ?</div>
              <Select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
                {options.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name || "Catégorie"}
                  </option>
                ))}
              </Select>
            </CreateSection>
            <div className="row rowBetween">
              <Button variant="ghost" onClick={finalize}>
                Plus tard
              </Button>
              <Button onClick={applyCategory}>Terminer</Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
